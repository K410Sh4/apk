"use strict";

const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {app,BrowserWindow,session,protocol,net}=require("electron");
const {startLanServer}=require("./lan.cjs");
const {createDesktopUpdater}=require("./updates.cjs");

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
    const relative=decodeURIComponent(u.pathname).replace(/^\/+,"");
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
  window.webContents.on("did-fail-load",(_e,code,description)=>{
    console.error("[AppSpace] Falha ao abrir página:",code,description);
    if(!window.isVisible())window.show();
  });
  window.loadURL(SCHEME+"://"+HOST+"/index.html");
  return window;
}
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
      return net.fetch(pathToFileURL(file).toString());
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

app.on("before-quit",()=>{if(lan)lan.stop();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
