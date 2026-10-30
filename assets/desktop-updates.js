/* AppSpace desktop: OTA da interface e status do coletor LAN. */
(()=>{
"use strict";
if(location.protocol!=="appspace:")return;
const byId=id=>document.getElementById(id);
const endpoint="/__api/";
async function call(name,method="GET"){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(endpoint+name,{method,signal:controller.signal,cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Falha na operação");
    return data;
  }finally{clearTimeout(timeout);}
}
function message(text){if(byId("desktop-updates-message"))byId("desktop-updates-message").textContent=text;}
let busy=false;
function lock(value){busy=value;for(const id of ["desktop-ota-check","desktop-ota-install","desktop-ota-reset"]){const el=byId(id);if(el)el.disabled=value;}}
async function status(){
  try{
    const data=await call("desktop");
    if(byId("desktop-version"))byId("desktop-version").textContent=data.currentVersion;
    if(byId("desktop-ota-new"))byId("desktop-ota-new").textContent=data.updated?"OTA ativo":"Web original";
    // Mostra também o IP do adaptador de ancoragem USB, não só o primeiro Wi-Fi.
    const addresses=Array.isArray(data.lan.addresses)?data.lan.addresses:[data.lan.address].filter(Boolean);
    if(byId("desktop-lan-ip"))byId("desktop-lan-ip").textContent=
      addresses.length?addresses.map(ip=>ip+":"+data.lan.port).join(" · "):"sem IPv4 local";
    if(byId("desktop-lan-code"))byId("desktop-lan-code").textContent=data.lan.pin||"—";
    if(byId("desktop-lan-status"))byId("desktop-lan-status").textContent=data.lan.enabled?"Servidor local ativo":data.lan.error||"Servidor indisponível";
    if(byId("desktop-lan-details"))byId("desktop-lan-details").hidden=false;
    if(byId("desktop-updates"))byId("desktop-updates").hidden=false;
  }catch(e){message("Não foi possível ler as informações do Windows: "+e.message);}
}
async function check(){
  lock(true);message("Verificando atualizações web no GitHub…");
  try{
    const result=await call("check","POST");
    if(result.requiresExe)message("Esta atualização exige um executável mais novo.");
    else if(result.available){
      message("Nova versão web "+result.version+" disponível. "+(result.notes||""));
      if(byId("desktop-ota-install"))byId("desktop-ota-install").hidden=false;
    }else{
      message("Nenhuma nova atualização web.");
      if(byId("desktop-ota-install"))byId("desktop-ota-install").hidden=true;
    }
  }catch(e){message("Verificação indisponível: "+e.message);}finally{lock(false);}
}
async function install(){
  lock(true);message("Baixando, verificando e instalando arquivos web…");
  try{
    const data=await call("install","POST");
    if(data.updated){message("Atualização "+data.version+" instalada. Recarregando…");location.reload();}
    else message("Você já possui a versão mais recente.");
  }catch(e){message("Atualização cancelada: "+e.message);}finally{lock(false);}
}
async function reset(){
  lock(true);
  try{await call("reset","POST");message("Restaurando arquivos originais…");location.reload();}
  catch(e){message("Falha: "+e.message);}finally{lock(false);}
}
document.addEventListener("DOMContentLoaded",()=>{
  void status();
  byId("desktop-ota-check")?.addEventListener("click",()=>void check());
  byId("desktop-ota-install")?.addEventListener("click",()=>void install());
  byId("desktop-ota-reset")?.addEventListener("click",()=>void reset());
});
})();
