"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {createHost}=require("../desktop/ai/host.cjs");
const {DEFAULT,validateProfile}=require("../desktop/ai/profile.cjs");

function startServer(server) {return new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve("http://127.0.0.1:"+server.address().port)));}
function closeServer(server) {return new Promise(resolve=>server.close(resolve));}
async function call(base,route,token,method="GET",body,headers={}) {
 const res=await fetch(base+route,{method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const json=await res.json();
 return {status:res.status,body:json,headers:res.headers};
}
test("perfil v1 valida tipos, versões e módulos estritos",()=>{
 assert.equal(validateProfile(DEFAULT).mods.think,true);
 assert.throws(()=>validateProfile({...DEFAULT,target:"qwen3"}),/Schema/);
 assert.throws(()=>validateProfile({...DEFAULT,mods:{...DEFAULT.mods,unknown:true}}),/mods/);
 assert.throws(()=>validateProfile({...DEFAULT,mods:{...DEFAULT.mods,think:"yes"}}),/Tipo/);
 assert.throws(()=>validateProfile({...DEFAULT,contextSize:50000}),/Contexto/);
});
test("REA Mod Host autentica, aplica perfil, conversa no Qwen e apaga memória",async()=>{
 const requests=[];
 const llama=http.createServer(async(req,res)=>{
   if(req.method==="GET"&&req.url==="/v1/models"){res.setHeader("content-type","application/json");return res.end(JSON.stringify({data:[{id:"qwen-test"}]}));}
   if(req.method==="POST"&&req.url==="/v1/chat/completions"){
     let body="";for await(const chunk of req)body+=chunk;
     const parsed=JSON.parse(body);requests.push(parsed);
     res.setHeader("content-type","application/json");
     return res.end(JSON.stringify({choices:[{message:{content:"Resposta técnica "+requests.length+" sobre Roblox e Luau"}}]}));
   }
   res.writeHead(404);res.end();
 });
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"appspace-ai-"));
 let agent;
 try {
  const llamaUrl=await startServer(llama);
  agent=createHost({port:0,token:"a".repeat(64),llamaBase:llamaUrl,memoryPath:path.join(tmp,"memory.json")});
  const {url,token}=await agent.listen();
  assert.equal((await call(url,"/api/v1/status","bad")).status,401);
  assert.equal((await call(url,"/api/v1/status",token,"GET",undefined,{Origin:"https://evil.example"})).status,403);
  assert.equal((await call(url,"/api/v1/status",token,"GET",undefined,{Host:"evil.example"})).status,403);
  const status=await call(url,"/api/v1/status",token,"GET",undefined,{Origin:"capacitor://localhost"});
  assert.equal(status.status,200);
  assert.equal(status.headers.get("access-control-allow-origin"),"capacitor://localhost");
  assert.equal(status.body.agent,"rea-qwen-mod-host");
  assert.equal(status.body.model.ready,true);
  assert.equal(status.body.model.id,"qwen-test");
  let bad=await call(url,"/api/v1/mods/apply",token,"POST",{schema:1,profile:{...DEFAULT,mods:{...DEFAULT.mods,think:"on"}}});
  assert.equal(bad.status,400); // schema validation errors are never silently accepted
  const profile={...DEFAULT,mods:{think:true,memory:true,vulkan:true,verify:true},thinkMode:"balanced",contextSize:4096};
  const applied=await call(url,"/api/v1/mods/apply",token,"POST",{schema:1,profile});
  assert.equal(applied.status,200);
  assert.equal(applied.body.applied,true);
  assert.equal(applied.body.moduleStatus.vulkan.state,"manual");
  assert.equal(applied.body.moduleStatus.think.state,"ready");
  const chat=await call(url,"/api/v1/chat",token,"POST",{prompt:"Analise este código Roblox em Luau."});
  assert.equal(chat.status,200);
  assert.equal(chat.body.passes,4);
  assert.equal(requests.length,4);
  assert.match(chat.body.verification,/sem testes automáticos/);
  const second=await call(url,"/api/v1/chat",token,"POST",{prompt:"Revise o código Roblox Luau com cuidado."});
  assert.equal(second.status,200);
  assert.ok(second.body.memoryUsed>0,"Memória lexical deve recuperar contexto relevante.");
  assert.equal((await call(url,"/api/v1/status",token)).body.memoryItems,2);
  assert.equal((await call(url,"/api/v1/memory/clear",token,"POST",{confirm:false})).status,400);
  assert.equal((await call(url,"/api/v1/memory/clear",token,"POST",{confirm:true})).body.cleared,true);
  assert.equal((await call(url,"/api/v1/status",token)).body.memoryItems,0);
  const plain={...DEFAULT,mods:{think:false,memory:false,vulkan:false,verify:false},thinkMode:"deep"};
  await call(url,"/api/v1/mods/apply",token,"POST",{schema:1,profile:plain});
  const baseline=await call(url,"/api/v1/chat",token,"POST",{prompt:"Explique Lua em duas frases."});
  assert.equal(baseline.body.passes,1);
  assert.equal((await call(url,"/api/v1/chat",token,"POST",{prompt:"x"})).status,400);
 } finally {
  if(agent)await agent.close();
  await closeServer(llama);
  fs.rmSync(tmp,{recursive:true,force:true});
 }
});
test("serviço exige loopback e não permite endpoint de inferência remoto",()=>{
 assert.throws(()=>createHost({host:"0.0.0.0"}),/loopback/);
 assert.throws(()=>createHost({llamaBase:"http://example.org:8080"}),/Backend/);
 assert.throws(()=>createHost({token:"short"}),/Token/);
});
