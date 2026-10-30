"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),folder="apps/estoque/etiquetas/";
const read=p=>fs.readFileSync(path.join(root,folder+p),"utf8");
const editor=read("index.html"),batch=read("lote/index.html");
const editorCss=read("modern.css"),batchCss=read("lote/batch.css");
const batchJs=read("lote/batch.js");
function inspect(name,html){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,name+" tem IDs duplicados");
 const open=(html.match(/<details\b/g)||[]).length;
 const close=(html.match(/<\/details>/g)||[]).length;
 assert.ok(open>=2,name+" precisa de ajuda contextual");
 assert.equal(open,close,name+" tem disclosures mal fechados");
 return new Set(ids);
}
const ed=inspect("Editor",editor),ba=inspect("Produção",batch);
for(const id of ["label-canvas","studio-open-export","studio-open-properties",
 "studio-delete-selected","download-project","print-sheet","studio-template-picker","studio-size-hint"])assert.ok(ed.has(id),id);
for(const id of ["step-model","step-list","step-preview","batch-field-list","batch-table-body","add-row",
 "layout-cols","layout-rows","layout-margin","layout-gap-x","layout-gap-y","layout-align-x","layout-align-y",
 "batch-paper","page-counter","batch-print","batch-download","download-list","import-list"])assert.ok(ba.has(id),id);
assert.match(editor,/class="batch-entry-current"/);
assert.match(editor,/Como editar\?/);
assert.match(editor,/id="printer-help"/);
assert.match(editorCss,/studio-help-details/);
assert.match(editorCss,/batch-entry-current/);
assert.match(batch,/class="batch-fine-tune"/);
assert.match(batch,/class="batch-list-more"/);
assert.match(batch,/Escala correta/);
assert.match(batchCss,/batch-preview-main\{display:contents\}/);
assert.match(batchJs,/layout\.columns\+" × "\+layout\.rows/);
assert.match(batchJs,/\$\("batch-print"\)/);
assert.match(batchJs,/\$\("batch-download"\)/);
for(const expr of [/<h1>Etiquetas em lote<\/h1>/,/>Modelo padrão<\/h2>/,/>Produtos e cópias<\/h2>/,/>Prévia A4<\/h2>/])
 assert.match(batch,expr);
console.log("[Etiqueta Studio] Interface compacta, ajuda opcional, controles e prévia A4: OK");
