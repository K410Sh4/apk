"use strict";

const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {app,BrowserWindow,session,protocol,net}=require("electron");
const {startLanServer}=require("./lan.cjs");
const {createDesktopUpdater}=require("./updates.cjs");
const {CONTENT_SECURITY_POLICY}=require("./security.cjs");

const PORTAL_ROOT=path.resolve(__dirname,"..");
const SCHEME="appspace", HOST="portal";
let updater=null,lan=null;
protocol.registerSchemesAsPrivileged([
  {scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true}}
]);

function originAllowed(request) {
  // Main-frame navigation has no initiatorOrigin; internal APIs always require it.
  return request.initiatorOrigin==="appspace://portal";
}
function json(data,code=200){return new Response(JSON.stringify(data),{status:code,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
async function api(request,url) {
  if(!originAllowed(request))return json({error:"Origem não autorizada"},403);
  const route=url.pathname;
  if(request.method==="GET"){
    if(route==="/__api/desktop")return json({...updater.status(),lan:lan.status()});
    if(route==="/__api/metrics")return json(lan.sample());
  }
  if(request.method==="POST"){
    if(route==="/__api/check")return json(await updater.check());
    if(route==="/__api/install")return json(await updater.install());
    if(route==="/__api/reset")return json(await updater.reset());
  }
  return json({error:"Recurso inexistente"},404);
}
function resolveLocalURL(value){
  try{
    const u=new URL(value);
    if(u.protocol!==SCHEME+":"||u.hostname!==HOST||u.port)return null;
    const relative=decodeURIComponent(u.pathname).replace(/^\/+/,"");
    if(!relative||relative.includes("\\")||relative.includes("\0"))return null;
    return updater.resolve(relative,PORTAL_ROOT);
  }catch(_){return null;}
}
function createWindow(){
  const window=new BrowserWindow({
    width:1240,height:790,minWidth:360,minHeight:500,show:false,
    backgroundColor:"#0b101b",autoHideMenuBar:true,title:"AppSpace",
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:!app.isPackaged}
  });
  window.once("ready-to-show",()=>window.show());
  let recovered=false;
  async function recoverUi(reason){
    console.error("[AppSpace] Falha ao abrir página:",reason);
    if(!window.isVisible())window.show();
    if(recovered||!updater?.status().updated)return;
    recovered=true;
    try{
      // Never retry the same broken OTA bundle indefinitely.
      await updater.reset();
      await window.loadURL(SCHEME+"://"+HOST+"/index.html");
    }catch(error){console.error("[AppSpace] Recuperação falhou:",error);}
  }
  window.webContents.on("did-fail-load",(_e,code,description,_url,isMainFrame)=>{
    if(code!==-3&&isMainFrame!==false)void recoverUi(description);
  });
  window.webContents.on("render-process-gone",(_e,details)=>void recoverUi(details.reason));
  window.webContents.on("did-finish-load",()=>{
    // A pending OTA is accepted only after navigation completes.
    if(updater?.status().pending)void updater.confirmBoot().catch(e=>console.error("[AppSpace] Confirmação OTA:",e));
  });
  window.loadURL(SCHEME+"://"+HOST+"/index.html");
  return window;
}
const isPrimary=app.requestSingleInstanceLock();
if(!isPrimary)app.quit();
else {
  app.on("second-instance",()=>{
    let window=BrowserWindow.getAllWindows()[0];
    if(!window&&app.isReady())window=createWindow();
    if(window){
      if(window.isMinimized())window.restore();
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(()=>{
  updater=createDesktopUpdater(app.getPath("userData"),app.getVersion());
  lan=startLanServer();
  protocol.handle(SCHEME,async request=>{
    try{
      const url=new URL(request.url);
      if(url.hostname!==HOST||url.protocol!==SCHEME+":")return json({error:"Host inválido"},403);
      if(url.pathname.startsWith("/__api/"))return await api(request,url);
      if(request.method!=="GET")return json({error:"Método não permitido"},405);
      const file=resolveLocalURL(request.url);
      if(!file)return new Response("Arquivo não permitido",{status:403});
      const response=await net.fetch(pathToFileURL(file).toString());
      if(path.extname(file).toLowerCase()!==".html")return response;
      const headers=new Headers(response.headers);
      headers.set("Content-Security-Policy",CONTENT_SECURITY_POLICY);
      headers.set("X-Content-Type-Options","nosniff");
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }catch(e){
      console.error("[AppSpace]",e);
      return json({error:String(e.message||"Erro interno").slice(0,180)},500);
    }
  });
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,respond)=>respond(false));
  app.on("web-contents-created",(_event,contents)=>{
    contents.setWindowOpenHandler(()=>({action:"deny"}));
    contents.on("will-navigate",(event,url)=>{if(!resolveLocalURL(url))event.preventDefault();});
  });
  createWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(e=>console.error("[AppSpace] Erro de inicialização",e));
}

app.on("before-quit",()=>{if(lan)lan.stop();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
