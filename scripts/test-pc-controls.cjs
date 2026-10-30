"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createWindowsControls,parseState,validateChange,LIMITS}=require("../desktop/pc-controls.cjs");

const sample=JSON.stringify({
 available:true,scope:"windows-defaults",
 microphone:{available:true,volume:68,muted:false},
 speakers:{available:true,volume:41,muted:true},
 mouseAvailable:true,mouseSpeed:10,
 keyboardAvailable:true,keyboardRepeat:23
});
assert.deepEqual(Object.keys(LIMITS).sort(),
 ["keyboardRepeat","micMute","micVolume","mouseSpeed","speakerMute","speakerVolume"].sort());
for(const [name,minmax] of Object.entries(LIMITS)){
 assert.deepEqual(validateChange(name,minmax[0]),{action:name,value:minmax[0]});
 assert.deepEqual(validateChange(name,minmax[1]),{action:name,value:minmax[1]});
 assert.throws(()=>validateChange(name,minmax[0]-1),RangeError);
 assert.throws(()=>validateChange(name,minmax[1]+1),RangeError);
 assert.throws(()=>validateChange(name,1.5),RangeError);
 assert.throws(()=>validateChange(name,"1"),RangeError);
}
for(const malicious of ["rgbSet","hidWrite","powershell","",null,"constructor"]){
 assert.throws(()=>validateChange(malicious,1),RangeError);
}
const parsed=parseState(sample);
assert.equal(parsed.microphone.volume,68);
assert.equal(parsed.speakers.muted,true);
assert.equal(parsed.mouse.speed,10);
assert.equal(parsed.keyboard.repeat,23);
assert.equal(parsed.scope,"windows-defaults");
assert.equal(parseState(JSON.stringify({...JSON.parse(sample),mouseAvailable:false})).mouse.speed,null);
assert.throws(()=>parseState("nada"));
assert.throws(()=>parseState(JSON.stringify({...JSON.parse(sample),keyboardRepeat:70})));
assert.throws(()=>parseState(JSON.stringify({...JSON.parse(sample),scope:"rgb"})));
const ps=fs.readFileSync(path.join(__dirname,"../desktop/pc-controls.ps1"),"utf8");
assert.match(ps,/IAudioEndpointVolume/);
assert.match(ps,/SystemParametersInfo/);
assert.match(ps,/GetDefaultAudioEndpoint/);
assert.doesNotMatch(ps,/SendInput|SetFeature|HidD_Set|Set-PnpDevice|OpenRGB|flashFirmware/i);
const page=fs.readFileSync(path.join(__dirname,"../apps/meu-pc/rgb/index.html"),"utf8");
for(const id of ["pc-controls","pc-mic-apply","pc-mic-mute","pc-speaker-mute","pc-mouse-apply","pc-keyboard-apply"]){
 assert.ok(page.includes('id="'+id+'"'));
}
const client=fs.readFileSync(path.join(__dirname,"../assets/pc-controls.js"),"utf8");
new Function(client);
assert.match(client,/PC\.request\("\/pc\/controls"/);
const lan=fs.readFileSync(path.join(__dirname,"../desktop/lan.cjs"),"utf8");
assert.match(lan,/authorized\(req\)/);
assert.match(lan,/\/pc\/controls/);
const clientApi=fs.readFileSync(path.join(__dirname,"../assets/pc-connection.js"),"utf8");
assert.match(clientApi,/\/pc\/controls/);

(async()=>{
 let calls=[],clock=0;
 const mock=(exe,args,opts,callback)=>{
  calls.push({exe,args,opts});
  assert.equal(exe,"powershell.exe");
  assert.equal(args.at(0),"-NoLogo");
  assert.equal(args.at(-1),"0");
  assert.ok(opts.timeout<=10000&&opts.windowsHide);
  callback(null,sample,"");
 };
 const service=createWindowsControls({platform:"win32",execFileFn:mock,clock:()=>clock});
 assert.equal((await service.read()).mouse.speed,10);
 assert.equal((await service.read()).keyboard.repeat,23);
 assert.equal(calls.length,1,"Cache de leitura");
 assert.equal((await service.write("micMute",0)).microphone.volume,68);
 assert.equal(calls.length,2);
 assert.ok(calls[1].args.includes("-Operation")&&calls[1].args.includes("write"));
 assert.ok(calls[1].args.includes("-Setting")&&calls[1].args.includes("micMute"));
 assert.equal((await service.read()).speakers.volume,41);
 assert.equal(calls.length,2,"Cache após gravação");
 clock=3000;await service.read();
 assert.equal(calls.length,3,"Cache expira");
 await assert.rejects(service.write("rgbSet",5),RangeError);
 assert.equal(calls.length,3,"Comando inválido jamais executado");
 const unsupported=createWindowsControls({platform:"linux"});
 assert.equal((await unsupported.read()).available,false);
 await assert.rejects(unsupported.write("micMute",1),/Windows/);
 console.log("[AppSpace] Controles Windows: validação, leitura, execução simulada e segurança OK.");
})().catch(e=>{console.error(e);process.exitCode=1;});
