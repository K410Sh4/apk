/* AppSpace Meu PC — RGB Inventory V1. Safe client: read-only, textContent only. */
(()=>{
"use strict";
const PC=window.AppSpacePC;
const $=id=>document.getElementById(id);
const rows=[];
const types=["controller","fifine","keyboard","redragon"];
function setText(id,value){if($(id))$(id).textContent=String(value)}
function status(type,present,found){
 const el=document.querySelector('[data-device-status="'+type+'"]');
 if(!el)return;
 el.dataset.state=found?"detected":"missing";
 el.textContent=found?"Detectado":type==="controller"?"Não identificado":"Não encontrado";
 if(present==="unsupported"){el.textContent="A confirmar";el.dataset.state="unknown";}
}
function td(tr,value){
 const cell=document.createElement("td");cell.textContent=String(value||"—");tr.append(cell);
}
function filter(){
 const term=$("rgb-search").value.trim().toLocaleLowerCase("pt-BR");
 const matches=rows.filter(r=>[r.name,r.class,r.vid,r.pid,(r.mi?"MI_"+r.mi:""),r.mi,r.bus,r.type,r.vendorDefined?"HID fornecedor":""].join(" ").toLocaleLowerCase("pt-BR").includes(term));
 const body=$("rgb-results");body.replaceChildren();
 for(const row of matches.slice(0,120)){
  const tr=document.createElement("tr");
  td(tr,row.name);td(tr,(row.vid||"????")+":"+(row.pid||"????"));td(tr,row.mi?"MI_"+row.mi:row.bus||"—");td(tr,row.class+(row.vendorDefined?" · HID fabricante":""));
  body.append(tr);
 }
 if(!matches.length){const tr=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=4;cell.textContent="Nenhuma interface encontrada para a busca.";tr.append(cell);body.append(tr);}
 setText("rgb-count",matches.length+" interface(s) encontradas de "+rows.length+". Busque também por VID, PID ou MI_01.");
}
function render(data){
 rows.length=0;
 const devices=Array.isArray(data.devices)?data.devices:[];
 for(const device of devices){
  const found=Boolean(device.present);status(device.id,null,found);
  const info=(device.vid&&device.pid?device.vid+":"+device.pid:"USB não confirmado")+
    " · "+(device.interfaceCount||0)+" interface(s)"+(device.hasVendorHID?" · HID do fabricante":"");
  setText("rgb-"+device.id+"-detail",info);
  for(const iface of device.interfaces||[]){
   rows.push({...iface,type:device.label,vid:iface.vid||device.vid,pid:iface.pid||device.pid});
  }
 }
 // A controladora pode existir no OpenRGB mesmo quando não aparece no USB.
 const rgb=data.openRGB||{connected:false,devices:[]};
 const sdkDevices=Array.isArray(rgb.devices)?rgb.devices:[];
 if(!devices.find(d=>d.id==="controller")?.present&&sdkDevices.some(d=>/rgb|argb|fan|controller|controlador|motherboard|mainboard/i.test(d.name||""))){
  status("controller",null,true);
  setText("rgb-controller-detail","Possível controladora reconhecida pelo OpenRGB; confirme o modelo no Windows.");
 }
 setText("rgb-openrgb-status",rgb.connected?"SDK local conectado":"SDK não detectado");
 if($("rgb-openrgb-status"))$("rgb-openrgb-status").dataset.state=rgb.connected?"detected":"missing";
 setText("rgb-openrgb-note",rgb.connected?
  "OpenRGB detectado em 127.0.0.1. Dispositivos listados somente para identificação; esta versão não modifica a iluminação.":
  "OpenRGB não está executando um SDK local. Ative-o somente em 127.0.0.1 se desejar uma segunda fonte de identificação.");
 const list=$("rgb-openrgb-list");if(list)list.replaceChildren();
 if(!sdkDevices.length){const li=document.createElement("li");li.textContent="Nenhum dispositivo RGB confirmado pelo SDK.";list?.append(li)}
 for(const item of sdkDevices.slice(0,32)){
   const li=document.createElement("li");li.textContent=String(item.name||"Dispositivo sem nome").slice(0,100);list.append(li);
 }
 const foundCount=devices.filter(d=>d.present).length;
 setText("rgb-alert",data.reason||foundCount+" grupo(s) USB identificados. Controle de LED depende de protocolo validado; leitura não altera hardware.");
 $("rgb-alert").dataset.error=String(Boolean(data.reason));
 filter();
}
// O desktop acessa sua API interna de mesma origem diretamente. Algumas OTAs
// antigas mantêm uma lista de rotas desatualizada em AppSpacePC.request,
// embora o EXE novo já tenha /__api/rgb/devices. Não contornar token no celular.
async function readInventory(){
 if(!PC?.isDesktop&&window.location.protocol!=="appspace:")return PC.request("/rgb/devices");
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),9500);
 try{
  const response=await window.fetch("/__api/rgb/devices",{
   method:"GET",headers:{"Accept":"application/json"},signal:abort.signal,cache:"no-store"
  });
  let data;try{data=await response.json()}catch(_){data={}}
  if(!response.ok)throw Error(data?.error||"API RGB indisponível no EXE (HTTP "+response.status+")");
  return data;
 }finally{clearTimeout(timeout)}
}
let busy=false;
async function refresh(){
 if(busy)return;
 if(!PC?.get?.()){
  setText("rgb-status","PC não conectado");setText("rgb-alert","Conecte o computador na pasta Meu PC para consultar os dispositivos.");return;
 }
 busy=true;$("rgb-refresh").disabled=true;
 setText("rgb-status","Consultando Windows");setText("rgb-alert","Lendo dispositivos USB/HID do computador...");
 try{
   const result=await readInventory();
   if(!result||!Array.isArray(result.devices))throw Error("Resposta de inventário inválida");
   $("rgb-status").dataset.online="true";setText("rgb-status","Windows conectado");render(result);
 }catch(err){
   $("rgb-status").dataset.online="false";setText("rgb-status","Sem inventário");
   $("rgb-alert").dataset.error="true";
   setText("rgb-alert",/404|inexistente|disponível/i.test(String(err.message))?
     "O EXE Windows ainda não possui a API RGB. Instale o EXE atualizado e reabra o AppSpace no computador.":
     "Não foi possível ler os dispositivos: "+String(err.message||err).slice(0,130));
 }finally{busy=false;$("rgb-refresh").disabled=false}
}
function init(){
 $("rgb-refresh")?.addEventListener("click",()=>void refresh());
 $("rgb-search")?.addEventListener("input",filter);
 void refresh();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
