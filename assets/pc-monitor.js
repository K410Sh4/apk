/* PC Monitor v0.6: consultas a cada segundo; HTTP nativo no Android e API local no Electron. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const isDesktop=location.protocol==="appspace:";
const capacitor=window.Capacitor;
const native=Boolean(capacitor?.isNativePlatform?.());
const STORAGE="appspace.pcmonitor.v1",PORT=38473;
let state={ip:"",token:""}, timer=null,started=false,polling=false,failures=0;
let generation=0,resumeOnShow=false,pairing=false;
const history=[];
let monitorMode=false,modeGeneration=0,modeExitPromise=Promise.resolve();
function nativePlugin(name){
  if(!native)return null;
  return capacitor?.Plugins?.[name]||
    (capacitor?.isPluginAvailable?.(name)?capacitor.registerPlugin?.(name):null)||null;
}
async function enterMonitorMode(){
  if(monitorMode)return;
  monitorMode=true;
  const session=++modeGeneration;
  if(document.body?.dataset)document.body.dataset.monitorActive="true";
  const orientation=nativePlugin("ScreenOrientation");
  try{
    if(orientation?.lock){
      await orientation.lock({orientation:"landscape"});
    }else if(window.screen?.orientation?.lock){
      await window.screen.orientation.lock("landscape");
    }
  }catch(_){/* CSS lateral permanece utilizável quando a API não existe. */}
  if(session!==modeGeneration||!monitorMode)return;
  try{await nativePlugin("StatusBar")?.hide?.();}catch(_){}
  if(session!==modeGeneration||!monitorMode){
    try{await nativePlugin("StatusBar")?.show?.();}catch(_){}
  }
}
function exitMonitorMode(){
  if(!monitorMode)return modeExitPromise;
  monitorMode=false;++modeGeneration;
  if(document.body?.dataset)delete document.body.dataset.monitorActive;
  modeExitPromise=Promise.allSettled([
    Promise.resolve().then(()=>nativePlugin("ScreenOrientation")?.unlock?.()||
      window.screen?.orientation?.unlock?.()),
    Promise.resolve().then(()=>nativePlugin("StatusBar")?.show?.())
  ]);
  return modeExitPromise;
}

function privateIPv4(ip){
  if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip))return false;
  const parts=ip.split(".").map(Number);
  if(parts.some(p=>p>255))return false;
  return parts[0]===10||(parts[0]===192&&parts[1]===168)||
    (parts[0]===172&&parts[1]>=16&&parts[1]<=31);
}
function stored(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||"null");return data&&privateIPv4(data.ip)&&/^[a-f0-9]{64}$/.test(data.token)?data:null;}catch(_){return null;}}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(_){}}
function clear(){try{localStorage.removeItem(STORAGE);}catch(_){}}
function setConnection(connected,text){
  const indicator=byId("monitor-connection-indicator");
  if(indicator)indicator.dataset.connected=String(connected);
  if(byId("monitor-connection-text"))byId("monitor-connection-text").textContent=text;
}
function text(id,value){const el=byId(id);if(el)el.textContent=String(value);}
function setBar(id,percent){const el=byId(id);if(el)el.style.width=Math.max(0,Math.min(100,Number(percent)||0))+"%";}
function formatGb(value){return (Number(value)/1073741824).toLocaleString("pt-BR",{maximumFractionDigits:1})+" GB";}
function render(data){
  if(!data||typeof data!=="object"||!data.cpu||!data.memory)throw Error("Dados do computador inválidos");
  const cpu=Math.max(0,Math.min(100,Number(data.cpu.percent)||0));
  const ram=Math.max(0,Math.min(100,Number(data.memory.percent)||0));
  text("monitor-host",data.hostname||"Computador");
  text("monitor-cpu",cpu+"%");
  text("monitor-cpu-frequency",data.cpu.frequencyMHz ? (data.cpu.frequencyMHz/1000).toFixed(2)+" GHz" : "—");
  text("monitor-cpu-model",data.cpu.model||"Processador");
  text("monitor-ram",ram+"%");
  text("monitor-ram-details",formatGb(data.memory.usedBytes)+" usados");
  text("monitor-ram-total",formatGb(data.memory.totalBytes)+" no total");
  text("monitor-uptime",Math.floor((data.uptimeSeconds||0)/3600)+"h "+Math.floor(((data.uptimeSeconds||0)%3600)/60)+"m");
  text("monitor-connection-detail","Leitura "+new Date(data.timestamp||Date.now()).toLocaleTimeString("pt-BR"));
  if(data.gpu?.percent!=null&&Number.isFinite(Number(data.gpu.percent))){
    const percent=Math.max(0,Math.min(100,Number(data.gpu.percent)));
    text("monitor-gpu",percent+"%");setBar("monitor-gpu-bar",percent);
  }else{text("monitor-gpu","N/D");setBar("monitor-gpu-bar",0);}
  setBar("monitor-cpu-bar",cpu);setBar("monitor-ram-bar",ram);
  history.push(cpu);if(history.length>40)history.shift();
  const points=history.map((value,index)=>(40===1?0:index*400/39).toFixed(1)+","+(84-value*.8).toFixed(1)).join(" ");
  byId("monitor-cpu-spark")?.setAttribute("points",points);
  failures=0;setConnection(true,"Conectado");
}
async function callApi(path,method="GET",data=null,authorized=true){
  if(isDesktop){
    const url=path==="/metrics"?"/__api/metrics":path==="/health"?"/__api/desktop":null;
    if(!url)throw Error("Operação não disponível no Windows");
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4000);
    try{
      const r=await fetch(url,{cache:"no-store",signal:controller.signal});
      if(!r.ok)throw Error("Falha local HTTP "+r.status);
      return await r.json();
    }finally{clearTimeout(timeout);}
  }
  if(!privateIPv4(state.ip))throw Error("Insira um IP privado válido");
  const url="http://"+state.ip+":"+PORT+path;
  const headers={"Accept":"application/json"};
  if(data)headers["Content-Type"]="application/json";
  if(authorized&&state.token)headers["Authorization"]="Bearer "+state.token;
  // CapacitorHttp nativo: contorna mixed-content/CORS do WebView, sem servidor externo.
  const nativeHttp=capacitor?.Plugins?.CapacitorHttp;
  if(native && nativeHttp && typeof nativeHttp.request==="function"){
    const reply=await nativeHttp.request({url,method,headers,data:data||undefined,connectTimeout:4000,readTimeout:4000});
    let payload=reply.data;
    if(typeof payload==="string"){try{payload=JSON.parse(payload);}catch(_){}}
    if(reply.status<200||reply.status>=300)throw Error(payload?.error||"HTTP "+reply.status);
    return payload;
  }
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),4000);
  try{
    const response=await fetch(url,{method,headers,body:data?JSON.stringify(data):undefined,signal:controller.signal,cache:"no-store"});
    const payload=await response.json();if(!response.ok)throw Error(payload.error||"HTTP "+response.status);
    return payload;
  }finally{clearTimeout(timeout);}
}
function dashboard(show){
  if(byId("monitor-pair-panel"))byId("monitor-pair-panel").hidden=show;
  if(byId("monitor-dashboard"))byId("monitor-dashboard").hidden=!show;
  if(show)void enterMonitorMode();
  else void exitMonitorMode();
}
async function poll(){
  if(polling||document.hidden||!started)return;
  polling=true;
  const session=generation;
  try{
    const data=await callApi("/metrics");
    if(!started||session!==generation)return;
    render(data);
  }
  catch(e){
    if(!started||session!==generation)return;
    failures++;setConnection(false,"Falha de conexão");
    text("monitor-connection-detail",e.message);
    if(failures>=6){stop();dashboard(false);text("monitor-pair-error","Conexão interrompida. Confira o EXE, o IP, o firewall e a mesma rede Wi-Fi.");}
  }finally{if(session===generation)polling=false;}
}
function start(){
  stop();started=true;failures=0;dashboard(true);setConnection(false,"Conectando…");
  void poll();timer=setInterval(()=>void poll(),1000);
}
function stop(){generation++;started=false;polling=false;if(timer)clearInterval(timer);timer=null;}
async function pair(event){
  event.preventDefault();
  if(pairing)return;
  const ip=byId("monitor-ip")?.value.trim()||"";
  const pin=byId("monitor-pin")?.value.trim()||"";
  const button=byId("monitor-pair-button");
  if(!privateIPv4(ip)){text("monitor-pair-error","Insira um IP local válido (10.x, 172.16–31.x ou 192.168.x).");return;}
  if(!/^\d{6}$/.test(pin)){text("monitor-pair-error","O código precisa ter seis números.");return;}
  stop();pairing=true;const session=generation;
  if(button)button.disabled=true;
  state={ip,token:""};text("monitor-pair-error","Autorizando conexão local…");
  try{
    const response=await callApi("/pair","POST",{code:pin},false);
    if(session!==generation)return;
    if(!/^[a-f0-9]{64}$/.test(response.token||""))throw Error("Resposta inválida do computador");
    state.token=response.token;persist();
    if(byId("monitor-pin"))byId("monitor-pin").value="";start();
  }catch(e){if(session===generation)text("monitor-pair-error","Falha ao conectar: "+e.message+". Verifique o código e o firewall do Windows.");}
  finally{pairing=false;if(button)button.disabled=false;}
}
async function init(){
  if(isDesktop) {
    text("monitor-pair-error","No Windows os dados são exibidos diretamente, sem pareamento.");
    start();
    try {
      const status=await callApi("/health");
      text("monitor-pair-error","Para conectar o celular, abra Configurações e consulte o IP local e o código de pareamento.");
    }catch(_){}
  } else {
    const saved=stored();
    if(saved){state=saved;if(byId("monitor-ip"))byId("monitor-ip").value=saved.ip;start();}
  }
  byId("monitor-pair-form")?.addEventListener("submit",event=>void pair(event));
  byId("monitor-exit")?.addEventListener("click",()=>{
    stop();
    if(byId("monitor-dashboard"))byId("monitor-dashboard").hidden=true;
    // Fecha o modo, restaurando orientação e barra de status antes de navegar.
    void exitMonitorMode().finally(()=>{
      if(typeof location.assign==="function")location.assign("../index.html");
      else location.href="../index.html";
    });
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&monitorMode){
      event.preventDefault();
      byId("monitor-exit")?.click();
    }
  });
  byId("monitor-disconnect")?.addEventListener("click",()=>{
    stop();state={ip:"",token:""};clear();dashboard(false);
    setConnection(false,"Desconectado");
    text("monitor-pair-error","Conexão encerrada. Informe novamente o código do Windows.");
  });
  window.addEventListener("pagehide",()=>{
    resumeOnShow=started;stop();void exitMonitorMode();
  });
  window.addEventListener("pageshow",event=>{
    if(event.persisted&&resumeOnShow){resumeOnShow=false;start();}
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&started)void poll();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void init());else void init();
})();

