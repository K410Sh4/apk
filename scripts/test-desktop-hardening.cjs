"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {CONTENT_SECURITY_POLICY}=require("../desktop/security.cjs");
const {isPrivatePeer}=require("../desktop/lan.cjs");
const {createDesktopUpdater}=require("../desktop/updates.cjs");

async function main(){
  assert.match(CONTENT_SECURITY_POLICY,/script-src 'self'/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY,/script-src[^;]*unsafe-inline/);
  assert.match(CONTENT_SECURITY_POLICY,/object-src 'none'/);
  for(const ip of ["127.0.0.1","::1","::ffff:192.168.1.22","10.5.4.3","172.20.0.2"]){
    assert.equal(isPrivatePeer(ip),true,"private peer: "+ip);
  }
  for(const ip of ["8.8.8.8","::ffff:1.2.3.4","172.32.1.2","2001:db8::1","garbage"]){
    assert.equal(isPrivatePeer(ip),false,"public peer: "+ip);
  }
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"appspace-ota-test-"));
  try{
    const web=path.join(root,"web-updates");
    const activeDir=path.join(web,"v0.7.15");
    fs.mkdirSync(activeDir,{recursive:true});
    fs.writeFileSync(path.join(activeDir,"index.html"),"<html></html>");
    fs.writeFileSync(path.join(web,"active.json"),'{"version":"0.7.15"}');
    fs.writeFileSync(path.join(web,"pending.json"),'{"version":"0.7.15"}');
    const failed=createDesktopUpdater(root,"0.7.4");
    assert.equal(failed.status().updated,false,"unfinished OTA must roll back on startup");
    assert.equal(fs.existsSync(path.join(web,"active.json")),false);
    assert.equal(fs.existsSync(path.join(web,"pending.json")),false);
    fs.writeFileSync(path.join(web,"active.json"),'{"version":"0.7.15"}');
    const accepted=createDesktopUpdater(root,"0.7.4");
    assert.equal(accepted.status().updated,true,"confirmed OTA remains active");
    await accepted.reset();
    assert.equal(accepted.status().updated,false);
    assert.equal(accepted.status().pending,false);
    assert.equal(fs.existsSync(path.join(web,"active.json")),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
  const electronMain=fs.readFileSync(path.join(__dirname,"../desktop/main.cjs"),"utf8");
  assert.match(electronMain,/requestSingleInstanceLock/);
  assert.match(electronMain,/Content-Security-Policy/);
  assert.match(electronMain,/render-process-gone/);
  console.log("[AppSpace Windows] CSP, rede privada, instância e recuperação OTA: OK");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
