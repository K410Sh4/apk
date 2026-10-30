"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const p="apps/estoque/etiquetas/";
const html=fs.readFileSync(path.join(root,p+"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,p+"modern.css"),"utf8");
const source=fs.readFileSync(path.join(root,p+"modern.js"),"utf8");
new Function(source);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,"IDs de controles duplicados");
for(const name of ["studio-app","studio-open-export","studio-open-label","studio-open-properties","studio-export-panel",
  "studio-properties-panel","studio-open-templates","studio-template-picker","studio-mobile-overlay","studio-close-export",
  "studio-close-properties","studio-size-hint","studio-export-project","studio-import-project","studio-export-svg"]){
  assert.ok(ids.includes(name),"Controle mobile ausente: "+name);
}
for(const file of ["modern.js","modern.css"])assert.ok(html.includes('./'+file),"Arquivo UI não referenciado");
assert.match(css,/max-width:850px/);
assert.match(css,/min-height:44px/);
assert.match(css,/min-height:48px/);
assert.match(css,/\[data-mobile-panel="export"\]/);
assert.match(css,/\[data-mobile-panel="properties"\]/);
assert.match(css,/@media print/);
let activeElement=null;
class MockElement{
  constructor(id,dataset={}){
    this.id=id;this.dataset={...dataset};this.attrs={};this.events={};this.hidden=false;this.isConnected=true;
    this.style={overflow:""};this.textContent="";this.tabIndex=0;
  }
  addEventListener(type,listener){(this.events[type]??=[]).push(listener)}
  emit(type,attrs={}){for(const f of this.events[type]??[])f({currentTarget:this,target:this,...attrs})}
  click(){this.emit("click")}
  setAttribute(name,val){this.attrs[name]=String(val)}
  removeAttribute(name){delete this.attrs[name]}
  focus(){activeElement=this}
  getClientRects(){return [1]}
  closest(){return null}
  querySelectorAll(){return []}
}
const elements=Object.fromEntries(ids.map(id=>[id,new MockElement(id)]));
elements["selection-props"].hidden=true;
elements["studio-mobile-overlay"].hidden=true;
elements["studio-app"].dataset={mobilePanel:"none",sheetTab:"element",templatesOpen:"false"};
const tabs=["element","label","paper"].map(x=>new MockElement("tab-"+x,{sheetTab:x}));
const tools=["text","rect","ellipse","line","barcode"].map(x=>new MockElement("add-"+x,{add:x}));
const document={
 body:new MockElement("body"),activeElement:null,events:{},
 getElementById(id){return elements[id]||null},
 querySelectorAll(q){
   if(q==="[data-sheet-tab]"||q===".studio-sheet-tabs [data-sheet-tab]")return tabs;
   if(q===".studio-tools [data-add]")return tools;
   return [];
 },
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
 emit(name,args){for(const fn of this.events[name]||[])fn(args)}
};
const media={matches:true,events:{},addEventListener(type,fn){this.events[type]=fn}};
const sandbox={
 document,window:{matchMedia:()=>media,addEventListener(){}},MutationObserver:class{constructor(cb){this.cb=cb}observe(){}},
 setTimeout(){},getComputedStyle(){return {display:"block"}}
};
vm.runInNewContext(source,sandbox,{filename:"modern.js"});
elements["studio-open-export"].click();
assert.equal(elements["studio-app"].dataset.mobilePanel,"export");
assert.equal(elements["studio-mobile-overlay"].hidden,false);
assert.equal(elements["studio-export-panel"].attrs.role,"dialog");
elements["studio-close-export"].click();
assert.equal(elements["studio-app"].dataset.mobilePanel,"none");
assert.equal(elements["studio-mobile-overlay"].hidden,true);
elements["studio-open-label"].click();
assert.equal(elements["studio-app"].dataset.mobilePanel,"properties");
assert.equal(elements["studio-app"].dataset.sheetTab,"label");
tabs[2].click();
assert.equal(elements["studio-app"].dataset.sheetTab,"paper");
elements["studio-close-properties"].click();
elements["studio-open-templates"].click();
assert.equal(elements["studio-app"].dataset.templatesOpen,"true");
document.emit("pointerdown",{target:{closest:()=>null}});
assert.equal(elements["studio-app"].dataset.templatesOpen,"false");
document.emit("keydown",{key:"Escape",preventDefault(){}});
assert.equal(elements["studio-app"].dataset.mobilePanel,"none");
console.log("[Etiqueta Studio UI] Painéis, abas, acessibilidade, modelos, botões e escape: OK");
