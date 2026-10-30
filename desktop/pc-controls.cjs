"use strict";
/* AppSpace PC controls — only supported Windows user settings.
 * Never opens raw USB/HID devices, changes drivers or addresses RGB hardware.
 */
const path=require("node:path");
const {execFile}=require("node:child_process");

const LIMITS=Object.freeze({
 micMute:[0,1],speakerMute:[0,1],
 micVolume:[0,100],speakerVolume:[0,100],
 mouseSpeed:[1,20],keyboardRepeat:[0,31]
});
const ALLOWED=new Set(Object.keys(LIMITS));
function validateChange(action,value){
 if(typeof action!=="string"||!ALLOWED.has(action))throw new RangeError("Controle não permitido");
 if(!Number.isInteger(value)||value<LIMITS[action][0]||value>LIMITS[action][1])
  throw new RangeError("Valor fora do intervalo permitido");
 return {action,value};
}
function normalizeAudio(data){
 if(!data||data.available!==true)return {available:false,volume:0,muted:false};
 if(typeof data.muted!=="boolean"||!Number.isInteger(data.volume)||data.volume<0||data.volume>100)
  throw Error("Estado de áudio inválido");
 return {available:true,volume:data.volume,muted:data.muted};
}
function parseState(raw){
 let data;try{data=JSON.parse(String(raw).replace(/^\uFEFF/,"").trim())}catch(_){throw Error("Resposta inválida do Windows")}
 if(!data||data.available!==true||data.scope!=="windows-defaults")throw Error("Controle Windows indisponível");
 const mouseAvailable=data.mouseAvailable===true,keyboardAvailable=data.keyboardAvailable===true;
 if(mouseAvailable&&(!Number.isInteger(data.mouseSpeed)||data.mouseSpeed<1||data.mouseSpeed>20))
  throw Error("Velocidade do ponteiro inválida");
 if(keyboardAvailable&&(!Number.isInteger(data.keyboardRepeat)||data.keyboardRepeat<0||data.keyboardRepeat>31))
  throw Error("Velocidade de repetição inválida");
 return {
  available:true,scope:"windows-defaults",
  microphone:normalizeAudio(data.microphone),speakers:normalizeAudio(data.speakers),
  mouse:{available:mouseAvailable,speed:mouseAvailable?data.mouseSpeed:null},
  keyboard:{available:keyboardAvailable,repeat:keyboardAvailable?data.keyboardRepeat:null},
  note:"Áudio padrão e configurações globais do Windows; não são controles RGB."
 };
}
function createWindowsControls(options={}){
 const platform=options.platform??process.platform;
 const runner=options.execFileFn||execFile;
 const script=options.scriptPath||path.join(__dirname,"pc-controls.ps1")
  .replace(/([\\/])app\.asar([\\/])/i,"$1app.asar.unpacked$2");
 const now=options.clock||Date.now;
 let cache=null,last=0,pending=null,writing=false;
 function invoke(operation,action="",value=0){
  return new Promise((resolve,reject)=>{
   const args=["-NoLogo","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
    "-File",script,"-Operation",operation,"-Setting",action,"-Value",String(value)];
   runner("powershell.exe",args,{timeout:10000,maxBuffer:128*1024,windowsHide:true},
    (err,stdout)=>{
     if(err)return reject(Error("Windows não respondeu ao controle solicitado"));
     try{resolve(parseState(stdout))}catch(e){reject(e)}
    });
  });
 }
 async function read(force=false){
  if(platform!=="win32")return {available:false,reason:"Disponível apenas no EXE Windows"};
  if(pending)return pending;
  if(!force&&cache&&now()-last<1500)return cache;
  pending=invoke("read");
  try{cache=await pending;last=now();return cache}finally{pending=null}
 }
 async function write(action,value){
  validateChange(action,value);
  if(platform!=="win32")throw Error("Controle disponível apenas no Windows");
  if(writing)throw Error("Aguarde a conclusão do controle anterior");
  writing=true;cache=null;last=0;
  try{
   const state=await invoke("write",action,value);
   cache=state;last=now();return state;
  }finally{writing=false}
 }
 return Object.freeze({read,write});
}
module.exports={createWindowsControls,parseState,validateChange,LIMITS};
