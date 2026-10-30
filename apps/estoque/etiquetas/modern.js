/* Etiqueta Studio — modern UI controller.
   Não interfere no modelo, na renderização SVG, nos tamanhos físicos ou no autosave.
   Acessibilidade: botões reais, foco recuperável, Escape e rolagem da página protegida.
*/
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const app=byId("studio-app");
if(!app)return;
const media=window.matchMedia("(max-width: 850px)");
const overlay=byId("studio-mobile-overlay");
const exportPanel=byId("studio-export-panel");
const properties=byId("studio-properties-panel");
let lastTrigger=null,previousOverflow="";
function mobile(){return media.matches;}
function markTrigger(panel){
  for(const id of ["studio-open-export","studio-open-properties","studio-open-label"]){
    const button=byId(id);
    if(button)button.setAttribute("aria-expanded",String(
      (panel==="export"&&id==="studio-open-export")||
      (panel==="properties"&&id!=="studio-open-export")));
  }
}
function selectTab(tab){
  if(!["element","label","paper"].includes(tab))return;
  app.dataset.sheetTab=tab;
  for(const button of document.querySelectorAll("[data-sheet-tab]")){
    button.setAttribute("aria-selected",String(button.dataset.sheetTab===tab));
    button.tabIndex=button.dataset.sheetTab===tab?0:-1;
  }
}
function close(restoreFocus=true){
  if(app.dataset.mobilePanel==="none")return;
  app.dataset.mobilePanel="none";
  overlay.hidden=true;
  markTrigger("none");
  exportPanel.setAttribute("aria-modal","false");
  properties.setAttribute("aria-modal","false");
  exportPanel.removeAttribute("role");
  properties.removeAttribute("role");
  document.body.style.overflow=previousOverflow;
  if(restoreFocus&&lastTrigger?.isConnected&&typeof lastTrigger.focus==="function")lastTrigger.focus({preventScroll:true});
  lastTrigger=null;
}
function open(panel,tab,trigger){
  if(!mobile())return;
  if(panel!=="export"&&panel!=="properties")return;
  // Fecha a paleta de modelos antes de abrir outra sobreposição.
  app.dataset.templatesOpen="false";
  byId("studio-open-templates")?.setAttribute("aria-expanded","false");
  if(tab)selectTab(tab);
  if(app.dataset.mobilePanel==="none")previousOverflow=document.body.style.overflow;
  lastTrigger=trigger||document.activeElement;
  app.dataset.mobilePanel=panel;
  overlay.hidden=false;
  document.body.style.overflow="hidden";
  markTrigger(panel);
  const target=panel==="export"?exportPanel:properties;
  target.setAttribute("role","dialog");
  target.setAttribute("aria-modal","true");
  (panel==="export"?properties:exportPanel).setAttribute("aria-modal","false");
  const focusTarget=panel==="export"?byId("studio-close-export"):byId("studio-close-properties");
  focusTarget?.focus({preventScroll:true});
}
function updateSelection(){
  const visible=!byId("selection-props")?.hidden;
  const action=byId("studio-open-properties");
  if(action)action.hidden=!visible;
  const size=byId("canvas-size")?.textContent?.split("·")[0]?.trim();
  if(size&&byId("studio-size-hint"))byId("studio-size-hint").textContent=size;
  // Elementos deletados: trocar para a guia de dimensões quando o painel estiver aberto.
  if(!visible&&app.dataset.sheetTab==="element"&&app.dataset.mobilePanel==="properties")selectTab("label");
}
byId("studio-open-export")?.addEventListener("click",event=>open("export",null,event.currentTarget));
byId("studio-open-properties")?.addEventListener("click",event=>open("properties","element",event.currentTarget));
byId("studio-open-label")?.addEventListener("click",event=>open("properties","label",event.currentTarget));
byId("studio-close-export")?.addEventListener("click",()=>close());
byId("studio-close-properties")?.addEventListener("click",()=>close());
overlay?.addEventListener("click",()=>close());
for(const tab of document.querySelectorAll(".studio-sheet-tabs [data-sheet-tab]"))
  tab.addEventListener("click",()=>selectTab(tab.dataset.sheetTab));
const forwards=[
  ["studio-export-project","download-project"],
  ["studio-import-project","import-project"],
  ["studio-export-svg","download-svg"]
];
for(const [from,to] of forwards)
  byId(from)?.addEventListener("click",()=>byId(to)?.click());
byId("studio-open-templates")?.addEventListener("click",event=>{
  const visible=app.dataset.templatesOpen==="true";
  app.dataset.templatesOpen=String(!visible);
  event.currentTarget.setAttribute("aria-expanded",String(!visible));
  if(!visible)byId("template-select")?.focus({preventScroll:true});
});
byId("apply-template")?.addEventListener("click",()=>{
  app.dataset.templatesOpen="false";
  byId("studio-open-templates")?.setAttribute("aria-expanded","false");
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(app.dataset.mobilePanel!=="none"){e.preventDefault();close();}
    else if(app.dataset.templatesOpen==="true"){
      app.dataset.templatesOpen="false";
      byId("studio-open-templates")?.setAttribute("aria-expanded","false");
      byId("studio-open-templates")?.focus({preventScroll:true});
    }
  }
  if(e.key==="Tab"&&app.dataset.mobilePanel!=="none"&&mobile()){
    const panel=app.dataset.mobilePanel==="export"?exportPanel:properties;
    const tabbable=[...panel.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden]),textarea:not([disabled]):not([hidden]),select:not([disabled]):not([hidden]),a[href]')]
      .filter(el=>!el.closest("[hidden]")&&getComputedStyle(el).display!=="none");
    if(!tabbable.length)return;
    const first=tabbable[0],last=tabbable[tabbable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
const selectedBox=byId("selection-props");
if(selectedBox)new MutationObserver(updateSelection).observe(selectedBox,{attributes:true,attributeFilter:["hidden"]});
const sizeBox=byId("canvas-size");
if(sizeBox)new MutationObserver(updateSelection).observe(sizeBox,{childList:true,characterData:true,subtree:true});
for(const button of document.querySelectorAll(".studio-tools [data-add]")){
  button.addEventListener("click",()=>{
    setTimeout(()=>{
      updateSelection();
      if(mobile()&&["text","barcode"].includes(button.dataset.add)&&!byId("selection-props").hidden)
        open("properties","element",button);
    },0);
  });
}
media.addEventListener("change",()=>{if(!mobile())close(false);});
selectTab("element");
updateSelection();
})();
