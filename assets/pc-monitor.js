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
 if(timer)clearInterval(timer);timer=null;
}
function exit(reason=""){
 stop();
 void exitFullscreen().finally(()=>navigate(reason));
}
const formatGb=value=>(Number(value||0)/1073741824).toLocaleString("pt-BR",{maximumFractionDigits:1})+" GB";
function text(id,value){const el=$(id);if(el)el.textContent=String(value)}
function width(id,percent){const el=$(id);if(el)el.style.width=Math.max(0,Math.min(100,Number(percent)||0))+"%"}
function render(data){
 if(!data?.cpu||!data?.memory)throw Error("Leituras inválidas");
 const cpu=Math.max(0,Math.min(100,Number(data.cpu.percent)||0));
 const ram=Math.max(0,Math.min(100,Number(data.memory.percent)||0));
 text("monitor-cpu",cpu+"%");width("monitor-cpu-bar",cpu);
 text("monitor-cpu-frequency",data.cpu.frequencyMHz?(Number(data.cpu.frequencyMHz)/1000).toFixed(2)+" GHz":"—");
 text("monitor-ram",ram+"%");width("monitor-ram-bar",ram);
 text("monitor-ram-details",formatGb(data.memory.usedBytes)+" / "+formatGb(data.memory.totalBytes));
 const gpu=Number(data.gpu?.percent);
 if(data.gpu?.percent!=null&&Number.isFinite(gpu)){
  const value=Math.max(0,Math.min(100,gpu));text("monitor-gpu",value+"%");width("monitor-gpu-bar",value);
 }else{text("monitor-gpu","N/D");width("monitor-gpu-bar",0);}
 const sec=Math.max(0,Math.floor(Number(data.uptimeSeconds)||0));
 text("monitor-uptime",Math.floor(sec/3600)+"h "+Math.floor((sec%3600)/60)+"m");
 text("monitor-connection-detail","Ao vivo");
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
  if(failures>=6)exit("lost");
 }finally{if(epoch===generation)polling=false}
}
function start(){
 if(!PC.get()){navigate("required");return;}
 stop();running=true;failures=0;
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
