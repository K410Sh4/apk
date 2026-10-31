/* AppSpace Clean UI — progressive disclosure only; never writes hardware or changes app data. */
(()=>{
"use strict";
function setupSettings(){
 const root=document.querySelector("body.page-settings .settings-panels");
 if(!root)return;
 const definitions=[
  {id:"appearance",selector:'[aria-labelledby="appearance-title"]',title:"Aparência",hint:"Tema, cores, tamanho e organização",open:true},
  {id:"mobile",selector:"#navegacao-mobile",title:"Navegação no celular",hint:"Como as pastas aparecem no Android"},
  {id:"audio",selector:'[aria-labelledby="audio-title"]',title:"Sons",hint:"Ativar, ajustar ou desligar efeitos sonoros"},
  {id:"updates",selector:"#atualizacoes",title:"Atualizações e conexão",hint:"OTA, Windows e pareamento com o celular"}
 ];
 const groups=new Map();
 for(const d of definitions){
  const section=root.querySelector(d.selector);
  if(!section)return; // Keep legacy settings untouched if the expected structure changes.
  const group=document.createElement("details");
  group.className="as-settings-group";group.id="as-settings-"+d.id;
  group.open=Boolean(d.open);
  const summary=document.createElement("summary");
  const heading=document.createElement("span");
  const label=document.createElement("strong");label.textContent=d.title;
  const hint=document.createElement("small");hint.textContent=d.hint;
  heading.append(label,hint);
  summary.append(heading);
  group.append(summary);
  root.insertBefore(group,section);
  group.append(section);
  groups.set(d.id,group);
 }
 // Desktop native update controls are unchanged; keep them behind the same Updates group.
 const desktop=root.querySelector("#desktop-updates");
 if(desktop)groups.get("updates").append(desktop);
 const jump=document.createElement("nav");
 jump.className="as-settings-jump";
 jump.setAttribute("aria-label","Ir para seção de configurações");
 for(const d of definitions){
  const link=document.createElement("a");
  link.href="#as-settings-"+d.id;link.textContent=d.title;
  link.addEventListener("click",event=>{
   event.preventDefault();
   const group=groups.get(d.id);
   for(const [name,other] of groups)other.open=name===d.id;
   group.scrollIntoView({block:"start",behavior:"auto"});
   history.replaceState(null,"",link.getAttribute("href"));
   const summary=group.querySelector("summary");summary?.focus?.({preventScroll:true});
  });
  jump.append(link);
 }
 root.parentElement.insertBefore(jump,root);
 for(const [id,group] of groups){
  group.addEventListener("toggle",()=>{
   if(!group.open)return;
   for(const [otherId,other] of groups)if(otherId!==id)other.open=false;
  });
 }
 const map={"#appearance-title":"appearance","#navegacao-mobile":"mobile",
  "#audio-title":"audio","#atualizacoes":"updates","#desktop-updates":"updates"};
 const initial=location.hash;
 const id=map[initial]||(initial.startsWith("#as-settings-")?initial.slice(13):null);
 if(groups.has(id)){
  for(const [name,group] of groups)group.open=name===id;
 }
}
function setupRgb(){
 const scope=document.querySelector("body.rgb-page .rgb-content");
 const direct=document.getElementById("rgb-direct");
 if(!scope||!direct)return;
 const panels={
  control:[direct],
  devices:[scope.querySelector(".rgb-grid")],
  preview:[scope.querySelector(".rgb-sync-section")],
  advanced:[scope.querySelector(".rgb-hub-section"),scope.querySelector('[aria-labelledby="rgb-search-title"]')]
 };
 if(Object.values(panels).flat().some(v=>!v))return;
 const labels=[
  ["control","Controle"],
  ["devices","Dispositivos"],
  ["preview","Prévia RGB"],
  ["advanced","Avançado"]
 ];
 const nav=document.createElement("nav");
 nav.className="rgb-tabs";nav.setAttribute("role","tablist");
 nav.setAttribute("aria-label","Áreas do RGB Controller");
 const buttons=new Map();
 const key="appspace.rgb.view.v1";
 let active="control";
 try{const v=sessionStorage.getItem(key);if(panels[v])active=v}catch(_){}
 if(/^(#rgb-hub|#rgb-search)/.test(location.hash))active="advanced";
 if(location.hash==="#rgb-sync-title")active="preview";
 const btnFor=k=>buttons.get(k);
 const activate=(id,focus=false)=>{
  if(!panels[id])return;
  active=id;
  for(const [tab,button] of buttons){
   const selected=tab===id;
   button.setAttribute("aria-selected",String(selected));button.tabIndex=selected?0:-1;
   for(const element of panels[tab])element.hidden=!selected;
  }
  try{sessionStorage.setItem(key,id)}catch(_){}
  if(focus)btnFor(id).focus();
 };
 for(const [id,label] of labels){
  const button=document.createElement("button");
  button.type="button";button.id="as-rgb-tab-"+id;
  button.setAttribute("role","tab");
  button.setAttribute("aria-selected","false");
  button.setAttribute("aria-controls",panels[id][0].id||("as-rgb-panel-"+id));
  if(!panels[id][0].id)panels[id][0].id="as-rgb-panel-"+id;
  button.textContent=label;button.tabIndex=-1;
  button.addEventListener("click",()=>activate(id));
  button.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
   event.preventDefault();
   const idx=labels.findIndex(entry=>entry[0]===id);
   const next=event.key==="Home"?0:event.key==="End"?labels.length-1:
     (idx+(event.key==="ArrowLeft"?-1:1)+labels.length)%labels.length;
   activate(labels[next][0],true);
  });
  buttons.set(id,button);nav.append(button);
 }
 scope.insertBefore(nav,direct);
 for(const [tab,elements] of Object.entries(panels)){
  for(const element of elements){
   element.dataset.asRgbPanel=tab;
   element.setAttribute("role","region");
   element.setAttribute("aria-label",labels.find(x=>x[0]===tab)[1]);
  }
 }
 // Device details remain available but don't occupy space unless opened.
 for(const card of scope.querySelectorAll(".rgb-grid .rgb-device")){
  const desc=card.querySelector(".rgb-device-desc"),tip=card.querySelector(".rgb-device-tip");
  if(!desc&&!tip)continue;
  const more=document.createElement("details");more.className="rgb-device-more";
  const summary=document.createElement("summary");summary.textContent="Sobre o dispositivo";
  more.append(summary);
  if(desc)more.append(desc);
  if(tip)more.append(tip);
  card.append(more);
 }
 activate(active);
 scope.dataset.asReady="true";
 // Refreshing hardware never changes the currently selected UI area.
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{setupSettings();setupRgb()},{once:true});
else{setupSettings();setupRgb()}
})();
