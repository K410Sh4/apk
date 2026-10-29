"use strict";
const assert=require("node:assert/strict");
const {startLanServer}=require("../desktop/lan.cjs");
(async()=>{
  const lan=startLanServer();
  try{
    let info;for(let i=0;i<50;i++){info=lan.status();if(info.enabled)break;await new Promise(resolve=>setTimeout(resolve,30));}
    assert.equal(info.enabled,true,"Servidor LAN deve iniciar na porta local");
    const base="http://127.0.0.1:38473";
    const health=await fetch(base+"/health");assert.equal(health.status,200);
    const unauth=await fetch(base+"/metrics");assert.equal(unauth.status,401);
    const wrong=await fetch(base+"/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:"000000"})});
    assert.equal(wrong.status,401);
    const pairing=await fetch(base+"/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:info.pin})});
    assert.equal(pairing.status,200);
    const response=await pairing.json();assert.match(response.token,/^[a-f0-9]{64}$/);
    const metrics=await fetch(base+"/metrics",{headers:{Authorization:"Bearer "+response.token}});
    assert.equal(metrics.status,200);
    const body=await metrics.json();
    assert.ok(body.cpu&&Number.isFinite(body.cpu.percent));
    assert.ok(body.memory&&body.memory.totalBytes>0);
    assert.equal(body.gpu.percent,null,"Não inventar valor de GPU");
    console.log("[AppSpace LAN] Pareamento, auth e CPU/RAM: OK");
  }finally{lan.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
