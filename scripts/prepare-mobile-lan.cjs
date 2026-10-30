"use strict";
// Executar após 'cap add/sync android'. Não altera app/ (projeto Samsung).
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error("Versão nativa inválida em package.json");
const [major,minor,patch]=version.split(".").map(Number);
const versionCode=major*1000000+minor*1000+patch;
if(minor>999||patch>999||!Number.isSafeInteger(versionCode)||versionCode<1||versionCode>2100000000)
  throw Error("Versão fora do intervalo permitido para Android");
const gradlePath=path.join(root,"mobile","android","app","build.gradle");
let gradle=fs.readFileSync(gradlePath,"utf8");
if(!/^\s*versionCode\s+\d+\s*$/m.test(gradle)||!/^\s*versionName\s+["'][^"']+["']\s*$/m.test(gradle))
  throw Error("Configuração de versão Android não reconhecida");
gradle=gradle.replace(/^(\s*)versionCode\s+\d+\s*$/m,`$1versionCode ${versionCode}`)
  .replace(/^(\s*)versionName\s+["'][^"']+["']\s*$/m,`$1versionName "${version}"`);
const app=path.join(root,"mobile","android","app","src","main");
const manifestPath=path.join(app,"AndroidManifest.xml");
if(!fs.existsSync(manifestPath))throw Error("AndroidManifest.xml não encontrado. Execute npm run mobile:add.");
let xml=fs.readFileSync(manifestPath,"utf8");
if(!xml.includes("<application"))throw Error("Manifest Android inválido");
if(!xml.includes('android:usesCleartextTraffic='))xml=xml.replace("<application",'<application android:usesCleartextTraffic="true"');
if(!xml.includes('android:networkSecurityConfig='))xml=xml.replace("<application",'<application android:networkSecurityConfig="@xml/appspace_lan_security"');
fs.writeFileSync(manifestPath,xml);
fs.writeFileSync(gradlePath,gradle);
const xmlDir=path.join(app,"res","xml");fs.mkdirSync(xmlDir,{recursive:true});
fs.writeFileSync(path.join(xmlDir,"appspace_lan_security.xml"),
  '<?xml version="1.0" encoding="utf-8"?>\n'+
  '<network-security-config>\n'+
  '  <!-- O app valida IPv4 privada; habilitar HTTP somente para a telemetria LAN. -->\n'+
  '  <base-config cleartextTrafficPermitted="true" />\n'+
  '</network-security-config>\n');
console.log("[AppSpace] HTTP para LAN privada habilitado no APK Android; use somente Wi-Fi de confiança.");

