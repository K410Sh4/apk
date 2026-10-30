/* Qwen Mod Hub v0.1 — configuração offline; nunca modifica pesos ou executa código externo. */
(() => {
  "use strict";
  const KEY = "appspace.ia.qwen-mod-hub.v1";
  const HOST_KEY = "appspace.ia.rea-host.v1";
  const IDS = ["think", "memory", "vulkan", "verify"];
  const DEFAULTS = Object.freeze({ schema: 1, target: "qwen2.5-coder-7b-instruct", mods: {think:true,memory:false,vulkan:false,verify:false}, thinkMode:"balanced", contextSize:4096 });
  const el = id => document.getElementById(id);
  let connected = false, applying = false, pending = false, modelReady = false;
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
    el("ai-chat-send").disabled=true;
    el("ai-clear-memory").disabled=true;
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
    el("ai-chat-send").disabled=true;
    el("ai-clear-memory").disabled=true;
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
  async function request(base, route, method, token, payload, timeoutMs=6000) {
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),timeoutMs);
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
      connected=true;modelReady=Boolean(status.model?.ready);
      save(HOST_KEY,base);el("ai-host").value=base;
      el("ai-connection-status").textContent=modelReady?"Agente e Qwen online":"Agente online · Qwen offline";
      el("ai-apply").disabled=pending;
      el("ai-chat-send").disabled=true;
      el("ai-clear-memory").disabled=false;
      message(modelReady?"Agente autenticado e Qwen disponível. Aplique o perfil antes de testar.":"Agente autenticado, mas o llama-server do Qwen não respondeu. É possível aplicar o perfil; para conversar inicie o modelo.","success");
    }catch(e){el("ai-connection-status").textContent="Não conectada";message(e.message,"error");}
    finally{btn.disabled=false;}
  }
  async function apply() {
    if(!connected||pending||applying){message("Salve o perfil e teste a conexão antes de aplicar.","error");return;}
    applying=true;el("ai-apply").disabled=true;
    try {
      const body=await request(validateHost(el("ai-host").value),"/api/v1/mods/apply","POST",el("ai-token").value.trim(),{schema:1,profile:config});
      if(body.agent!=="rea-qwen-mod-host"||body.apiVersion!==1||body.applied!==true) throw new Error("Agente não confirmou a aplicação; não considere os mods ativos.");
      modelReady=Boolean(body.modelReady);
      el("ai-chat-send").disabled=!modelReady;
      const vulkan=body.moduleStatus?.vulkan?.state==="manual";
      el("ai-connection-status").textContent=modelReady?"Perfil aplicado · Qwen online":"Perfil aplicado · Qwen offline";
      message("Perfil aplicado ao controlador local. "+(modelReady?"Qwen pronto para teste. ":"Qwen ainda desconectado. ")+(vulkan?"Vulkan exige iniciar/reiniciar o llama-server com backend Vulkan; não houve alteração da GPU.":"Pesos GGUF preservados."),"success");
    }catch(e){message("Aplicação não confirmada: "+e.message,"error");el("ai-connection-status").textContent="Aplicação não confirmada";}
    finally{applying=false;el("ai-apply").disabled=!connected;}
  }

  async function chat(event) {
    event.preventDefault();
    if(!connected||pending||!modelReady) {message("Aplique um perfil e conecte ao Qwen antes de testar.","error");return;}
    const prompt=el("ai-prompt").value.trim();
    if(prompt.length<2||prompt.length>6000){message("Digite uma pergunta de 2 a 6.000 caracteres.","error");return;}
    const btn=el("ai-chat-send");
    btn.disabled=true;
    el("ai-chat-response").hidden=true;
    el("ai-chat-meta").textContent="Processando no Qwen local. Modos de revisão podem realizar várias inferências.";
    try{
      const response=await request(validateHost(el("ai-host").value),"/api/v1/chat","POST",el("ai-token").value.trim(),{prompt},240000);
      if(response.agent!=="rea-qwen-mod-host"||response.apiVersion!==1||typeof response.answer!=="string"||!Number.isInteger(response.passes))throw Error("Resposta incompatível com o contrato do REA Mod Host.");
      el("ai-chat-response").textContent=response.answer;
      el("ai-chat-response").hidden=false;
      el("ai-chat-meta").textContent=String(response.passes)+" passagem(ns) · "+String(response.elapsedMs||0)+" ms · Memórias recuperadas: "+String(response.memoryUsed||0)+" · "+String(response.verification||"sem verificação");
      message("Resposta gerada localmente. Revise resultados técnicos antes de usar.","success");
    }catch(e){el("ai-chat-meta").textContent="Falha na consulta ao Qwen.";message(e.message,"error");}
    finally{btn.disabled=!connected||pending||!modelReady;}
  }
  async function clearMemory(){
    if(!connected)return;
    if(!window.confirm("Apagar o histórico de memória do agente Windows? Esta ação não pode ser desfeita."))return;
    try{
      const response=await request(validateHost(el("ai-host").value),"/api/v1/memory/clear","POST",el("ai-token").value.trim(),{confirm:true});
      if(response.cleared!==true)throw Error("Agente não confirmou a limpeza.");
      message("Memória persistente do agente apagada.","success");
    }catch(e){message("Falha ao limpar memória: "+e.message,"error");}
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
  el("ai-chat-form").addEventListener("submit",chat);
  el("ai-clear-memory").addEventListener("click",clearMemory);
  el("ai-host").addEventListener("input",()=>{connected=false;modelReady=false;el("ai-apply").disabled=true;el("ai-chat-send").disabled=true;el("ai-clear-memory").disabled=true;el("ai-connection-status").textContent="Não conectada";});
  el("ai-token").addEventListener("input",()=>{connected=false;modelReady=false;el("ai-apply").disabled=true;el("ai-chat-send").disabled=true;el("ai-clear-memory").disabled=true;el("ai-connection-status").textContent="Não conectada";});
})();