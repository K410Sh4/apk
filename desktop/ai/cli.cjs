"use strict";
const {createHost}=require("./host.cjs");
const port=process.env.REA_MOD_PORT?Number(process.env.REA_MOD_PORT):8765;
const llamaBase=process.env.REA_LLAMA_URL||"http://127.0.0.1:8080";
const host=createHost({port,llamaBase});
host.listen().then(({url,token})=>{
  console.log("[REA MOD HOST] Serviço local ativo em "+url);
  console.log("[REA MOD HOST] Token de sessão (não compartilhe): "+token);
  console.log("[REA MOD HOST] O serviço não modifica o REA.exe nem altera pesos GGUF.");
  console.log("[REA MOD HOST] Backend Qwen esperado: "+llamaBase);
}).catch(err=>{console.error("[REA MOD HOST] Falha: "+err.message);process.exitCode=1;});
function stop(){host.close().then(()=>process.exit(0)).catch(()=>process.exit(1));}
process.on("SIGINT",stop);
process.on("SIGTERM",stop);