/* AppSpace — controles de audio e preferencias padrao do Windows.
 * Estas acoes NAO escrevem comandos RGB, HID ou firmware.
 */
(()=>{
"use strict";
const PC=window.AppSpacePC,$=id=>document.getElementById(id);
if(!$("pc-controls"))return;
let state=null,busy=false;
// O EXE acessa sua API nativa diretamente. Nao depender da allowlist do JS OTA antigo.
async function requestControls(method="GET",data=null){
 if(PC?.isDesktop||window.location.protocol==="appspace:"){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),12000);
  try{
   const response=await window.fetch("/__api/pc/controls",{
    method,headers:{"Accept":"application/json",...(data?{"Content-Type":"application/json"}:{})},
    body:data?JSON.stringify(data):undefined,signal:ac.signal,cache:"no-store"
   });
   let payload;try{payload=await response.json()}catch(_){payload={}}
   if(!response.ok)throw Error(payload.error||"API de controles indisponível ("+response.status+")");
   return payload;
  }finally{clearTimeout(timer)}
 }
 return PC.request("/pc/controls",data?{method,data}:{});
}
const configs=[
 {key:"mic",endpoint:"microphone",action:"micVolume",valueKey:"volume"},
 {key:"speaker",endpoint:"speakers",action:"speakerVolume",valueKey:"volume"},
 {key:"mouse",endpoint:"mouse",action:"mouseSpeed",valueKey:"speed"},
 {key:"keyboard",endpoint:"keyboard",action:"keyboardRepeat",valueKey:"repeat"}
];
function text(id,value){if($(id))$(id).textContent=String(value)}
function setBusy(flag){
 busy=flag;
 for(const button of document.querySelectorAll("#pc-controls button"))button.disabled=flag;
 if(!flag)render();
}
function available(cfg){return Boolean(state?.[cfg.endpoint]?.available)}
function render(){
 for(const cfg of configs){
  const yes=available(cfg),s=state?.[cfg.endpoint],slider=$("pc-"+cfg.key+"-range");
  const current=yes?s[cfg.valueKey]:0;
  if(slider&&!busy){
   slider.disabled=!yes;slider.value=String(current);
  }
  text("pc-"+cfg.key+"-value",yes?current+(cfg.valueKey==="volume"?"%":""):"—");
  const apply=$("pc-"+cfg.key+"-apply");
  if(apply)apply.disabled=busy||!yes;
  text("pc-"+cfg.key+"-status",yes?"Disponível":"Indisponível");
 }
 for(const key of ["mic","speaker"]){
  const cfg=configs.find(c=>c.key===key),s=state?.[cfg.endpoint],btn=$("pc-"+key+"-mute");
  if(!btn)continue;
  btn.disabled=busy||!available(cfg);
  btn.textContent=s?.muted?"Ativar áudio":"Silenciar";
  btn.setAttribute("aria-pressed",String(Boolean(s?.muted)));
 }
 const ok=state?.available===true;
 text("pc-controls-connection",ok?"Controles disponíveis":"Sem acesso");
 $("pc-controls-connection").dataset.state=ok?"detected":"missing";
 $("pc-controls-refresh").disabled=busy;
}
async function refresh(){
 if(busy)return;
 if(!PC?.get?.()){
  text("pc-controls-message","Conecte o PC na pasta Meu PC para acessar os controles.");return;
 }
 setBusy(true);text("pc-controls-message","Consultando configurações do Windows...");
 try{
  const result=await requestControls();
  if(result?.available!==true)throw Error(result?.reason||"EXE não oferece controles");
  state=result;
  text("pc-controls-message","Estado lido do Windows. Apenas as alterações confirmadas por Aplicar ou Silenciar são enviadas.");
 }catch(e){
  state=null;
  text("pc-controls-message","Não foi possível consultar: "+String(e.message||e).slice(0,150)+". Instale o novo EXE Windows se a rota não existir.");
 }finally{setBusy(false)}
}
async function change(action,value){
 if(busy||!state)return;
 setBusy(true);text("pc-controls-message","Aplicando ajuste no Windows...");
 try{
  const result=await requestControls("POST",{action,value});
  if(result?.available!==true)throw Error("Sem confirmação do Windows");
  state=result;text("pc-controls-message","Alteração aplicada no Windows. Os dispositivos RGB permanecem intocados.");
 }catch(e){text("pc-controls-message","Não foi possível alterar: "+String(e.message||e).slice(0,160))}
 finally{setBusy(false)}
}
for(const cfg of configs){
 const slider=$("pc-"+cfg.key+"-range");
 slider?.addEventListener("input",()=>text("pc-"+cfg.key+"-value",slider.value+(cfg.valueKey==="volume"?"%":"")));
 $("pc-"+cfg.key+"-apply")?.addEventListener("click",()=>void change(cfg.action,Number(slider.value)));
}
for(const [key,endpoint,action] of [["mic","microphone","micMute"],["speaker","speakers","speakerMute"]]){
 $("pc-"+key+"-mute")?.addEventListener("click",()=>{
  if(!state?.[endpoint]?.available)return;
  void change(action,state[endpoint].muted?0:1);
 });
}
$("pc-controls-refresh")?.addEventListener("click",()=>void refresh());
render();void refresh();
})();
