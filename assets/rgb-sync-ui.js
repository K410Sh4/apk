/* AppSpace RGB Sync: prévia local, não executa comandos HID/USB/ARGB. */
(()=>{
"use strict";
const engine=window.AppSpaceRgbSync;
if(!engine)return;
const $=id=>document.getElementById(id);
const STORAGE_KEY="appspace.rgb.sync.v1";
const IDS=["controller","fifine","keyboard","redragon"];
const LABELS=["Gabinete","Microfone FIFINE","Teclado USB","Mouse USB"];
let settings=engine.normalize();
try{settings=engine.normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch(_){}
let running=false,handle=null,base=0,elapsed=0,lastDraw=-1000;
function text(id,content){const el=$(id);if(el)el.textContent=content}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}catch(_){}}
function draw(ms){
 const items=engine.renderFrame(ms,IDS,settings);
 for(const item of items){
  const led=$("rgb-led-"+item.id);
  if(led){led.style.backgroundColor=item.color;led.style.boxShadow="0 0 22px "+item.color+"80";}
  const label=$("rgb-color-"+item.id);
  if(label)label.textContent=item.color.toUpperCase();
 }
}
function stop(){
 if(handle!==null){cancelAnimationFrame(handle);handle=null}
 running=false;
 const button=$("rgb-sync-start");
 if(button){button.textContent="Iniciar prévia";button.setAttribute("aria-pressed","false")}
 text("rgb-sync-state","Prévia pausada");
}
function tick(now){
 if(!running)return;
 const t=elapsed+now-base;
 if(t-lastDraw>=32){lastDraw=t;draw(t)}
 handle=requestAnimationFrame(tick);
}
function start(){
 if(running||document.hidden)return;
 running=true;base=performance.now();lastDraw=-1000;
 const button=$("rgb-sync-start");
 if(button){button.textContent="Pausar prévia";button.setAttribute("aria-pressed","true")}
 text("rgb-sync-state","Prévia animada · somente na tela");
 handle=requestAnimationFrame(tick);
}
function update(){
 settings=engine.normalize({
  effect:$("rgb-sync-effect").value,color:$("rgb-sync-color").value,
  brightness:$("rgb-sync-brightness").value,speed:$("rgb-sync-speed").value,
  synchronized:$("rgb-sync-together").checked
 });
 text("rgb-sync-brightness-value",settings.brightness+"%");
 text("rgb-sync-speed-value",String(settings.speed));
 persist();
 draw(running?elapsed+performance.now()-base:elapsed);
}
function init(){
 if(!$("rgb-sync-preview"))return;
 const preview=$("rgb-sync-preview");
 preview.replaceChildren();
 for(let i=0;i<IDS.length;i++){
  const tile=document.createElement("div");
  tile.className="rgb-sync-tile";
  const name=document.createElement("span");name.className="rgb-sync-tile-label";name.textContent=LABELS[i];
  const led=document.createElement("span");led.className="rgb-sync-led";led.id="rgb-led-"+IDS[i];led.setAttribute("aria-hidden","true");
  const state=document.createElement("small");state.className="rgb-sync-tile-value";state.id="rgb-color-"+IDS[i];
  const info=document.createElement("small");info.className="rgb-sync-not-physical";info.textContent="Simulação";
  tile.append(name,led,state,info);preview.append(tile);
 }
 $("rgb-sync-effect").value=settings.effect;
 $("rgb-sync-color").value=settings.color;
 $("rgb-sync-brightness").value=String(settings.brightness);
 $("rgb-sync-speed").value=String(settings.speed);
 $("rgb-sync-together").checked=settings.synchronized;
 for(const id of ["rgb-sync-effect","rgb-sync-color","rgb-sync-brightness","rgb-sync-speed","rgb-sync-together"]){
  $(id).addEventListener("input",update);
  $(id).addEventListener("change",update);
 }
 $("rgb-sync-start").addEventListener("click",()=>{
  if(running){elapsed+=performance.now()-base;stop()}
  else start();
 });
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&running){elapsed+=performance.now()-base;stop()}});
 window.addEventListener("pagehide",()=>{if(running){elapsed+=performance.now()-base;stop()}});
 draw(0);
 update();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
