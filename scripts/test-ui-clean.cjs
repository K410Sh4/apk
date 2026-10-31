"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const file=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=file("assets/ui-clean.css");
const js=file("assets/ui-clean.js");
new Function(js);
assert.ok(css.includes("body.page-home .hero"),"Home simplified");
assert.ok(css.includes("body.page-settings .settings-preview"),"Settings duplicate preview hidden");
assert.ok(css.includes(".rgb-page [data-as-rgb-panel][hidden]"),"Hidden RGB view invisible");
assert.ok(js.includes('document.createElement("details")'),"Settings disclosure");
assert.ok(js.includes('document.createElement("nav")'),"RGB workspace tabs");
assert.ok(js.includes("ArrowLeft")&&js.includes("ArrowRight"),"Keyboard navigation");
assert.ok(js.includes("sessionStorage"),"RGB tab persists for same session");
assert.ok(!/HidD_SetFeature|USB_WRITE|fetch\s*\(/.test(js),"No hardware or network operations from layout");
const pages=["index.html","configuracoes.html","apps/estoque/index.html",
 "apps/edicao-de-video/index.html","apps/meu-pc/index.html",
 "apps/ia/index.html","apps/sistema/index.html","apps/primeiro-app/index.html",
 "apps/meu-pc/rgb/index.html"];
for(const p of pages){
 const html=file(p);
 assert.ok(html.includes("ui-clean.css"),p+" CSS");
 assert.ok(html.includes("ui-clean.js"),p+" JS");
 assert.ok(html.indexOf("ui-clean.css")<html.indexOf("</head>"),p+" head CSS");
 assert.ok(html.indexOf("ui-clean.js")<html.indexOf("</head>"),p+" head JS");
}
const rgb=file("apps/meu-pc/rgb/index.html");
for(const id of ["rgb-direct","rgb-direct-status","rgb-direct-apply","rgb-sync-preview",
 "rgb-sync-start","rgb-hub-form","rgb-search","rgb-results","rgb-direct-diagnostic-details"]){
 assert.ok(rgb.includes('id="'+id+'"'),"Must preserve RGB app control "+id);
}
const settings=file("configuracoes.html");
for(const id of ["navegacao-mobile","ota-check","desktop-ota-check","reset-settings","sound-volume"]){
 assert.ok(settings.includes('id="'+id+'"'),"Must preserve settings control "+id);
}
assert.ok(file("index.html").includes('id="app-search"'),"Keep searchable folders");
assert.ok(file("index.html").includes('id="launcher"'),"Keep optional mobile launcher");
console.log("[AppSpace UI Clean] Shared shell, RGB tabs, settings and native controller IDs: OK");
