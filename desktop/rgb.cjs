"use strict";
/* RGB inventory v1: no HID writes, no firmware/driver changes.
 * Windows PnP/CIM probing + opt-in OpenRGB SDK query to 127.0.0.1 only.
 */
const {execFile}=require("node:child_process");
const net=require("node:net");
const POWERSHELL=[
 "$ErrorActionPreference='Stop'",
 "$targets=@('04D9:FC30','0C45:8006','3142:A010')",
 "$out=@(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop | Where-Object { $_.PNPDeviceID -match '^(USB|HID)\\\\' -and ($_.PNPDeviceID -match 'VID_[0-9a-f]{4}.PID_[0-9a-f]{4}') } | ForEach-Object {",
 " $id=[string]$_.PNPDeviceID; $vendor='';$product='';$iface='';",
 " if($id -match 'VID_([0-9a-f]{4})'){$vendor=$Matches[1].ToUpper()}",
 " if($id -match 'PID_([0-9a-f]{4})'){$product=$Matches[1].ToUpper()}",
 " if($id -match 'MI_([0-9a-f]{2})'){$iface=$Matches[1].ToUpper()}",
 " if( ($vendor+':'+$product) -in $targets -or $_.Name -match '(?i)RGB|ARGB|LED|fifine|redragon|sate|teclado|keyboard' ) {",
 "  [pscustomobject]@{VID=$vendor;ProductID=$product;MI=$iface;Name=[string]$_.Name;Class=[string]$_.PNPClass;Manufacturer=[string]$_.Manufacturer;Status=[string]$_.Status;Bus=($id -split '\\\\')[0];VendorHID=($id -match '(?i)^HID\\\\' -and $_.Name -match '(?i)fornecedor|vendor.defin|vendor.specific');Keyboard=($_.PNPClass -eq 'Keyboard');Mouse=($_.PNPClass -eq 'Mouse');Audio=($_.PNPClass -eq 'MEDIA')} }",
 "})",
 "$out|ConvertTo-Json -Compress -Depth 4"
].join("\n");
const PAIRS=Object.freeze([
 {id:"redragon",vid:"04D9",pid:"FC30",category:"mouse",label:"Mouse USB (provável Redragon)",confidence:"provável"},
 {id:"keyboard",vid:"0C45",pid:"8006",category:"keyboard",label:"Teclado USB (possível Sate G50)",confidence:"a confirmar"},
 {id:"fifine",vid:"3142",pid:"A010",category:"microphone",label:"Microfone FIFINE",confidence:"confirmado pelo Windows"}
]);
function classify(raw){
 const rows=Array.isArray(raw)?raw:raw&&typeof raw==="object"?[raw]:[];
 const visible=rows.filter(r=>r&&/^[0-9A-F]{4}$/.test(r.VID)&&/^[0-9A-F]{4}$/.test(r.ProductID)&&
   /^(OK|Error|Degraded|Unknown)?$/i.test(String(r.Status||"").slice(0,32)));
 const groups=[];
 for(const d of PAIRS){
  const hits=visible.filter(r=>r.VID===d.vid&&r.ProductID===d.pid);
  const set=new Map();
  for(const x of hits){
   const key=[x.Bus,x.MI,x.Class,x.Name].join("|");
   if(!set.has(key))set.set(key,{name:String(x.Name||"").slice(0,100),
     class:String(x.Class||"").slice(0,24),mi:String(x.MI||"").slice(0,2),
     bus:String(x.Bus||"").slice(0,6),
     vendorDefined:Boolean(x.VendorHID),keyboard:Boolean(x.Keyboard),mouse:Boolean(x.Mouse),audio:Boolean(x.Audio)});
  }
  groups.push({...d,present:set.size>0,interfaces:[...set.values()].slice(0,24),
    interfaceCount:set.size,
    hasVendorHID:[...set.values()].some(x=>x.vendorDefined),
    control:"unverified"});
 }
 const known=new Set(PAIRS.map(x=>x.vid+":"+x.pid));
 const extra=visible.filter(x=>!known.has(x.VID+":"+x.ProductID)&&/rgb|argb|led|controller|controladora/i.test(x.Name||""));
 // Don't claim generic controller is detected just because a USB controller/hub exists.
 groups.push({id:"controller",vid:null,pid:null,category:"controller",label:"Controladora RGB do gabinete",
  confidence:"não identificada",present:extra.length>0,
  interfaces:extra.slice(0,10).map(x=>({name:String(x.Name||"").slice(0,100),class:x.Class,mi:x.MI,vid:x.VID,pid:x.ProductID})),
  interfaceCount:extra.length,control:"unverified"});
 return groups;
}
function parseRaw(stdout){
 let obj;try{obj=JSON.parse(String(stdout).replace(/^\uFEFF/,"").trim()||"[]");}
 catch(_){throw Error("Resposta inválida do inventário de dispositivos");}
 return classify(obj);
}
function packet(id,device=0,body=Buffer.alloc(0)){
 const out=Buffer.alloc(16+body.length);
 out.write("ORGB");out.writeUInt32LE(device>>>0,4);out.writeUInt32LE(id>>>0,8);out.writeUInt32LE(body.length,12);
 body.copy(out,16);return out;
}
function readOpenRGB(options={}){
 const connect=options.connect||net.createConnection;
 return new Promise(resolve=>{
  let socket,buffer=Buffer.alloc(0),stage=0,version=null,count=0;const names=[];
  let settled=false;
  const finish=val=>{if(settled)return;settled=true;try{socket?.destroy()}catch(_){}resolve(val)};
  const failed=()=>finish({connected:false,devices:[],note:"SDK local não detectado"});
  try{socket=connect({host:"127.0.0.1",port:6742})}catch(_){failed();return}
  socket.setTimeout?.(1300);
  socket.on("error",failed);socket.on("timeout",failed);
  socket.on("connect",()=>{let v=Buffer.alloc(4);v.writeUInt32LE(1);socket.write(packet(40,0,v));});
  socket.on("data",chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
   if(buffer.length>1048576)return failed();
   while(buffer.length>=16&&!settled){
    if(buffer.toString("ascii",0,4)!=="ORGB")return failed();
    const dev=buffer.readUInt32LE(4),id=buffer.readUInt32LE(8),len=buffer.readUInt32LE(12);
    if(len>1024*512)return failed();
    if(buffer.length<16+len)break;
    const data=buffer.subarray(16,16+len);
    buffer=buffer.subarray(16+len);
    if(stage===0&&id===40&&len===4){
      version=Math.min(1,data.readUInt32LE(0));stage=1;socket.write(packet(0));continue;
    }
    if(stage===1&&id===0&&len>=4){
      count=data.readUInt32LE(0);if(count>32)return failed();
      if(count===0)return finish({connected:true,devices:[],note:"OpenRGB sem dispositivos controláveis"});
      stage=2;socket.write(packet(1,0,version?Buffer.from([1,0,0,0]):Buffer.alloc(0)));continue;
    }
    if(stage===2&&id===1&&len>=12){
      // Protocol v1 device-data header: block size, device type, name length, name.
      const nlen=data.readUInt16LE(8),start=10;
      if(nlen<1||nlen>200||start+nlen>len)return failed();
      const name=data.toString("utf8",start,start+nlen-1).slice(0,100);
      names.push({index:dev,name,control:"not-enabled"});
      if(names.length>=count)return finish({connected:true,devices:names,note:"Descoberta OpenRGB somente leitura"});
      socket.write(packet(1,names.length,version?Buffer.from([1,0,0,0]):Buffer.alloc(0)));
    }
   }
  });
 });
}
function createRgbInventory(options={}){
 const platform=options.platform??process.platform;
 const exec=options.execFileFn||execFile;
 const clock=options.clock||Date.now;
 const openRGB=options.openRGB||(async()=>({connected:false,devices:[],note:"Driver RGB nativo, sem SDK externo"}));
 let cached=null,pending=null,last=0;
 async function scan(force=false){
  if(platform!=="win32")return {available:false,devices:[],openRGB:{connected:false,devices:[]},reason:"Disponível no EXE Windows"};
  if(pending)return pending;
  if(!force&&cached&&clock()-last<10000)return cached;
  pending=(async()=>{
   const [raw,rgb]=await Promise.all([
    new Promise(resolve=>exec("powershell.exe",["-NoProfile","-NonInteractive","-Command",POWERSHELL],
     {timeout:6500,maxBuffer:1024*1024,windowsHide:true},(err,stdout)=>resolve({err,stdout}))),
    openRGB().catch(()=>({connected:false,devices:[],note:"SDK indisponível"}))
   ]);
   let devices=[],reason=null;
   if(raw.err)reason="O Windows não retornou a lista USB/HID";
   else{try{devices=parseRaw(raw.stdout)}catch(e){reason=e.message}}
   cached={available:!reason,devices,openRGB:rgb,reason,scannedAt:clock(),
     message:"Somente leitura. Nenhum comando RGB/HID foi enviado."};
   last=clock();return cached;
  })();
  try{return await pending}finally{pending=null}
 }
 return {scan};
}
module.exports={createRgbInventory,classify,parseRaw,packet,readOpenRGB,POWERSHELL};
