"use strict";
/* Politica compartilhada entre o empacotador web e o validador de OTA Windows.
 * Documentacao .md permanece no repositorio, mas nao no pacote distribuido.
 * Nao adicionar extensoes executaveis/arquivos de sistema nesta lista. */
const allowed=/\.(?:html|css|js|json|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|txt|wasm)$/i;
function isWebAsset(filename){
 return typeof filename==="string"&&allowed.test(filename);
}
function isDocumentation(filename){
 return typeof filename==="string"&&/\.md$/i.test(filename);
}
module.exports={isWebAsset,isDocumentation};
