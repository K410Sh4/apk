/* AppSpace · Meu PC — conexão única para aplicativos de computador.
   Wi-Fi e ancoragem USB usam a API LAN existente. Sem descoberta externa.
   A origem do token sempre é o pareamento por código exibido no EXE. */
(function(root,factory){
 "use strict";
 const api=factory(root);
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.AppSpacePC=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
 "use strict";
 const KEY="appspace.pc.connection.v1",LEGACY="appspace.pcmonitor.v1",PORT=38473;
 let generation=0;
 function cancelPending(){generation++;}
 const desktop=root.location?.protocol==="appspace:";
 const capacitor=root.Capacitor;
 const native=Boolean(capacitor?.isNativePlatform?.());
 function ipv4(value){
   const s=String(value||"").trim();
   if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s))return false;
   const p=s.split(".").map(Number);
   if(p.some(n=>n>255))return false;
   return p[0]===10||(p[0]===192&&p[1]===168)||
     (p[0]===172&&p[1]>=16&&p[1]<=31);
 }
 function validToken(t){return typeof t==="string"&&/^[a-f0-9]{64}$/.test(t);}
 function parse(s){
   if(!s||typeof s!=="object"||!ipv4(s.ip)||!validToken(s.token))return null;
   return {ip:s.ip,token:s.token,transport:s.transport==="usb"?"usb":"wifi",
     hostname:String(s.hostname||"Computador").slice(0,90)};
 }
 function storage(){
   try{return root.localStorage}catch(_){return null;}
 }
 function get(){
   if(desktop)return {ip:"local",token:"",transport:"desktop",hostname:"Este computador"};
   const store=storage();if(!store)return null;
   try{
     const current=parse(JSON.parse(store.getItem(KEY)||"null"));
     if(current)return current;
     const prior=parse(JSON.parse(store.getItem(LEGACY)||"null"));
     if(prior){
       // Só descartar o legado após salvar a migração com sucesso.
       store.setItem(KEY,JSON.stringify(prior));
       store.removeItem(LEGACY);
       return prior;
     }
   }catch(_){}
   return null;
 }
 function remember(state){
   const sanitized=parse(state);if(!sanitized)throw Error("Pareamento inválido");
   try{
     const store=storage();
     if(!store)throw Error("Armazenamento não disponível");
     store.setItem(KEY,JSON.stringify(sanitized));
     store.removeItem(LEGACY);
   }catch(_){throw Error("Não foi possível salvar a conexão no celular");}
   return sanitized;
 }
 function disconnect(){
   cancelPending();
   try{storage()?.removeItem(KEY);storage()?.removeItem(LEGACY)}catch(_){}
 }
 async function request(path,options={}){
   if(!["/metrics","/pair","/health"].includes(path))throw Error("Rota não autorizada");
   const method=options.method||"GET";
   if(method!==(path==="/pair"?"POST":"GET"))throw Error("Método não permitido");
   const target=options.endpoint||get();
   if(!desktop&&!ipv4(target?.ip))throw Error("Informe um IP de rede local válido");
   const address=desktop?(path==="/metrics"?"/__api/metrics":"/__api/desktop"):
     "http://"+target.ip+":"+PORT+path;
   const headers={"Accept":"application/json"};
   if(options.data)headers["Content-Type"]="application/json";
   if(path==="/metrics"&&!desktop){
     if(!validToken(target.token))throw Error("Conecte o computador em Meu PC");
     headers["Authorization"]="Bearer "+target.token;
   }
   const plugin=capacitor?.Plugins?.CapacitorHttp;
   if(native&&!desktop&&typeof plugin?.request==="function"){
     const result=await plugin.request({url:address,method,headers,
       data:options.data||undefined,connectTimeout:4000,readTimeout:4000});
     let payload=result.data;
     if(typeof payload==="string"){try{payload=JSON.parse(payload)}catch(_){}}
     if(result.status<200||result.status>=300)throw Error(payload?.error||"HTTP "+result.status);
     return payload;
   }
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),4000);
   try{
     const response=await root.fetch(address,{method,headers,
       body:options.data?JSON.stringify(options.data):undefined,
       signal:ctrl.signal,cache:"no-store"});
     let payload;try{payload=await response.json()}catch(_){payload={}}
     if(!response.ok)throw Error(payload?.error||"HTTP "+response.status);
     return payload;
   }finally{clearTimeout(timeout)}
 }
 async function pair(ip,code,transport="wifi"){
   if(desktop)throw Error("O computador já está conectado localmente");
   ip=String(ip||"").trim();code=String(code||"").trim();
   if(!ipv4(ip))throw Error("IP inválido. Consulte o endereço no AppSpace do Windows.");
   if(!/^\d{6}$/.test(code))throw Error("Informe o código de seis dígitos do Windows.");
   const session=++generation;
   const result=await request("/pair",{method:"POST",data:{code},endpoint:{ip}});
   if(session!==generation)throw Error("Conexão cancelada");
   if(!validToken(result?.token))throw Error("Resposta de pareamento inválida");
   const candidate={ip,token:result.token,hostname:result.host||"Computador",transport};
   // Exigir confirmação com token antes de salvar a sessão compartilhada.
   const metrics=await request("/metrics",{endpoint:candidate});
   if(!metrics?.cpu||!metrics?.memory)throw Error("PC não retornou medições válidas");
   if(session!==generation)throw Error("Conexão cancelada");
   return remember(candidate);
 }
 async function check(){
   const current=get();
   if(!current)throw Error("Conecte o computador em Meu PC");
   const data=await request("/metrics",{endpoint:current});
   if(!data?.cpu||!data?.memory)throw Error("Medições do computador inválidas");
   return data;
 }
 async function changeAddress(ip,transport){
   if(desktop)throw Error("Endereço local fixo");
   const current=get();if(!current)throw Error("Nenhum computador pareado");
   if(!ipv4(ip))throw Error("IP de rede local inválido");
   const session=++generation;
   const candidate={...current,ip:String(ip).trim(),transport};
   // Somente mantemos o mesmo token se o novo endereço prova possuir a sessão.
   const measurement=await request("/metrics",{endpoint:candidate});
   if(!measurement?.cpu||!measurement?.memory)throw Error("Computador não respondeu");
   if(session!==generation)throw Error("Conexão cancelada");
   return remember(candidate);
 }
 return Object.freeze({get,request,pair,check,changeAddress,disconnect,cancelPending,ipv4,
   storageKey:KEY,legacyKey:LEGACY,isDesktop:desktop});
});
