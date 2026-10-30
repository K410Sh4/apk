"use strict";
const IDS = Object.freeze(["think","memory","vulkan","verify"]);
const TARGET = "qwen2.5-coder-7b-instruct";
const DEFAULT = Object.freeze({schema:1,target:TARGET,mods:Object.freeze({think:true,memory:false,vulkan:false,verify:false}),thinkMode:"balanced",contextSize:4096});
function validateProfile(value) {
  if(!value || typeof value !== "object" || Array.isArray(value)) throw Error("Perfil deve ser um objeto.");
  if(value.schema !== 1 || value.target !== TARGET) throw Error("Schema/modelo incompatíveis.");
  const keys=Object.keys(value).sort().join(",");
  if(keys!=="contextSize,mods,schema,target,thinkMode") throw Error("Campos inesperados no perfil.");
  if(!value.mods || typeof value.mods!=="object" || Array.isArray(value.mods) || Object.keys(value.mods).sort().join(",")!=="memory,think,verify,vulkan") throw Error("Lista de mods inválida.");
  const mods={};
  for(const id of IDS) {
    if(typeof value.mods[id]!=="boolean") throw Error("Tipo inválido: "+id);
    mods[id]=value.mods[id];
  }
  if(!["economy","balanced","deep"].includes(value.thinkMode)) throw Error("Modo Think inválido.");
  if(![4096,8192].includes(value.contextSize)) throw Error("Contexto inválido.");
  return {schema:1,target:TARGET,mods,thinkMode:value.thinkMode,contextSize:value.contextSize};
}
function statuses(profile, modelReady) {
  const result={};
  for(const id of IDS) {
    const enabled=profile.mods[id];
    result[id]=!enabled?{state:"disabled",message:"Desativado"}:
      id==="vulkan"?{state:"manual",message:"Requer configurar/reiniciar llama.cpp com Vulkan; este agente não altera a GPU"}:
      !modelReady?{state:"waiting-model",message:"Configurado no agente; aguardando Qwen local"}:
      {state:"ready",message:id==="verify"?"Revisão textual por IA; não equivale a testes automáticos":id==="memory"?"Memória local habilitada":id==="think"?"Orquestração de raciocínio habilitada":"Configurado"};
  }
  return result;
}
module.exports={IDS,TARGET,DEFAULT,validateProfile,statuses};