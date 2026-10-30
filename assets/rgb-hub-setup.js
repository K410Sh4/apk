/* AppSpace RGB Hub — instalação declarada pelo usuário, armazenamento local somente. */
(()=>{
"use strict";
const model=window.AppSpaceRgbHub;
if(!model)return;
const $=id=>document.getElementById(id);
const KEY="appspace.rgb.hub-setup.v1";
const fields={power:"rgb-hub-power",fanSignal:"rgb-hub-fan",argbSignal:"rgb-hub-argb",coolerPath:"rgb-hub-cooler"};
let saved=model.normalize();
try{saved=model.normalize(JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(_){}
function getForm(){
 const raw={};
 for(const [field,id] of Object.entries(fields))raw[field]=$(id).value;
 return model.normalize(raw);
}
function setForm(profile){
 for(const [field,id] of Object.entries(fields))$(id).value=profile[field];
}
function setText(id,value){const el=$(id);if(el)el.textContent=value}
function render(profile){
 const result=model.assess(profile);
 setText("rgb-hub-argb-status",result.details.light);
 setText("rgb-hub-physical-status",result.details.light);
 setText("rgb-hub-next-step",result.next.join(" "));
 const list=$("rgb-hub-warnings");list.replaceChildren();
 for(const warning of result.warnings){
  const item=document.createElement("li");item.textContent=warning;list.append(item);
 }
 const badge=$("rgb-hub-control-status");
 badge.textContent="Controle físico indisponível";
 badge.dataset.state="missing";
 // Nunca ligar LEDs reais por mudar os campos desta tela.
 $("rgb-hub-form").dataset.hardwareControl="false";
}
function save(profile){
 try{
  localStorage.setItem(KEY,JSON.stringify(profile));
  setText("rgb-hub-saved","Configuração salva neste dispositivo · nenhuma alteração física");
 }catch(_){
  setText("rgb-hub-saved","Não foi possível salvar localmente. Os dados continuam na tela.");
 }
}
function init(){
 if(!$("rgb-hub-form"))return;
 setForm(saved);render(saved);
 $("rgb-hub-form").addEventListener("change",()=>{
  render(getForm());
  setText("rgb-hub-saved","Alterações não salvas · controle RGB físico desabilitado");
 });
 $("rgb-hub-save").addEventListener("click",()=>{
  saved=getForm();save(saved);render(saved);
 });
 $("rgb-hub-reset").addEventListener("click",()=>{
  saved=model.normalize(model.DEFAULTS);setForm(saved);save(saved);render(saved);
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
