"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"assets/pc-connection.js"),"utf8");
const token="a".repeat(64);
function setup(legacy={},handler){
 const entries=new Map(Object.entries(legacy)),requests=[];
 const store={getItem:key=>entries.get(key)||null,setItem:(k,v)=>entries.set(k,v),removeItem:key=>entries.delete(key)};
 const fetch=async(url,opts={})=>{
   requests.push({url,headers:opts.headers,method:opts.method});
   const payload=handler?await handler(url,opts):url.endsWith("/pair")?{token,host:"PC-Teste"}:{
     hostname:"PC-Teste",cpu:{percent:17},memory:{percent:32}};
   if(payload?.error)return {ok:false,status:401,json:async()=>payload};
   return {ok:true,status:200,json:async()=>payload};
 };
 const sandbox={location:{protocol:"https:"},localStorage:store,fetch,
   setTimeout:()=>1,clearTimeout(){},AbortController,console};
 vm.runInNewContext(src,sandbox,{filename:"pc-connection.js"});
 return {api:sandbox.AppSpacePC,entries,requests};
}
(async()=>{
 const legacy={"appspace.pcmonitor.v1":JSON.stringify({ip:"192.168.1.10",token})};
 const old=setup(legacy);
 assert.equal(old.api.get().ip,"192.168.1.10","Legacy monitor pairing migrated");
 assert.ok(old.entries.has("appspace.pc.connection.v1"));
 assert.ok(!old.entries.has("appspace.pcmonitor.v1"));
 assert.equal((await old.api.check()).cpu.percent,17);
 const b=setup();
 await b.api.pair("192.168.1.15","123456","wifi");
 assert.equal(b.api.get().transport,"wifi");
 assert.equal(b.api.get().hostname,"PC-Teste");
 assert.equal(b.requests.length,2,"Pair code then authorized measurements");
 assert.equal(b.requests[1].headers.Authorization,"Bearer "+token);
 await b.api.changeAddress("192.168.42.25","usb");
 assert.equal(b.api.get().transport,"usb","USB tethering reuses same pairing");
 assert.equal(b.api.get().ip,"192.168.42.25");
 assert.equal(b.requests.length,3,"USB switch must validate token without new pairing");
 assert.equal(b.requests[2].headers.Authorization,"Bearer "+token);
 assert.match(b.requests[2].url,/192\.168\.42\.25:38473/);
 await assert.rejects(()=>b.api.pair("8.8.8.8","123456","wifi"),/IP inválido/);
 await assert.rejects(()=>b.api.pair("192.168.1.1","bad","wifi"),/código/);
 await assert.rejects(()=>b.api.request("/danger"),/Rota não autorizada/);
 const rejected=setup({"appspace.pc.connection.v1":JSON.stringify({ip:"192.168.1.10",token})},
   async (url)=>url.includes("192.168.43.2")?{error:"Unauthorized"}:{cpu:{},memory:{}});
 await assert.rejects(()=>rejected.api.changeAddress("192.168.43.2","usb"));
 assert.equal(rejected.api.get().ip,"192.168.1.10","Unverified address must not overwrite session");
 b.api.disconnect();
 assert.equal(b.api.get(),null,"Disconnect removes all access");
 assert.equal(b.entries.size,0);
 const html=fs.readFileSync(path.join(root,"apps/meu-pc/index.html"),"utf8");
 const monitor=fs.readFileSync(path.join(root,"apps/meu-pc/monitor/index.html"),"utf8");
 for(const value of ['data-transport="usb"','data-transport="wifi"','id="mypc-form"','id="mypc-monitor-link"','id="mypc-rgb-link"'])assert.ok(html.includes(value));
 assert.ok(monitor.includes('assets/pc-connection.js'));
 assert.ok(!monitor.includes('id="monitor-pair-form"'));
 assert.ok(fs.readFileSync(path.join(root,"assets/my-pc.js"),"utf8").includes("Ancoragem USB"));
 console.log("[Meu PC] Migração, Wi-Fi, USB, token único, proteção e monitor compartilhado: OK");
})().catch(error=>{console.error(error);process.exitCode=1});

// Respostas atrasadas nunca podem recriar uma sessão removida pelo usuário.
(async()=>{
 let finish;
 const delayed=new Promise(resolve=>{finish=resolve;});
 const pending=setup({},async url=>url.endsWith('/pair')?delayed:{cpu:{},memory:{}});
 const pairing=pending.api.pair('192.168.1.15','123456');
 pending.api.disconnect();finish({token,host:'PC-Teste'});
 await assert.rejects(pairing,/cancelada/);
 assert.equal(pending.api.get(),null);
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const changed=setup({'appspace.pc.connection.v1':JSON.stringify({ip:'192.168.1.10',token})},()=>waiting);
 const switching=changed.api.changeAddress('192.168.1.20','usb');
 changed.api.disconnect();release({cpu:{},memory:{}});
 await assert.rejects(switching,/cancelada/);
 assert.equal(changed.api.get(),null);
 console.log('[Meu PC] Desconexão durante pareamento e troca de rede: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
