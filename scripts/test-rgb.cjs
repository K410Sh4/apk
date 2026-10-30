"use strict";
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createRgbInventory,classify,parseRaw,packet,readOpenRGB,POWERSHELL}=require("../desktop/rgb.cjs");
const hw=(VID,ProductID,MI,Name,Class,Bus="USB",VendorHID=false)=>({VID,ProductID,MI,Name,Class,Bus,VendorHID,Status:"OK"});
const raw=[
 hw("0C45","8006","00","Dispositivo de teclado HID","Keyboard","HID"),
 hw("0C45","8006","01","Dispositivo definido pelo fornecedor compatível com HID","HIDClass","HID",true),
 hw("0C45","8006","01","Dispositivo de teclado HID","Keyboard","HID"),
 hw("04D9","FC30","00","Mouse compatível com HID","Mouse","HID"),
 hw("3142","A010","00","fifine Microphone","MEDIA","USB"),
 hw("3142","A010","04","Vendor defined input","HIDClass","HID",true),
 hw("0BDA","B851","02","Realtek WiFi","Net"),
];
const groups=classify(raw);
assert.equal(groups.length,4);
assert.equal(groups.find(x=>x.id==="keyboard").interfaceCount,3);
assert.equal(groups.find(x=>x.id==="keyboard").hasVendorHID,true);
assert.equal(groups.find(x=>x.id==="fifine").present,true);
assert.equal(groups.find(x=>x.id==="redragon").present,true);
assert.equal(groups.find(x=>x.id==="controller").present,false,"Hub USB não é controladora RGB");
assert.ok(groups.every(x=>x.control==="unverified"));
assert.deepEqual(parseRaw(JSON.stringify(raw)).map(x=>x.interfaceCount),groups.map(x=>x.interfaceCount));
assert.equal(classify([]).filter(x=>x.present).length,0);
assert.ok(!POWERSHELL.match(/\$pid\b/i),"Não sobrescrever variável reservada PID");
assert.ok(!POWERSHELL.includes("Set-PnpDevice"),"Não modificar dispositivos");
let calls=0,complete;
const execFileFn=(binary,args,opts,callback)=>{
 calls++;complete=callback;
 assert.equal(binary,"powershell.exe");assert.ok(args.includes("-NonInteractive"));
 assert.ok(opts.windowsHide);assert.ok(opts.timeout<=6500);
 assert.ok(args.at(-1).includes("Win32_PnPEntity"));
};
(async()=>{
 const service=createRgbInventory({platform:"win32",execFileFn,openRGB:async()=>({connected:false,devices:[]})});
 const a=service.scan(),b=service.scan();
 assert.equal(calls,1,"Deduplicar leituras PnP concorrentes");
 complete(null,JSON.stringify(raw),"");
 assert.equal((await a).available,true);
 assert.equal((await b).devices.length,4);
 assert.equal((await service.scan()).devices.length,4);
 assert.equal(calls,1,"Inventário em cache");
 const unsupported=createRgbInventory({platform:"linux"});
 assert.equal((await unsupported.scan()).available,false);
 const hdr=packet(40,0,Buffer.from([1,0,0,0]));
 assert.equal(hdr.length,20);assert.equal(hdr.toString("ascii",0,4),"ORGB");
 assert.equal(hdr.readUInt32LE(8),40);assert.equal(hdr.readUInt32LE(12),4);
 const remote=await readOpenRGB({connect:opts=>{
   assert.equal(opts.host,"127.0.0.1");
   assert.equal(opts.port,6742);
   const socket=new EventEmitter();socket.destroy=()=>{};socket.setTimeout=()=>{};
   socket.write=p=>{
     const id=p.readUInt32LE(8);
     if(id===40){const data=Buffer.alloc(4);data.writeUInt32LE(1);process.nextTick(()=>socket.emit("data",packet(40,0,data)))}
     if(id===0){const data=Buffer.alloc(4);process.nextTick(()=>socket.emit("data",packet(0,0,data)))}
   };
   process.nextTick(()=>socket.emit("connect"));return socket;
 }});
 assert.equal(remote.connected,true);assert.equal(remote.devices.length,0);
 console.log("[RGB Controller] Inventário USB/HID, FIFINE, teclado, cache e SDK localhost: OK");
})().catch(error=>{console.error(error);process.exitCode=1;});
