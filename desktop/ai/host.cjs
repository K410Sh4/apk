"use strict";
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {DEFAULT,validateProfile,statuses}=require("./profile.cjs");
const {createEngine}=require("./engine.cjs");

function validateBase(input) {
  const u=new URL(input);
  if(u.protocol!=="http:"||u.username||u.password||u.search||u.hash||u.pathname!=="/"||!["127.0.0.1","localhost"].includes(u.hostname))throw Error("Backend llama.cpp deve usar http://127.0.0.1:<porta>.");
  return u.origin;
}
function corsAllowed(origin) {
  if(!origin)return true;
  if(origin==="null"||origin==="capacitor://localhost"||origin==="https://localhost")return true;
  try {const u=new URL(origin);return ["http:","https:"].includes(u.protocol)&&["127.0.0.1","localhost"].includes(u.hostname)&&u.pathname==="/"&&!u.search&&!u.hash;}catch(_){return false;}
}
function createHost({port=8765,host="127.0.0.1",token=crypto.randomBytes(32).toString("hex"),llamaBase="http://127.0.0.1:8080",memoryPath=path.join(os.homedir(),".appspace","rea-qwen-memory.json"),fetcher=fetch}={}) {
  if(!["127.0.0.1","localhost"].includes(host))throw Error("Versão 0.2 só aceita loopback; use adb reverse no Android.");
  if(!Number.isInteger(port)||port<0||port>65535)throw Error("Porta inválida.");
  if(typeof token!=="string"||token.length<24)throw Error("Token muito curto.");
  const base=validateBase(llamaBase);
  const engine=createEngine({base,fetcher,memoryPath});
  let profile=validateProfile(DEFAULT);
  let revision=0;
  const api="rea-qwen-mod-host";
  const json=(res,code,data)=>{res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(data));};
  function bearer(req) {
    const h=req.headers.authorization||"";
    const value=typeof h==="string"&&h.startsWith("Bearer ")?h.slice(7):"";
    const left=Buffer.from(value),right=Buffer.from(token);
    return left.length===right.length&&crypto.timingSafeEqual(left,right);
  }
  function body(req) {
    return new Promise((resolve,reject)=>{
      const len=Number(req.headers["content-length"]||0);
      if(!Number.isFinite(len)||len>32768)return reject(Object.assign(Error("Requisição muito grande."),{status:413}));
      if(!String(req.headers["content-type"]||"").toLowerCase().startsWith("application/json"))return reject(Object.assign(Error("Content-Type deve ser application/json."),{status:415}));
      let size=0,data="",ended=false;
      req.setEncoding("utf8");
      req.on("data",chunk=>{if(ended)return;size+=Buffer.byteLength(chunk);if(size>32768){ended=true;reject(Object.assign(Error("Requisição muito grande."),{status:413}));req.resume();return;}data+=chunk;});
      req.on("end",()=>{if(ended)return;try{resolve(JSON.parse(data));}catch(_){reject(Object.assign(Error("JSON inválido."),{status:400}));}});
      req.on("error",reject);
    });
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const portActual=server.address()?.port||port;
      const hostHeader=String(req.headers.host||"").toLowerCase();
      if(!["127.0.0.1:"+portActual,"localhost:"+portActual].includes(hostHeader))return json(res,403,{error:"Host inválido."});
      const origin=req.headers.origin;
      if(!corsAllowed(origin))return json(res,403,{error:"Origem não autorizada."});
      if(origin){
        res.setHeader("Access-Control-Allow-Origin",origin);
        res.setHeader("Vary","Origin");
        res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
        res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
        res.setHeader("Access-Control-Max-Age","600");
      }
      if(req.method==="OPTIONS")return json(res,204,{});
      if(!bearer(req))return json(res,401,{error:"Token ausente ou inválido."});
      const pathname=new URL(req.url,"http://localhost").pathname;
      if(req.method==="GET"&&pathname==="/api/v1/status"){
        const model=await engine.getModel();
        return json(res,200,{agent:api,apiVersion:1,capabilities:{mods:true,chat:true,memory:true,ota:false},
          model:{ready:Boolean(model),id:model},revision,moduleStatus:statuses(profile,Boolean(model)),memoryItems:profile.mods.memory?engine.memory.count():0});
      }
      if(req.method==="GET"&&pathname==="/api/v1/mods/profile"){
        return json(res,200,{agent:api,apiVersion:1,revision,profile,moduleStatus:statuses(profile,Boolean(await engine.getModel()))});
      }
      if(req.method==="POST"&&pathname==="/api/v1/mods/apply"){
        const input=await body(req);
        if(!input||input.schema!==1||!input.profile)throw Object.assign(Error("Corpo inválido."),{status:400});
        try {profile=validateProfile(input.profile);}
        catch(err) {throw Object.assign(new Error(err.message),{status:400});}
        revision++;
        const model=await engine.getModel();
        return json(res,200,{agent:api,apiVersion:1,applied:true,revision,profile,moduleStatus:statuses(profile,Boolean(model)),modelReady:Boolean(model),
          note:"Perfil aplicado à orquestração deste agente; pesos GGUF e backend Vulkan não modificados."});
      }
      if(req.method==="POST"&&pathname==="/api/v1/chat"){
        const input=await body(req);
        if(!input||typeof input.prompt!=="string")throw Object.assign(Error("Envie prompt como texto."),{status:400});
        const result=await engine.chat(profile,input.prompt);
        return json(res,200,{agent:api,apiVersion:1,revision,...result});
      }
      if(req.method==="POST"&&pathname==="/api/v1/memory/clear"){
        const input=await body(req);
        if(input?.confirm!==true)throw Object.assign(Error("Confirme a limpeza."),{status:400});
        engine.memory.clear();
        return json(res,200,{agent:api,apiVersion:1,cleared:true});
      }
      return json(res,404,{error:"Rota inexistente."});
    }catch(e){return json(res,Number.isInteger(e.status)?e.status:500,{error:e.message||"Erro interno."});}
  });
  return {
    token,server,
    listen:()=>new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,host,()=>{server.removeListener("error",reject);resolve({url:"http://127.0.0.1:"+server.address().port,token});});}),
    close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())),
    getProfile:()=>structuredClone(profile)
  };
}
module.exports={createHost,validateBase,corsAllowed};