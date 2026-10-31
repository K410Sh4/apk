"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRgbDirect,validate,parse,MODES}=require("../desktop/rgb-direct.cjs");
for(const effect of MODES)assert.deepEqual(validate({device:"redragon-m711",color:"#aa77ff",effect,profile:5}),{
 color:"#AA77FF",effect,profile:5
});
for(const fake of [
 {device:"fifine",color:"#123456",effect:"static",profile:1},
 {device:"redragon-m711",color:"#abcdeg",effect:"static",profile:1},
 {device:"redragon-m711",color:"#123456",effect:"flash",profile:1},
 {device:"redragon-m711",color:"#123456",effect:"static",profile:6},
 {device:"redragon-m711",color:"#123456",effect:"static",profile:"1"},
 {device:"redragon-m711",color:"#123456",effect:"static",profile:1,command:"rawhid"},
 null
])assert.throws(()=>validate(fake),RangeError);
const detected=JSON.stringify({available:true,device:"Redragon M711 Cobra (04D9:FC30)",
 status:"detected",writable:true,reason:"Interface validada",lastAction:"none"});
assert.equal(parse(detected).writable,true);
assert.equal(parse(detected).lastAction,"none");
const probeFixture=JSON.stringify({...JSON.parse(detected),status:"not_found",writable:false,
 hidCollectionsSeen:30,targetCollectionsSeen:2,
 diagnostics:[{number:1,usagePage:"0x0001",usage:"0x0002",featureReportBytes:16,result:"different_usage_page",errorCode:0},
 {number:2,usagePage:"0xFFA0",usage:"0x0001",featureReportBytes:0,inputReportBytes:65,outputReportBytes:65,
  outputButtonCaps:1,outputValueCaps:2,featureButtonCaps:0,featureValueCaps:0,result:"no_feature_report",errorCode:0}]});
const inspected=parse(probeFixture);
assert.equal(inspected.targetCollectionsSeen,2);
assert.equal(inspected.writable,false);
assert.equal(inspected.diagnostics.length,2);
assert.equal(inspected.diagnostics[1].featureReportBytes,0);
assert.equal(inspected.diagnostics[1].inputReportBytes,65);
assert.equal(inspected.diagnostics[1].outputReportBytes,65);
assert.equal(inspected.diagnostics[1].result,"no_feature_report");
assert.equal(parse(JSON.stringify({...JSON.parse(detected),status:"ambiguous"})).writable,false);
assert.throws(()=>parse("no"));
assert.throws(()=>parse(JSON.stringify({...JSON.parse(detected),device:"Other"})));
const native=fs.readFileSync(path.join(__dirname,"../desktop/rgb-direct.ps1"),"utf8");
assert.match(native,/HidD_SetFeature/);
assert.match(native,/HidP_GetCaps/);
assert.match(native,/0xFFA0/);
assert.match(native,/0xFC30/);
assert.doesNotMatch(native,/IndexOf\("mi_02"/i,"An opaque Windows device path must not be parsed for MI_02");
assert.match(native,/HidD_GetAttributes/);
assert.match(native,/targetCollectionsSeen/);
assert.match(native,/OutputReportByteLength/);
assert.match(native,/InputReportByteLength/);
assert.match(native,/FeatureReportByteLength==0/);
assert.match(native,/no_feature_report/);
assert.match(native,/UsagePage==0xFFA0/);
assert.match(native,/0x0449/);
assert.match(native,/0xF3/);
assert.match(native,/0xF1/);
assert.doesNotMatch(native,/Install-Module|WinUSB|OpenRGB|Set-PnpDevice|HidD_SetOutputReport/i);
const page=fs.readFileSync(path.join(__dirname,"../apps/meu-pc/rgb/index.html"),"utf8");
for(const key of ["rgb-direct-color","rgb-direct-effect","rgb-direct-profile","rgb-direct-accept","rgb-direct-apply","rgb-direct-refresh"])
 assert.ok(page.includes('id="'+key+'"'));
assert.ok(!page.includes('id="rgb-openrgb-status"'),"No dependency on OpenRGB UI");
const client=fs.readFileSync(path.join(__dirname,"../assets/rgb-direct-ui.js"),"utf8");
new Function(client);assert.ok(client.includes("diagnosticReport"));assert.ok(client.includes("outputReportBytes"));assert.ok(client.includes("inputReportBytes"));assert.ok(client.includes("rgb-direct-copy"));assert.ok(client.includes('"/__api/rgb/direct"'));
const lan=fs.readFileSync(path.join(__dirname,"../desktop/lan.cjs"),"utf8");
assert.ok(lan.includes('authorized(req)')&&lan.includes('"/rgb/direct"'));
(async()=>{
 let when=1000,requests=[];
 const execFileFn=(exe,args,opts,cb)=>{
  assert.equal(exe,"powershell.exe");assert.ok(opts.windowsHide&&opts.timeout<=12500);
  requests.push(args);
  const write=args.includes("set");
  cb(null,JSON.stringify({...JSON.parse(detected),lastAction:write?"sent":"none"}),"");
 };
 const driver=createRgbDirect({platform:"win32",execFileFn,clock:()=>when});
 assert.equal((await driver.scan()).writable,true);
 assert.equal((await driver.scan()).writable,true);
 assert.equal(requests.length,1,"Cached scan should not invoke PowerShell twice");
 const sent=await driver.set({device:"redragon-m711",color:"#778899",effect:"static",profile:1});
 assert.equal(sent.lastAction,"sent");assert.equal(requests.length,2);
 assert.ok(requests[1].includes("#778899"));
 await assert.rejects(driver.set({device:"redragon-m711",color:"#778899",effect:"static",profile:1}),/Aguarde/);
 await assert.rejects(driver.set({device:"keyboard",color:"#778899",effect:"static",profile:1}),RangeError);
 assert.equal(requests.length,2);
 const other=createRgbDirect({platform:"linux"});
 assert.equal((await other.scan()).available,false);
 await assert.rejects(other.set({device:"redragon-m711",color:"#778899",effect:"static",profile:1}),/Windows/);
 console.log("[AppSpace RGB Direct] HID native allowlist, profiles, safe call and UI: OK");
})().catch(e=>{console.error(e);process.exitCode=1});