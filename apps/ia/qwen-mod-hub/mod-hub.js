/* Qwen Mod Hub v0.1 — configuração offline; nunca modifica pesos ou executa código externo. */
(() => {
  "use strict";
  const KEY = "appspace.ia.qwen-mod-hub.v1";
  const HOST_KEY = "appspace.ia.rea-host.v1";
  const IDS = ["think", "memory", "vulkan", "verify"];
  const DEFAULTS = Object.freeze({ schema: 1, target: "qwen2.5-coder-7b-instruct", mods: {think:true,memory:true,vulkan:true,verify:false}, thinkMode:"balanced", contextSize:4096 });
  const el = id => document.getElementById(id);
  let connected = false, applying = false, pending = false;
  let config;
  try { config = normalize(readJSON(KEY)); }
  catch (_) { config = normalize(DEFAULTS); }

  function normalize(raw) {
    const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    if (data.schema != null && data.schema !== 1) throw new Error("Versão de perfil não suportada.");
    if (data.target != null && data.target !== DEFAULTS.target) throw new Error("Modelo-alvo incompatível.");
    const mods = {};
    for (const id of IDS) mods[id] = typeof data.mods?.[id] === "boolean" ? data.mods[id] : DEFAULTS.mods[id];
    return {schema:1,target:DEFAULTS.target,mods,thinkMode:["economy","balanced","deep"].includes(data.thinkMode)?data.thinkMode:DEFAULTS.thinkMode,contextSize:[4096,8192].includes(data.contextSize)?data.contextSize:DEFAULTS.contextSize};
  }
  function readJSON(key) {
    try {return JSON.parse(localStorage.getItem(key)||"null");} catch (_) {return null;}
  }
  function save(key, value) {
    try {localStorage.setItem(key,value);return true;} catch (_) {return false;}
  }
  function message(text, state="neutral") {
    el("ai-feedback").textContent=text;
    el("ai-feedback").dataset.state=state;
  }
  function collect() {
    const mods={};
    for (const id of IDS) mods[id]=Boolean(document.querySelector('[data-mod="'+id+'"]').checked);
    return normalize({schema:1,target:DEFAULTS.target,mods,thinkMode:el("ai-think-mode").value,contextSize:Number(el("ai-context").value)});
  }
  function count() {
    const n=IDS.filter(id=>document.querySelector('[data-mod="'+id+'"]').checked).length;
    el("ai-enabled-count").textContent=n+" módulos no perfil";
  }
  function render() {
    for (const id of IDS) document.querySelector('[data-mod="'+id+'"]').checked=config.mods[id];
    el("ai-think-mode").value=config.thinkMode;
    el("ai-context").value=String(config.contextSize);
    count();
    pending=false;
  }
  function markPending() {
    pending=true;
    connected=false;
    el("ai-apply").disabled=true;
    el("ai-connection-status").textContent="Configuração não aplicada";
    count();
    message("Configuração alterada. Salve o perfil antes de aplicar ao REA.");
  }
  function saveProfile() {
    config=collect();
    if (!save(KEY,JSON.stringify(config))) {message("Falha ao salvar. Armazenamento indisponível.","error");return false;}
    pending=false;
    connected=false;
    el("ai-apply").disabled=true;
    el("ai-connection-status").textContent="Não conectada";
    message("Perfil salvo neste dispositivo. Ainda não foi aplicado ao REA.","success");
    return true;
  }
  function isPrivateHost(h) {
    if (h==="localhost" || h==="127.0.0.1" || h==="[::1]") return true;
    const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if(!m)return false;
    const v=m.slice(1).map(Number);
    if(v.some(n=>n>255))return false;
    return v[0]===10 || (v[0]===172&&v[1]>=16&&v[1]<=31) || (v[0]===192&&v[1]===168) || v[0]===127;
  }
  function validateHost(value) {
    let url;
    try{url=new URL(value.trim());}catch(_){throw new Error("Informe uma URL local válida, como http://127.0.0.1:8765.");}
    if(!["http:","https:"].includes(url.protocol)||!isPrivateHost(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/") throw new Error("Use somente http(s) e um host local/privado, sem caminho ou credenciais.");
    return url.origin;
  }
  async function request(base, route, method, token, payload) {
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),6000);
    try {
      const headers={"Authorization":"Bearer "+token,"Accept":"application/json"};
      if(payload)headers["Content-Type"]="application/json";
      const res=await fetch(base+route,{method,headers,body:payload?JSON.stringify(payload):undefined,signal:ctl.signal,cache:"no-store",credentials:"omit",redirect:"error"});
      if(!res.ok)throw new Error("REA respondeu HTTP "+res.status+".");
      const body=await res.json();
      if(!body||typeof body!=="object")throw new Error("Resposta do agente inválida.");
      return body;
    } catch(e){throw new Error(e.name==="AbortError"?"Tempo limite ao acessar o agente.":e.message||"Falha na conexão.");}
    finally{clearTimeout(timer);}
  }
  async function connect(event) {
    event.preventDefault();
    const token=el("ai-token").value.trim();
    if(!token){message("Informe o token de sessão exibido pelo agente REA.","error");return;}
    let base;
    try{base=validateHost(el("ai-host").value);}catch(e){message(e.message,"error");return;}
    const btn=el("ai-connect");
    btn.disabled=true;connected=false;el("ai-apply").disabled=true;
    message("Verificando agente REA...");
    try {
      const status=await request(base,"/api/v1/status","GET",token);
      if(status.agent!=="rea-qwen-mod-host"||status.apiVersion!==1||status.capabilities?.mods!==true) throw new Error("O serviço respondeu, mas não implementa o protocolo do Qwen Mod Hub v1.");
      connected=true;save(HOST_KEY,base);el("ai-host").value=base;
      el("ai-connection-status").textContent="Agente autenticado";
      el("ai-apply").disabled=pending;
      message("Agente REA autenticado. O perfil ainda não foi aplicado.","success");
    }catch(e){el("ai-connection-status").textContent="Não conectada";message(e.message,"error");}
    finally{btn.disabled=false;}
  }
  async function apply() {
    if(!connected||pending||applying){message("Salve o perfil e teste a conexão antes de aplicar.","error");return;}
    applying=true;el("ai-apply").disabled=true;
    try {
      const body=await request(validateHost(el("ai-host").value),"/api/v1/mods/apply","POST",el("ai-token").value.trim(),{schema:1,profile:config});
      if(body.agent!=="rea-qwen-mod-host"||body.apiVersion!==1||body.applied!==true) throw new Error("Agente não confirmou a aplicação; não considere os mods ativos.");
      message("O agente confirmou a aplicação do perfil. Consulte seus logs para validar cada módulo.","success");
      el("ai-connection-status").textContent="Perfil aplicado";
    }catch(e){message("Aplicação não confirmada: "+e.message,"error");el("ai-connection-status").textContent="Aplicação não confirmada";}
    finally{applying=false;el("ai-apply").disabled=!connected;}
  }
  function exportProfile() {
    if(pending&&!saveProfile())return;
    const body=JSON.stringify(config,null,2)+"\n";
    const url=URL.createObjectURL(new Blob([body],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="qwen-mod-hub-profile.json";document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
    message("Perfil JSON exportado. Nenhum peso/modelo foi alterado.","success");
  }
  async function importProfile(e) {
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    if(file.size>262144){message("Perfil maior que 256 KiB não é aceito.","error");return;}
    try {
      const data=JSON.parse(await file.text());
      const next=normalize(data);
      if(!data||data.schema!==1||data.target!==DEFAULTS.target||!data.mods||typeof data.mods!=="object"||IDS.some(id=>typeof data.mods[id]!=="boolean"))throw new Error("O JSON não contém um perfil válido da versão 1.");
      config=next;render();markPending();
      message("Perfil importado. Revise e clique em Salvar perfil local.","success");
    }catch(err){message("Falha ao importar: "+err.message,"error");}
  }
  function reset() {
    config=normalize(DEFAULTS);render();markPending();
    message("Valores padrão restaurados na tela. Salve para persistir.");
  }
  try{el("ai-host").value=localStorage.getItem(HOST_KEY)||"http://127.0.0.1:8765";}catch(_){el("ai-host").value="http://127.0.0.1:8765";}
  render();
  document.querySelectorAll("[data-mod]").forEach(input=>input.addEventListener("change",markPending));
  el("ai-think-mode").addEventListener("change",markPending);
  el("ai-context").addEventListener("change",markPending);
  el("ai-save").addEventListener("click",saveProfile);
  el("ai-export").addEventListener("click",exportProfile);
  el("ai-import").addEventListener("change",importProfile);
  el("ai-reset").addEventListener("click",reset);
  el("ai-agent-form").addEventListener("submit",connect);
  el("ai-apply").addEventListener("click",apply);
  el("ai-host").addEventListener("input",()=>{connected=false;el("ai-apply").disabled=true;el("ai-connection-status").textContent="Não conectada";});
  el("ai-token").addEventListener("input",()=>{connected=false;el("ai-apply").disabled=true;el("ai-connection-status").textContent="Não conectada";});
})();