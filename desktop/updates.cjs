"use strict";
/* Desktop web OTA: somente releases HTTPS do projeto, SHA-256, extração controlada. */
const fs=require("node:fs");
const fsp=require("node:fs/promises");
const path=require("node:path");
const crypto=require("node:crypto");
const extract=require("extract-zip");
const MANIFEST="https://raw.githubusercontent.com/K410Sh4/apk/main/ota/latest.json";
const zipPattern=/^https:\/\/github\.com\/K410Sh4\/apk\/releases\/download\/appspace-web-v(\d+\.\d+\.\d+)\/appspace-web-v\1\.zip$/;
const semver=/^\d+\.\d+\.\d+$/;
function cmp(a,b){if(!semver.test(a)||!semver.test(b))throw Error("Versão inválida");const x=a.split(".").map(Number),y=b.split(".").map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0;}
async function download(url,limit){
  const resp=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:"follow",headers:{"User-Agent":"AppSpace/0.6"}});
  if(!resp.ok)throw Error("Falha HTTP "+resp.status);
  const parts=[];let total=0;
  for await (const chunk of resp.body){total+=chunk.length;if(total>limit)throw Error("Pacote excede tamanho permitido");parts.push(chunk);}
  return Buffer.concat(parts);
}
function contains(root,file){const rel=path.relative(root,file);return rel&&!rel.startsWith(".."+path.sep)&&rel!==".."&&!path.isAbsolute(rel);}
function validateManifest(m){
  if(!m||m.schema!==1||!semver.test(m.version||"")||!semver.test(m.minNative||"")||
    !zipPattern.test(m.url||"")||!new RegExp("appspace-web-v"+m.version.replace(/\./g,"\\.")+"\\.zip$").test(m.url)||
    !/^[a-f0-9]{64}$/.test(m.sha256||""))throw Error("Manifesto OTA inválido");
  return m;
}
async function validateDirectory(root){
  let files=0,bytes=0;const allowed=/\.(?:html|css|js|json|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|txt|wasm)$/i;
  async function walk(dir){
    for(const e of await fsp.readdir(dir,{withFileTypes:true})){
      const f=path.join(dir,e.name);if(e.isSymbolicLink())throw Error("Link simbólico não permitido");
      if(e.isDirectory()){if(!contains(root,f))throw Error("Pasta fora do pacote");await walk(f);continue;}
      if(!e.isFile()||!allowed.test(e.name))throw Error("Tipo de arquivo não permitido");
      const stat=await fsp.stat(f);files++;bytes+=stat.size;
      if(files>1000||bytes>35*1024*1024||stat.size>8*1024*1024)throw Error("Pacote excessivamente grande");
    }
  }
  await walk(root);
  for(const must of ["index.html","configuracoes.html","assets/portal.js","assets/ota.js"]){
    if(!(await fsp.stat(path.join(root,must)).catch(()=>null))?.isFile())throw Error("Pacote incompleto: "+must);
  }
}
function createDesktopUpdater(userData,builtinVersion){
  const root=path.join(userData,"web-updates");
  const activeFile=path.join(root,"active.json");
  let active=null;
  try{
    const x=JSON.parse(fs.readFileSync(activeFile,"utf8"));
    if(semver.test(x.version)&&x.version.length<20&&cmp(x.version,builtinVersion)>0){
      const folder=path.join(root,"v"+x.version);
      if(fs.existsSync(path.join(folder,"index.html")))active={version:x.version,folder};
    }
  }catch(_){}
  let busy=false;
  const status=()=>({platform:"windows",nativeVersion:builtinVersion,currentVersion:active?.version||builtinVersion,updated:Boolean(active),busy});
  async function check(){
    const m=validateManifest(JSON.parse((await download(MANIFEST,16000)).toString("utf8")));
    if(cmp(m.version,status().currentVersion)<=0)return {available:false,version:status().currentVersion};
    if(cmp(builtinVersion,m.minNative)<0)return {available:false,requiresExe:true,version:m.version};
    return {available:true,version:m.version,notes:String(m.notes||"").slice(0,200)};
  }
  async function install(){
    if(busy)throw Error("Outra atualização está em andamento");
    busy=true;
    let staging=null;
    try{
      const m=validateManifest(JSON.parse((await download(MANIFEST,16000)).toString("utf8")));
      if(cmp(m.version,status().currentVersion)<=0)return {updated:false};
      if(cmp(builtinVersion,m.minNative)<0)throw Error("Esta versão exige um EXE mais novo.");
      const zipped=await download(m.url,20*1024*1024);
      const digest=crypto.createHash("sha256").update(zipped).digest("hex");
      if(digest!==m.sha256)throw Error("Falha na integridade SHA-256");
      await fsp.mkdir(root,{recursive:true});
      staging=path.join(root,"staging-"+crypto.randomBytes(8).toString("hex"));
      await fsp.mkdir(staging);
      const zippedPath=path.join(root,"tmp-"+crypto.randomBytes(8).toString("hex")+".zip");
      try{
        await fsp.writeFile(zippedPath,zipped);
        await extract(zippedPath,{dir:staging});
      }finally{await fsp.rm(zippedPath,{force:true});}
      await validateDirectory(staging);
      const dst=path.join(root,"v"+m.version);
      await fsp.rm(dst,{recursive:true,force:true});
      await fsp.rename(staging,dst);staging=null;
      const tmp=activeFile+".tmp";
      await fsp.writeFile(tmp,JSON.stringify({version:m.version})+"\n");
      await fsp.rename(tmp,activeFile);
      active={version:m.version,folder:dst};
      return {updated:true,version:m.version,restartRequired:true};
    }finally{if(staging)await fsp.rm(staging,{recursive:true,force:true});busy=false;}
  }
  async function reset(){
    if(busy)throw Error("Outra atualização está em andamento");
    busy=true;
    try{
      await fsp.rm(activeFile,{force:true});
      active=null;
      return {ok:true,restartRequired:true};
    }finally{busy=false;}
  }
  function resolve(relative,builtinFolder){
    if(!/^[a-zA-Z0-9][a-zA-Z0-9/._-]{0,256}$/.test(relative)||relative.split("/").includes(".."))return null;
    const bundled=path.join(builtinFolder,relative);
    if(active){
      const updated=path.resolve(active.folder,relative);
      if(contains(active.folder,updated)&&fs.existsSync(updated))return updated;
    }
    return contains(builtinFolder,bundled)?bundled:null;
  }
  return {status,check,install,reset,resolve};
}
module.exports={createDesktopUpdater};

