/* PC Monitor · Meu PC. Não cria pareamentos próprios nem guarda tokens. */
(()=>{
"use strict";
const PC=window.AppSpacePC;
if(!PC)throw Error("Central Meu PC indisponível");
const $=id=>document.getElementById(id);
const cap=window.Capacitor;
const native=Boolean(cap?.isNativePlatform?.());
let running=false,polling=false,generation=0,timer=null,failures=0;
let mode=false,modeEpoch=0,restore=Promise.resolve(),resumeOnShow=false;
let animation=null,frameStart=0,frameCount=0;
const history={cpu:[],ram:[],gpu:[],fps:[]};
function nativePlugin(name){
 if(!native)return null;
 return cap?.Plugins?.[name]||(cap?.isPluginAvailable?.(name)?cap.registerPlugin?.(name):null)||null;
}
async function enterFullscreen(){
 if(mode)return;
 mode=true;const ticket=++modeEpoch;
 document.body.dataset.monitorActive="true";
 const orientation=nativePlugin("ScreenOrientation");
 try{
  if(orientation?.lock)await orientation.lock({orientation:"landscape"});
  else await screen?.orientation?.lock?.("landscape");
 }catch(_){}
 if(ticket!==modeEpoch||!mode){
  try{
   if(orientation?.unlock)await orientation.unlock();
   else screen?.orientation?.unlock?.();
  }catch(_){}
  return;
 }
 try{await nativePlugin("StatusBar")?.hide?.()}catch(_){}
 if(ticket!==modeEpoch||!mode){try{await nativePlugin("StatusBar")?.show?.()}catch(_){}}
}
function exitFullscreen(){
 if(!mode)return restore;
 mode=false;modeEpoch++;
 delete document.body.dataset.monitorActive;
 const orientation=nativePlugin("ScreenOrientation");
 restore=Promise.allSettled([
   Promise.resolve().then(()=>orientation?.unlock?.()||screen?.orientation?.unlock?.()),
   Promise.resolve().then(()=>nativePlugin("StatusBar")?.show?.())
 ]);
 return restore;
}
function navigate(reason=""){
 const target="../index.html"+(reason?"?connection="+encodeURIComponent(reason):"");
 if(typeof location.replace==="function")location.replace(target);
 else if(typeof location.assign==="function")location.assign(target);
 else location.href=target;
}
function stop(){
 generation++;running=false;polling=false;
 stopFPS();
 if(timer)clearInterval(timer);timer=null;
}
function exit(reason=""){
 stop();
 void exitFullscreen().finally(()=>navigate(reason));
}
const formatGb=value=>(Number(value||0)/1073741824).toLocaleString("pt-BR",{maximumFractionDigits:1})+" GB";
function text(id,value){const el=$(id);if(el)el.textContent=String(value)}
function width(id,percent){const el=$(id);if(el)el.style.width=Math.max(0,Math.min(100,Number(percent)||0))+"%"}
function appendHistory(metric,value,limit=100){
 const points=history[metric];if(!points)return;
 if(value!=null&&Number.isFinite(value))points.push(Math.max(0,Math.min(limit,value)));
 else points.push(null);
 if(points.length>28)points.shift();
 const svg=$("monitor-"+metric+"-spark");const path=svg?.querySelector("path");
 if(!path)return;
 // Uma curva SVG pequena; nunca armazenar histórico de longo prazo no celular.
 let d="";
 points.forEach((v,i)=>{
   if(v===null)return;
   const x=points.length<=1?0:i*100/(points.length-1);
   const y=31-(v/limit)*30;
   d+=(i===0||points[i-1]===null?"M":"L")+x.toFixed(1)+" "+y.toFixed(1)+" ";
 });
 path.setAttribute("d",d||"M0 31 L100 31");
}
function setStatus(online,message){
 const status=$("monitor-status");if(status)status.dataset.online=String(online);
 text("monitor-status-text",message);
}
function stopFPS(){
 if(animation!==null&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(animation);
 animation=null;frameCount=0;frameStart=0;
 text("monitor-fps","—");width("monitor-fps-bar",0);
}
function fpsFrame(timestamp){
 if(!running)return;
 if(document.hidden){
   frameStart=0;frameCount=0;
   animation=requestAnimationFrame(fpsFrame);return;
 }
 if(!frameStart)frameStart=timestamp;
 frameCount++;
 const elapsed=timestamp-frameStart;
 if(elapsed>=900){
   const fps=Math.round(frameCount*1000/elapsed);
   if(Number.isFinite(fps)&&fps>=0&&fps<1000){
     text("monitor-fps",fps);width("monitor-fps-bar",Math.min(100,fps/120*100));
     appendHistory("fps",fps,120);
   }
   frameStart=timestamp;frameCount=0;
 }
 animation=requestAnimationFrame(fpsFrame);
}
function startFPS(){
 stopFPS();
 if(typeof requestAnimationFrame==="function")animation=requestAnimationFrame(fpsFrame);
 else text("monitor-fps-details","FPS indisponível neste navegador");
}
function render(data){
 if(!data?.cpu||!data?.memory)throw Error("Leituras inválidas");
 const cpu=Math.max(0,Math.min(100,Number(data.cpu.percent)||0));
 const ram=Math.max(0,Math.min(100,Number(data.memory.percent)||0));
 text("monitor-cpu",cpu+"%");width("monitor-cpu-bar",cpu);appendHistory("cpu",cpu);
 text("monitor-cpu-frequency",data.cpu.frequencyMHz?(Number(data.cpu.frequencyMHz)/1000).toFixed(2)+" GHz":"—");
 text("monitor-ram",ram+"%");width("monitor-ram-bar",ram);appendHistory("ram",ram);
 text("monitor-ram-details",formatGb(data.memory.usedBytes)+" / "+formatGb(data.memory.totalBytes));
 const gpu=Number(data.gpu?.percent);
 if(data.gpu?.percent!=null&&Number.isFinite(gpu)){
  const value=Math.max(0,Math.min(100,gpu));
  text("monitor-gpu",Math.round(value)+"%");width("monitor-gpu-bar",value);
  text("monitor-gpu-details","Windows · GPU Engine");appendHistory("gpu",value);
  $("monitor-gpu")?.closest(".monitor-metric")?.setAttribute("data-available","true");
 }else{
   text("monitor-gpu","N/D");width("monitor-gpu-bar",0);appendHistory("gpu",null);
   const reason=data.gpu?.status;
   const details=reason==="warming"?"Aguardando sensor do PC":
    reason==="unsupported"?"GPU: somente no Windows":
    reason==="stale"?"Sensor sem leitura recente":
    "Sensor GPU indisponível no PC";
   text("monitor-gpu-details",details);
   $("monitor-gpu")?.closest(".monitor-metric")?.setAttribute("data-available","false");
 }
 const sec=Math.max(0,Math.floor(Number(data.uptimeSeconds)||0));
 text("monitor-uptime",Math.floor(sec/3600)+"h "+Math.floor((sec%3600)/60)+"m");
 text("monitor-connection-detail","Ao vivo");
 setStatus(true,"CONECTADO");
 const stamp=Number(data.timestamp);
 text("monitor-last-update",Number.isFinite(stamp)&&stamp>0?new Date(stamp).toLocaleTimeString("pt-BR",{hour12:false}):"Agora");
 failures=0;
}
async function poll(){
 if(!running||polling||document.hidden)return;
 polling=true;const epoch=generation;
 try{
  const data=await PC.check();
  if(!running||epoch!==generation)return;
  render(data);
 }catch(e){
  if(!running||epoch!==generation)return;
  failures++;
  text("monitor-connection-detail","Sem sinal");
  setStatus(false,"SEM SINAL");
  if(failures>=6)exit("lost");
 }finally{if(epoch===generation)polling=false}
}
function start(){
 if(!PC.get()){navigate("required");return;}
 stop();running=true;failures=0;
 setStatus(false,"CONECTANDO");
 startFPS();
 void enterFullscreen();
 void poll();timer=setInterval(()=>void poll(),1000);
}
function init(){
 $("monitor-exit")?.addEventListener("click",()=>exit());
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&running){event.preventDefault();exit();}
 });
 window.addEventListener("pagehide",()=>{resumeOnShow=running;stop();void exitFullscreen()});
 window.addEventListener("pageshow",event=>{if(event.persisted&&resumeOnShow){resumeOnShow=false;start()}});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&running)void poll()});
 start();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
