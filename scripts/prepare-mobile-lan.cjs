"use strict";
// Executar após 'cap add/sync android'. Não altera app/ (projeto Samsung).
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=path.join(root,"mobile","android","app","src","main");
const manifestPath=path.join(app,"AndroidManifest.xml");
if(!fs.existsSync(manifestPath))throw Error("AndroidManifest.xml não encontrado. Execute npm run mobile:add.");
let xml=fs.readFileSync(manifestPath,"utf8");
if(!xml.includes("<application"))throw Error("Manifest Android inválido");
if(!xml.includes('android:usesCleartextTraffic='))xml=xml.replace("<application",'<application android:usesCleartextTraffic="true"');
if(!xml.includes('android:networkSecurityConfig='))xml=xml.replace("<application",'<application android:networkSecurityConfig="@xml/appspace_lan_security"');
fs.writeFileSync(manifestPath,xml);
const xmlDir=path.join(app,"res","xml");fs.mkdirSync(xmlDir,{recursive:true});
fs.writeFileSync(path.join(xmlDir,"appspace_lan_security.xml"),
  '<?xml version="1.0" encoding="utf-8"?>\n'+
  '<network-security-config>\n'+
  '  <!-- O app valida IPv4 privada; habilitar HTTP somente para a telemetria LAN. -->\n'+
  '  <base-config cleartextTrafficPermitted="true" />\n'+
  '</network-security-config>\n');
console.log("[AppSpace] HTTP para LAN privada habilitado no APK Android; use somente Wi-Fi de confiança.");
