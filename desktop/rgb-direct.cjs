"use strict";
/* AppSpace Direct RGB — no OpenRGB server, driver or third-party app.
   User-triggered write, only verified HID VID:PID/interface. Never scan-write. */
const {execFile}=require("node:child_process");
const path=require("node:path");
const MODES=Object.freeze(["static","breathing","rainbow","wave","flashing"]);
function validate(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).some(k=>!["device","color","effect","profile"].includes(k)))
  throw new RangeError("Comando RGB inválido");
 if(data.device!=="redragon-m711")throw new RangeError("Dispositivo sem driver RGB validado");
 if(typeof data.color!=="string"||!/^#[0-9a-fA-F]{6}$/.test(data.color))
  throw new RangeError("Cor RGB inválida");
 if(!MODES.includes(data.effect))throw new RangeError("Efeito não suportado");
 if(!Number.isInteger(data.profile)||data.profile<1||data.profile>5)
  throw new RangeError("Perfil do mouse inválido");
 return {color:data.color.toUpperCase(),effect:data.effect,profile:data.profile};
}
function parse(stdout){
 let x;try{x=JSON.parse(String(stdout).replace(/^\uFEFF/,"").trim())}catch(_){throw Error("Resposta inválida da interface HID")}
 if(!x||typeof x!=="object"||x.device!=="Redragon M711 Cobra (04D9:FC30)"||
    !["detected","not_found","ambiguous"].includes(x.status)||
    typeof x.writable!=="boolean"||typeof x.reason!=="string")
  throw Error("Resposta RGB não reconhecida");
 const n=v=>Number.isInteger(v)&&v>=0&&v<=1024?v:0;
 const diagnostics=(Array.isArray(x.diagnostics)?x.diagnostics:[]).slice(0,24)
  .filter(p=>p&&typeof p==="object"&&!Array.isArray(p))
  .map(p=>({
   number:n(p.number),usagePage:/^0x[0-9A-F]{4}$|^unknown$/.test(p.usagePage)?p.usagePage:"unknown",
   usage:/^0x[0-9A-F]{4}$|^unknown$/.test(p.usage)?p.usage:"unknown",
   featureReportBytes:n(p.featureReportBytes),
   inputReportBytes:n(p.inputReportBytes),
   outputReportBytes:n(p.outputReportBytes),
   outputButtonCaps:n(p.outputButtonCaps),
   outputValueCaps:n(p.outputValueCaps),
   featureButtonCaps:n(p.featureButtonCaps),
   featureValueCaps:n(p.featureValueCaps),
   result:["rgb_candidate","caps_unavailable","different_usage_page","different_report_length","no_feature_report"].includes(p.result)?p.result:"unknown",
   errorCode:Number.isInteger(p.errorCode)?p.errorCode:0
  }));
 return {available:true,device:"redragon-m711",name:x.device,status:x.status,
  writable:x.writable&&x.status==="detected",
  reason:x.reason.slice(0,200),transport:"Windows HID nativo",
  hidCollectionsSeen:n(x.hidCollectionsSeen),targetCollectionsSeen:n(x.targetCollectionsSeen),
  diagnostics,
  effects:MODES,profiles:5,lastAction:x.lastAction==="sent"?"sent":"none"};
}
function createRgbDirect(options={}){
 const platform=options.platform??process.platform;
 const exec=options.execFileFn||execFile;
 const script=options.scriptPath||path.join(__dirname,"rgb-direct.ps1")
  .replace(/([\\/])app\.asar([\\/])/i,"$1app.asar.unpacked$2");
 const now=options.clock||Date.now;
 let cached=null,readPending=null,writing=false,lastWrite=-Infinity;
 function invoke(args){
  return new Promise((resolve,reject)=>{
   exec("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
    "-File",script,...args],{timeout:12500,windowsHide:true,maxBuffer:32768},(e,stdout)=>{
    if(e)return reject(Error("Não foi possível acessar a interface RGB nativa do Windows"));
    try{resolve(parse(stdout))}catch(err){reject(err)}
   });
  });
 }
 async function scan(force=false){
  if(platform!=="win32")return {available:false,writable:false,status:"unsupported",reason:"Disponível no EXE Windows"};
  if(readPending)return readPending;
  if(!force&&cached&&now()-cached.when<3000)return cached.data;
  readPending=invoke(["-Operation","scan"]);
  try{
   const data=await readPending;
   cached={data,when:now()};
   return data;
  }finally{readPending=null}
 }
 async function set(input){
  const data=validate(input);
  if(platform!=="win32")throw Error("Controle RGB nativo disponível apenas no Windows");
  if(writing)throw Error("Comando RGB em andamento");
  if(now()-lastWrite<600)throw Error("Aguarde antes de enviar outro comando RGB");
  writing=true;cached=null;
  try{
   if(readPending)await readPending.catch(()=>{});
   // Never infer from VID/PID alone: native code validates HID usage FFA0 and 16-byte feature report.
   const result=await invoke(["-Operation","set","-Color",data.color,"-Effect",data.effect,"-Profile",String(data.profile)]);
   if(result.lastAction!=="sent")throw Error("O Windows não confirmou o envio HID");
   lastWrite=now();
   return result;
  }finally{writing=false}
 }
 return Object.freeze({scan,set});
}
module.exports={createRgbDirect,validate,parse,MODES};