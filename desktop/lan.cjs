"use strict";
/* AppSpace LAN 0.6 — telemetria somente leitura, com pareamento temporário. */
const http = require("node:http");
const os = require("node:os");
const {createGpuSampler}=require("./gpu.cjs");
const {createRgbInventory}=require("./rgb.cjs");
const {createWindowsControls}=require("./pc-controls.cjs");
const { randomInt, randomBytes, timingSafeEqual } = require("node:crypto");
const PORT = 38473;
const ALLOWED_ORIGINS = new Set(["https://localhost", "http://localhost", "capacitor://localhost", "appspace://portal"]);
function ipv4s() {
  // A falha do sistema ao enumerar adaptadores não deve derrubar o portal.
  let interfaces;
  try { interfaces = os.networkInterfaces(); } catch (_) { return []; }
  return Object.values(interfaces).flat().filter(x => x && x.family === "IPv4" && !x.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address)).map(x => x.address);
}
function cpuTimes() {
  const cpus = os.cpus(); return cpus.reduce((a,c) => { a.idle += c.times.idle; a.total += Object.values(c.times).reduce((x,y)=>x+y,0); return a; },{idle:0,total:0});
}
function startLanServer() {
  const pin = String(randomInt(100000,999999));
  const secret = randomBytes(32).toString("hex");
  const attempts = new Map();
  const rgb=createRgbInventory();
  const controls=createWindowsControls();
  const gpuSampler=createGpuSampler();
  gpuSampler.start();
  let previous = cpuTimes();
  let server;
  let port = PORT, error = "";
  function sample() {
    const now = cpuTimes();
    const total = now.total - previous.total;
    const idle = now.idle - previous.idle;
    previous = now;
    const cpu = os.cpus();
    const totalRam = os.totalmem(), freeRam = os.freemem();
    return { timestamp:Date.now(), hostname:os.hostname(), cpu:{percent:total>0?Math.max(0,Math.min(100,Math.round(100*(1-idle/total)))):0,model:cpu[0]?.model || "", cores:cpu.length,frequencyMHz:cpu[0]?.speed||null}, memory:{totalBytes:totalRam,usedBytes:totalRam-freeRam,freeBytes:freeRam,percent:Math.round(100*(totalRam-freeRam)/totalRam)}, uptimeSeconds:Math.round(os.uptime()), gpu:gpuSampler.sample(), system:os.platform() };
  }
  function status() {return {enabled:Boolean(server?.listening),port,address:ipv4s()[0]||null,addresses:ipv4s(),pin:server?.listening?pin:null,error};}
  function respond(res,statusCode,data,origin) {
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin",origin);
      res.setHeader("Vary","Origin");
      res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type");
      res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network","true");
    }
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.writeHead(statusCode,{"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify(data));
  }
  function authorized(req) {
    const supplied = (req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(!/^[a-f0-9]{64}$/.test(supplied)) return false;
    return timingSafeEqual(Buffer.from(supplied,"hex"),Buffer.from(secret,"hex"));
  }
  function handler(req,res) {
    const origin=req.headers.origin;
    const remote=req.socket.remoteAddress || "";
    const host=(req.headers.host || "").toLowerCase();
    const validHosts = new Set(["localhost","127.0.0.1",...ipv4s()].map(address=>address+":"+port));
    if (!validHosts.has(host) ||
        (!remote.startsWith("::ffff:") && remote !== "::1" && !/^[\d.]+$/.test(remote))) {
      return respond(res,403,{error:"Host não autorizado"},origin);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) return respond(res,403,{error:"Origem não autorizada"},null);
    if (req.method==="OPTIONS") return respond(res,204,{ok:true},origin);
    if (req.url==="/health" && req.method==="GET") return respond(res,200,{service:"appspace-monitor",version:1},origin);
    if (req.url==="/pair" && req.method==="POST") {
      const ip=remote,now=Date.now(), entry=attempts.get(ip)||{count:0,reset:now+600000};
      if(now>entry.reset){entry.count=0;entry.reset=now+600000;}
      if(entry.count>=8)return respond(res,429,{error:"Muitas tentativas; tente novamente mais tarde"},origin);
      // Reservar antes de ler o corpo: requisições simultâneas compartilham o limite.
      for(const [address,value] of attempts)if(now>value.reset)attempts.delete(address);
      if(!attempts.has(ip)&&attempts.size>=1024)return respond(res,429,{error:"Tente novamente mais tarde"},origin);
      entry.count++;attempts.set(ip,entry);
      let raw="";req.on("data",chunk=>{raw+=chunk.toString();if(raw.length>1024)req.destroy();});
      req.on("end",()=>{
        let input;try{input=JSON.parse(raw);}catch(_){return respond(res,400,{error:"Dados inválidos"},origin);}
        if(!input||typeof input!=="object"||Array.isArray(input))return respond(res,400,{error:"Dados inválidos"},origin);
        if (typeof input.code!=="string" || !/^[0-9]{6}$/.test(input.code) ||
          !timingSafeEqual(Buffer.from(input.code),Buffer.from(pin)))return respond(res,401,{error:"Código incorreto"},origin);
        attempts.delete(ip);
        return respond(res,200,{token:secret,host:os.hostname()},origin);
      });return;
    }
    if (req.url==="/rgb/devices" && req.method==="GET") {
      if(!authorized(req))return respond(res,401,{error:"Pareamento necessário"},origin);
      // GET read-only; no scan on every poll, no HID writes.
      void rgb.scan().then(data=>respond(res,200,data,origin))
        .catch(()=>respond(res,503,{error:"Inventário RGB indisponível"},origin));
      return;
    }
    if (req.url==="/pc/controls") {
      if(!authorized(req))return respond(res,401,{error:"Pareamento necessário"},origin);
      if(req.method==="GET"){
        void controls.read().then(data=>respond(res,200,data,origin))
          .catch(()=>respond(res,503,{error:"Controles do Windows indisponíveis"},origin));
        return;
      }
      if(req.method==="POST"){
        if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"]||"")))
          return respond(res,415,{error:"Envie JSON"},origin);
        let body="",oversize=false;
        req.on("data",chunk=>{
          body+=chunk.toString("utf8");
          if(body.length>512){oversize=true;req.destroy();}
        });
        req.on("end",()=>{
          if(oversize)return;
          let change;
          try{change=JSON.parse(body)}catch(_){return respond(res,400,{error:"JSON inválido"},origin)}
          if(!change||typeof change!=="object"||Array.isArray(change)||
             Object.keys(change).some(key=>key!=="action"&&key!=="value"))
            return respond(res,400,{error:"Solicitação inválida"},origin);
          void controls.write(change.action,change.value)
           .then(data=>respond(res,200,data,origin))
           .catch(err=>respond(res,err instanceof RangeError?400:
             /Aguarde/.test(err.message)?409:503,{error:String(err.message).slice(0,140)},origin));
        });
        return;
      }
      return respond(res,405,{error:"Método não permitido"},origin);
    }
    if (req.url==="/metrics" && req.method==="GET") {
      if(!authorized(req))return respond(res,401,{error:"Pareamento necessário"},origin);
      return respond(res,200,sample(),origin);
    }
    respond(res,404,{error:"Rota não disponível"},origin);
  }
  server=http.createServer(handler);
  server.on("error",e=>{error="Porta "+port+" indisponível ("+e.code+")";});
  server.listen(PORT,"0.0.0.0");
  server.unref();
  return {status,sample,rgb,controls,stop:()=>{gpuSampler.stop();server.close();}};
}
module.exports={startLanServer};

