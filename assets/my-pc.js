/* Meu PC · interface de pareamento única. Todas as aplicações usam AppSpacePC. */
(()=>{
"use strict";
const PC=window.AppSpacePC;
if(!PC)throw Error("AppSpacePC não carregado");
const $=id=>document.getElementById(id);
let transport="wifi",switching=false,busy=false,generation=0;
function setBusy(value){
 busy=value;$("mypc-submit").disabled=value;$("mypc-test").disabled=value;
}
function openConnection(){const panel=$("mypc-connection-panel");if(panel)panel.open=true;}
const instructions={
 wifi:"Use o IP e o código exibidos em Configurações do AppSpace no Windows. Ambos na mesma rede Wi-Fi.",
 usb:"Conecte o cabo USB e ative Ancoragem USB no Android. O Windows criará um adaptador de rede; copie o IP dele em Configurações do AppSpace."
};
const help={
 wifi:"Abra o AppSpace EXE no Windows → Configurações → Conexão local. Digite o IP e o código de 6 dígitos. O EXE deve permanecer aberto. Não utilize redes públicas.",
 usb:"1. Conecte o Android ao Windows com cabo de dados. 2. No celular, ative Ancoragem USB / Roteador USB (em Rede e Internet). 3. Aguarde o adaptador de rede aparecer no Windows. 4. No EXE AppSpace, em Configurações, identifique o IP do adaptador USB e copie o código de 6 dígitos. 5. Preencha os dados aqui. Apenas conectar o cabo no modo carregamento/MTP não cria comunicação TCP; este modo usa ancoragem de rede, não ADB."
};
function message(text,error=false){
 const el=$("mypc-feedback");el.textContent=text;el.dataset.error=String(error);
}
function setMethod(type){
 transport=type==="usb"?"usb":"wifi";
 for(const button of document.querySelectorAll("[data-transport]"))
   button.setAttribute("aria-pressed",String(button.dataset.transport===transport));
 $("mypc-instructions").textContent=instructions[transport];
 $("mypc-help-content").textContent=help[transport];
}
function show(){
 const session=PC.get();
 $("mypc-connected").hidden=!session;
 $("mypc-setup").hidden=Boolean(session)&&!switching;
 $("mypc-cancel").hidden=!switching;
 $("mypc-status").textContent=session?"Pareado":"Não conectado";
 $("mypc-status").dataset.online="false";
 if(session){
   $("mypc-host").textContent=session.hostname||"Meu computador";
   $("mypc-address").textContent=PC.isDesktop?"Conexão local":session.ip+" · "+(session.transport==="usb"?"USB":"Wi-Fi");
   $("mypc-ip").value=PC.isDesktop?"":session.ip;
   if(!switching)setMethod(session.transport);
 }
 $("mypc-code").value="";
 $("mypc-submit").textContent=switching?"Aplicar endereço":"Conectar";
 if(PC.isDesktop){
   $("mypc-connected").hidden=false;
   $("mypc-setup").hidden=true;
   $("mypc-change").hidden=true;
   $("mypc-disconnect").hidden=true;
 }
}
async function check(){
 const session=generation;
 const result=await PC.check();
 if(session!==generation)return;
 $("mypc-status").textContent="Online";
 $("mypc-status").dataset.online="true";
 if(result.hostname)$("mypc-host").textContent=result.hostname;
 message("Computador acessível.");
}
async function run(action){
 if(busy)return;
 const session=generation;setBusy(true);
 try{await action();}
 catch(e){
   if(session!==generation)return;
   openConnection();
   $("mypc-status").textContent=PC.get()?"Sem sinal":"Não conectado";
   $("mypc-status").dataset.online="false";
   message(e.message||"Não foi possível conectar",true);
 }finally{if(session===generation)setBusy(false);}
}
function init(){
 for(const button of document.querySelectorAll("[data-transport]"))
   button.addEventListener("click",()=>setMethod(button.dataset.transport));
 $("mypc-form").addEventListener("submit",event=>{
   event.preventDefault();
   const ip=$("mypc-ip").value.trim(),code=$("mypc-code").value.trim(),method=transport;
   const session=generation;
   void run(async()=>{
     if(switching&&PC.get()&&!code){
       try{await PC.changeAddress(ip,method);}
       catch(_){throw Error("Não foi possível reutilizar o pareamento. Informe o código de 6 dígitos do EXE.");}
     }else{
       await PC.pair(ip,code,method);
     }
     if(session!==generation)return;
     switching=false;show();await check();
     if(session===generation&&$("mypc-connection-panel"))$("mypc-connection-panel").open=false;
   });
 });
 $("mypc-test").addEventListener("click",()=>void run(check));
 $("mypc-change").addEventListener("click",()=>{
   if(busy)return;
   switching=true;show();
   message("Altere o IP e, se necessário, informe o código do computador.");
   $("mypc-ip").focus();
 });
 $("mypc-cancel").addEventListener("click",()=>{switching=false;show();message("");});
 $("mypc-disconnect").addEventListener("click",()=>{
   if(!window.confirm("Desconectar Meu PC? Os aplicativos deixarão de acessar este computador."))return;
   generation++;setBusy(false);PC.disconnect();switching=false;show();message("Pareamento removido deste dispositivo.");
 });
 $("mypc-monitor-link").addEventListener("click",event=>{
   if(!PC.get()){
     event.preventDefault();
     openConnection();
     message("Conecte o computador para abrir o monitor.",true);
     $("mypc-ip").focus();
   }
 });
 const params=new URLSearchParams(location.search);
 if(params.get("connection")==="lost"){openConnection();message("O computador não respondeu. Confira o cabo/rede e toque em Testar conexão.",true);}
 window.addEventListener("pagehide",()=>{generation++;setBusy(false);PC.cancelPending();});
 window.addEventListener("pageshow",event=>{if(event.persisted){show();if(PC.get())void run(check);}});
 show();
 if(PC.get()&&!params.has("connection"))void run(check);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
