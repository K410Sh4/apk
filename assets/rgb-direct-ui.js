/* AppSpace RGB Direct: only sends a command after explicit user action. */
(()=>{
"use strict";
const PC=window.AppSpacePC,$=id=>document.getElementById(id);
if(!$("rgb-direct"))return;
let present=false,busy=false;
const controls=["rgb-direct-color","rgb-direct-effect","rgb-direct-profile","rgb-direct-accept"];
function text(id,value){if($(id))$(id).textContent=String(value)}
function sync(){
 const ready=present&&!busy;
 for(const id of controls)$(id).disabled=!ready;
 $("rgb-direct-apply").disabled=!ready||!$("rgb-direct-accept").checked;
 $("rgb-direct-refresh").disabled=busy;
}
async function request(method="GET",payload){
 const local=PC?.isDesktop||location.protocol==="appspace:";
 if(!local)return PC.request("/rgb/direct",payload?{method,data:payload}:{});
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),14000);
 try{
  const response=await fetch("/__api/rgb/direct",{method,
   headers:{"Accept":"application/json",...(payload?{"Content-Type":"application/json"}:{})},
   body:payload?JSON.stringify(payload):undefined,signal:abort.signal,cache:"no-store"});
  let data;try{data=await response.json()}catch(_){data={}}
  if(!response.ok)throw Error(data.error||"Serviço HID indisponível");
  return data;
 }finally{clearTimeout(timeout)}
}
async function refresh(){
 if(busy)return;
 if(!PC?.get?.()){
  text("rgb-direct-status","PC não conectado");
  text("rgb-direct-message","Conecte o computador na pasta Meu PC.");
  return;
 }
 busy=true;present=false;sync();
 text("rgb-direct-status","Verificando HID");
 text("rgb-direct-message","Procurando o mouse Redragon M711 pela interface RGB nativa...");
 try{
  const state=await request();
  present=state.status==="detected"&&state.writable===true;
  text("rgb-direct-status",present?"Interface RGB identificada":state.status==="ambiguous"?"Dispositivo ambíguo":"Não encontrado");
  text("rgb-direct-message",state.reason||"Interface USB não disponível");
 }catch(e){
  text("rgb-direct-status","Driver indisponível");
  text("rgb-direct-message","Não foi possível verificar o HID: "+String(e.message||e).slice(0,155)+". O EXE Windows precisa incluir o driver RGB nativo.");
 }finally{busy=false;sync()}
}
async function apply(){
 if(!present||busy||!$("rgb-direct-accept").checked)return;
 busy=true;sync();text("rgb-direct-message","Enviando comando RGB para o mouse...");
 try{
  const result=await request("POST",{device:"redragon-m711",
   color:$("rgb-direct-color").value,effect:$("rgb-direct-effect").value,
   profile:Number($("rgb-direct-profile").value)});
  if(result.lastAction!=="sent")throw Error("O comando não foi confirmado pelo host");
  text("rgb-direct-message","Comando HID enviado ao mouse. Verifique visualmente se os LEDs mudaram. O perfil selecionado pode não ser o ativo.");
  text("rgb-direct-status","Comando enviado");
 }catch(e){
  text("rgb-direct-message","Não foi possível aplicar: "+String(e.message||e).slice(0,160));
  text("rgb-direct-status","Falha de envio");
 }finally{busy=false;sync()}
}
$("rgb-direct-refresh").addEventListener("click",()=>void refresh());
$("rgb-direct-apply").addEventListener("click",()=>void apply());
$("rgb-direct-accept").addEventListener("change",sync);
sync();void refresh();
})();