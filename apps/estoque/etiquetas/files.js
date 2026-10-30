/* Etiqueta Studio — exportação segura, com Compartilhar nativo no Android.
   Os arquivos temporários NÃO são backups: salve-os usando Arquivos/Drive. */
(function(root){
"use strict";
const MAX_BYTES=24*1024*1024;
function nativePlugins(){
  const cap=root.Capacitor;
  if(!cap?.isNativePlatform?.())return null;
  if(!cap.isPluginAvailable?.("Filesystem")||!cap.isPluginAvailable?.("Share"))
    throw Error("Esta versão do APK não inclui exportação nativa. Atualize o APK antes de salvar.");
  const files=cap.Plugins?.Filesystem||cap.registerPlugin?.("Filesystem");
  const share=cap.Plugins?.Share||cap.registerPlugin?.("Share");
  if(!files?.writeFile||!files?.getUri||!share?.share)throw Error("Serviço de arquivos do Android indisponível");
  return {files,share};
}
function documents(){
  const cap=root.Capacitor;
  if(!cap?.isNativePlatform?.()||!cap.isPluginAvailable?.("LabelDocuments"))return null;
  return cap.Plugins?.LabelDocuments||cap.registerPlugin?.("LabelDocuments")||null;
}
function base64FromBytes(bytes){
  let out="";
  for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(out);
}
async function save(filename,blob){
  if(!(blob instanceof Blob))throw Error("Arquivo inválido");
  if(blob.size>MAX_BYTES)throw Error("Arquivo maior que 24 MB; reduza imagens ou cópias.");
  const clean=String(filename).replace(/[^a-zA-Z0-9_.-]/g,"_").slice(0,100);
  if(!clean||clean==="."||clean==="..")throw Error("Nome de arquivo inválido");
  const docs=documents();
  if(docs?.saveDocument){
    if(blob.size>16*1024*1024)throw Error("O seletor nativo aceita até 16 MB por arquivo.");
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const result=await docs.saveDocument({filename:clean,mimeType:(blob.type||"application/octet-stream").split(";")[0],
      base64:base64FromBytes(bytes)});
    return result?.saved===true?"saved":"cancelled";
  }
  const plugins=nativePlugins();
  if(plugins){
    const bytes=new Uint8Array(await blob.arrayBuffer());
    await plugins.files.writeFile({path:clean,directory:"CACHE",data:base64FromBytes(bytes)});
    const uri=await plugins.files.getUri({path:clean,directory:"CACHE"});
    if(!uri?.uri)throw Error("Não foi possível preparar o arquivo para compartilhar");
    await plugins.share.share({title:"Etiqueta Studio — "+clean,dialogTitle:"Salvar em Arquivos ou Drive",files:[uri.uri]});
    return "shared";
  }
  const url=URL.createObjectURL(blob);
  try{
    const a=document.createElement("a");a.href=url;a.download=clean;document.body.append(a);a.click();a.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),15000);}
  return "downloaded";
}
async function share(filename,blob){
  if(!(blob instanceof Blob)||blob.size>MAX_BYTES)throw Error("Arquivo indisponível para compartilhar.");
  const plugins=nativePlugins();
  if(plugins){
    const clean=String(filename).replace(/[^a-zA-Z0-9_.-]/g,"_").slice(0,100);
    const bytes=new Uint8Array(await blob.arrayBuffer());
    await plugins.files.writeFile({path:clean,directory:"CACHE",data:base64FromBytes(bytes)});
    const uri=await plugins.files.getUri({path:clean,directory:"CACHE"});
    await plugins.share.share({title:"Etiquetas — "+clean,dialogTitle:"Compartilhar etiquetas",files:[uri.uri]});
    return "shared";
  }
  if(navigator?.share && typeof File==="function"){
    const f=new File([blob],filename,{type:blob.type||"application/octet-stream"});
    if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f]});return "shared";}
  }
  return save(filename,blob);
}
async function openText(mimeType="*/*"){
  const docs=documents();
  if(!docs?.openDocument)return undefined; // APK antigo: input[type=file]
  const result=await docs.openDocument({mimeType});
  if(!result?.selected)return null; // Cancelamento nunca sobrescreve o projeto.
  if(typeof result.base64!=="string"||result.base64.length>4*1024*1024+32)
    throw Error("Documento nativo inválido ou muito grande.");
  const raw=atob(result.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return {name:String(result.name||"documento"),text:new TextDecoder("utf-8",{fatal:true}).decode(bytes),
    size:bytes.length};
}
const encoder=new TextEncoder();
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){
  if(!Array.isArray(files)||!files.length||files.length>500)throw Error("Número de páginas inválido");
  const entries=[];let offset=0,bytesTotal=0;
  for(const file of files){
    const name=String(file.name||"").replace(/[^a-zA-Z0-9_.-]/g,"_");
    if(!name||name.length>100)throw Error("Nome de página inválido");
    const n=encoder.encode(name),content=encoder.encode(file.content);
    bytesTotal+=content.length;
    if(bytesTotal>MAX_BYTES)throw Error("Folhas excedem 24 MB; reduza imagens ou cópias.");
    entries.push({name:n,data:content,crc:crc(content),offset});
    offset+=30+n.length+content.length;
  }
  const centralSize=entries.reduce((s,e)=>s+46+e.name.length,0);
  const bytes=new Uint8Array(offset+centralSize+22),v=new DataView(bytes.buffer);let o=0;
  const u16=(n)=>{v.setUint16(o,n,true);o+=2;},u32=(n)=>{v.setUint32(o,n>>>0,true);o+=4;};
  for(const e of entries){
    u32(0x04034b50);u16(20);u16(0);u16(0);u16(0);u16(0);u32(e.crc);u32(e.data.length);u32(e.data.length);
    u16(e.name.length);u16(0);bytes.set(e.name,o);o+=e.name.length;bytes.set(e.data,o);o+=e.data.length;
  }
  const centralStart=o;
  for(const e of entries){
    u32(0x02014b50);u16(20);u16(20);u16(0);u16(0);u16(0);u16(0);u32(e.crc);u32(e.data.length);u32(e.data.length);
    u16(e.name.length);u16(0);u16(0);u16(0);u16(0);u32(0);u32(e.offset);bytes.set(e.name,o);o+=e.name.length;
  }
  u32(0x06054b50);u16(0);u16(0);u16(entries.length);u16(entries.length);u32(o-centralStart);u32(centralStart);u16(0);
  return new Blob([bytes],{type:"application/zip"});
}
root.EtiquetaFiles=Object.freeze({save,share,openText,zip});
})(window);
