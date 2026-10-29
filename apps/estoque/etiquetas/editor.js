/* Etiqueta Studio — controller independente, sem bibliotecas externas.
   Coordenadas físicas em mm; DOM SVG próprio, histórico transacional e exportação local. */
(()=>{
"use strict";
const M=window.EtiquetaModel;
if(!M)throw Error("EtiquetaModel não carregado");
const NS="http://www.w3.org/2000/svg",KEY="appspace.estoque.etiqueta.v1";
const $=id=>document.getElementById(id);
const svg=$("label-canvas");
let doc,selected=null,drag=null,saveTimer=null,toastTimer=null;
let undoStack=[],redoStack=[];
const TYPE_NAMES={text:"Texto",rect:"Retângulo",ellipse:"Círculo",line:"Linha",image:"Imagem",barcode:"Código de barras"};
function safeLoad(){
  try{const raw=localStorage.getItem(KEY);if(raw)return M.validate(JSON.parse(raw));}
  catch(e){console.warn("[Etiqueta Studio] Projeto local não pôde ser restaurado:",e);}
  return M.project("preco");
}
doc=safeLoad();
function toast(message){
  const el=$("studio-toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3600);
}
function markSave(message){$("save-state").textContent=message;}
function persist(){
  clearTimeout(saveTimer);
  try{localStorage.setItem(KEY,JSON.stringify(doc));markSave("Salvo localmente");}
  catch(e){console.warn("[Etiqueta Studio] Falha ao salvar",e);markSave("Armazenamento cheio");toast("Espaço local insuficiente: exporte seu projeto JSON.");}
}
function saveSoon(){markSave("Salvando…");clearTimeout(saveTimer);saveTimer=setTimeout(persist,300);}
function trans(fn){
  const before=JSON.stringify(doc);
  try{fn();doc=M.validate(doc);}
  catch(e){doc=JSON.parse(before);toast(e.message||"Alteração inválida");return;}
  if(JSON.stringify(doc)===before)return;
  undoStack.push(before);if(undoStack.length>50)undoStack.shift();
  redoStack=[];saveSoon();render();
}
function travel(back){
  const from=back?undoStack:redoStack,to=back?redoStack:undoStack;
  if(!from.length)return;
  to.push(JSON.stringify(doc));doc=M.validate(JSON.parse(from.pop()));
  if(selected&&!doc.objects.some(o=>o.id===selected))selected=null;
  saveSoon();render();
}
function current(){return doc.objects.find(o=>o.id===selected)||null;}
function number(val,min,max,def){const n=Number(val);return Number.isFinite(n)?M.clamp(n,min,max):def;}
function s(tag,attributes={},value){
  const el=document.createElementNS(NS,tag);
  for(const [key,val] of Object.entries(attributes))if(val!==undefined&&val!==null)el.setAttribute(key,String(val));
  if(value!==undefined)el.textContent=String(value);
  return el;
}
function wrapText(text,size,maxWidth,maxHeight){
  const charLimit=Math.max(1,Math.floor(maxWidth/(size*.53)));
  const maxLines=Math.max(1,Math.floor(maxHeight/(size*1.18)));
  const lines=[];
  for(const paragraph of String(text||"").split("\n")){
    let line="";
    for(const word of paragraph.split(/\s+/)){
      if(!word)continue;
      if(line&&line.length+1+word.length>charLimit){lines.push(line);line="";}
      if(word.length>charLimit){
        if(line){lines.push(line);line="";}
        for(let i=0;i<word.length;i+=charLimit){const chunk=word.slice(i,i+charLimit);if(i+charLimit<word.length)lines.push(chunk);else line=chunk;}
      }else line=line?line+" "+word:word;
    }
    if(line||!lines.length)lines.push(line);
    if(lines.length>=maxLines)break;
  }
  return lines.slice(0,maxLines);
}
function drawItem(group,o){
  const common={fill:o.fill};
  if(o.type==="rect"){
    group.append(s("rect",{x:o.x,y:o.y,width:o.w,height:o.h,rx:Math.min(o.radius,o.w/2,o.h/2),
      fill:o.fill,stroke:o.stroke,"stroke-width":o.strokeWidth}));
  }else if(o.type==="ellipse"){
    group.append(s("ellipse",{cx:o.x+o.w/2,cy:o.y+o.h/2,rx:o.w/2,ry:o.h/2,fill:o.fill,
      stroke:o.stroke,"stroke-width":o.strokeWidth}));
  }else if(o.type==="line"){
    group.append(s("line",{x1:o.x,y1:o.y,x2:o.x+o.w,y2:o.y+o.h,
      stroke:o.stroke,"stroke-width":Math.max(.2,o.strokeWidth||.4),"stroke-linecap":"round"}));
  }else if(o.type==="image"){
    group.append(s("image",{x:o.x,y:o.y,width:o.w,height:o.h,href:o.image,preserveAspectRatio:"xMidYMid meet"}));
  }else if(o.type==="barcode"){
    const barcode=M.barcodeBits(o.text);
    if(barcode){
      const unit=o.w/barcode.bits.length;
      for(let i=0;i<barcode.bits.length;i++)if(barcode.bits[i]==="1")
        group.append(s("rect",{x:o.x+i*unit,y:o.y,width:unit*1.012,height:o.h,fill:o.fill}));
    }else group.append(s("rect",{x:o.x,y:o.y,width:o.w,height:o.h,fill:"none",stroke:"#ff6b6b","stroke-width":.3}));
  }else if(o.type==="text"){
    const x=o.align==="center"?o.x+o.w/2:o.align==="right"?o.x+o.w:o.x;
    const text=s("text",{x,y:o.y+o.fontSize,"font-size":o.fontSize,
      "font-family":o.fontFamily||"Arial","font-weight":o.weight,
      "text-anchor":o.align==="center"?"middle":o.align==="right"?"end":"start",fill:o.fill});
    const lines=wrapText(o.text,o.fontSize,o.w,o.h);
    for(let i=0;i<lines.length;i++){
      text.append(s("tspan",{x,dy:i===0?0:o.fontSize*1.18},lines[i]));
    }
    group.append(text);
  }
}
function draw(svgElement,project,interactive=false){
  svgElement.replaceChildren();
  svgElement.setAttribute("viewBox",`0 0 ${project.width} ${project.height}`);
  if(!interactive){svgElement.setAttribute("width",project.width+"mm");svgElement.setAttribute("height",project.height+"mm");}
  svgElement.append(s("rect",{width:project.width,height:project.height,fill:project.background}));
  for(const o of project.objects){
    const group=s("g",interactive?{class:"label-item","data-item-id":o.id}:{});
    drawItem(group,o);
    if(interactive){
      // Área de toque: todo elemento pode ser selecionado/arrastado, inclusive linhas e texto.
      group.append(s("rect",{x:o.x,y:o.y,width:Math.max(1,o.w),height:Math.max(1,o.h),
        fill:"#ffffff","fill-opacity":0,"pointer-events":"all"}));
    }
    svgElement.append(group);
  }
  if(interactive){
    const o=current();
    if(o){
      svgElement.append(s("rect",{class:"label-selection",x:o.x,y:o.y,
        width:Math.max(1,o.w),height:Math.max(1,o.h)}));
      svgElement.append(s("circle",{class:"label-resize","data-resize-id":o.id,
        cx:o.x+o.w,cy:o.y+o.h,r:Math.max(1,Math.min(1.8,doc.width/70)),
        fill:"#ffffff",stroke:"#2e7bfa","stroke-width":.4}));
    }
  }
}
function exportSVG(project){const node=s("svg",{xmlns:NS});draw(node,project);return new XMLSerializer().serializeToString(node);}
function slug(){return (doc.name||"etiqueta").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"etiqueta";}
function downloadBlob(name,blob){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function downloadText(name,content,type){
  downloadBlob(name,new Blob([content],{type:type||"image/svg+xml;charset=utf-8"}));
}
function makeSheetPages(){
  const gap=number($("sheet-gap").value,0,20,2),margin=number($("sheet-margin").value,0,30,5);
  const count=number($("sheet-copies").value,1,200,12);
  const layout=M.sheet(doc.width,doc.height,gap,margin);
  if(!layout.perPage)throw Error("Etiqueta maior que a área imprimível. Ajuste o tamanho ou as margens.");
  const total=Math.ceil(count/layout.perPage);
  const pages=[];
  for(let page=0;page<total;page++){
    const paper=s("svg",{xmlns:NS,width:"210mm",height:"297mm",viewBox:"0 0 210 297"});
    paper.append(s("rect",{width:210,height:297,fill:"#ffffff"}));
    const labels=Math.min(layout.perPage,count-page*layout.perPage);
    for(let i=0;i<labels;i++){
      const pos=layout.positions[i],wrapper=s("g",{transform:`translate(${pos.x} ${pos.y})`});
      const local=s("svg");draw(local,doc);
      // Um SVG aninhado mantém suas dimensões e unidades em milímetros.
      local.removeAttribute("width");local.removeAttribute("height");
      local.setAttribute("x","0");local.setAttribute("y","0");
      local.setAttribute("width",doc.width);local.setAttribute("height",doc.height);
      wrapper.append(local);paper.append(wrapper);
    }
    pages.push(paper);
  }
  return {pages,layout,count};
}
function updateSheet(){
  const info=M.sheet(doc.width,doc.height,$("sheet-gap").value,$("sheet-margin").value);
  $("sheet-summary").textContent=info.perPage
    ?`${info.columns} colunas × ${info.rows} linhas · até ${info.perPage} etiquetas por folha`
    :"Etiqueta não cabe na folha com essas margens.";
}
function updateInspector(){
  const item=current();
  $("selection-empty").hidden=Boolean(item);
  $("selection-props").hidden=!item;
  $("selection-status").textContent=item?TYPE_NAMES[item.type]+" selecionado · arraste para mover":"Toque em um elemento para editar";
  if(!item)return;
  $("selected-type").textContent=TYPE_NAMES[item.type];
  $("field-text-row").hidden=!["text","barcode"].includes(item.type);
  $("text-fields").hidden=item.type!=="text";
  $("item-stroke-row").hidden=!["rect","ellipse","line"].includes(item.type);
  $("item-stroke-width-row").hidden=!["rect","ellipse","line"].includes(item.type);
  $("item-text").value=item.text;
  $("item-x").value=Number(item.x.toFixed(2));
  $("item-y").value=Number(item.y.toFixed(2));
  $("item-width").value=Number(item.w.toFixed(2));
  $("item-height").value=Number(item.h.toFixed(2));
  $("item-font").value=item.fontSize;
  $("item-align").value=item.align;
  $("item-font-family").value=item.fontFamily;
  $("item-bold").checked=item.weight===700;
  $("item-fill").value=item.fill;
  $("item-stroke").value=item.stroke;
  $("item-stroke-width").value=item.strokeWidth;
}
function render(){
  draw(svg,doc,true);
  const frame=$("studio-canvas-frame");
  frame.style.aspectRatio=doc.width+"/"+doc.height;
  frame.style.width="min(100%, "+Math.min(760,Math.round(8*doc.width))+"px)";
  const zoom=number($("zoom").value,60,160,100);
  // A escala visual não altera as medidas em milímetros no SVG exportado.
  svg.style.transform=`scale(${zoom/100})`;
  svg.style.transformOrigin="center";
  $("zoom-output").textContent=zoom+"%";
  $("canvas-size").textContent=doc.width+" × "+doc.height+" mm · escala real na exportação";
  $("project-name").value=doc.name;
  $("label-width").value=doc.width;$("label-height").value=doc.height;
  $("label-background").value=doc.background;
  $("undo-btn").disabled=undoStack.length===0;
  $("redo-btn").disabled=redoStack.length===0;
  updateInspector();updateSheet();
}
function svgPoint(e){
  const ctm=svg.getScreenCTM();if(!ctm)return {x:0,y:0};
  const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
  const local=point.matrixTransform(ctm.inverse());
  return {x:local.x,y:local.y};
}
svg.addEventListener("pointerdown",e=>{
  if(e.button!==0&&e.pointerType==="mouse")return;
  const handle=e.target.closest?.("[data-resize-id]");
  const group=e.target.closest?.("[data-item-id]");
  if(!handle&&!group){selected=null;render();return;}
  selected=handle?handle.getAttribute("data-resize-id"):group.getAttribute("data-item-id");
  const o=current();if(!o)return;
  const point=svgPoint(e);
  drag={pointerId:e.pointerId,id:o.id,startX:point.x,startY:point.y,x:o.x,y:o.y,
    before:JSON.stringify(doc),mode:handle?"resize":"move",w:o.w,h:o.h,moved:false};
  svg.setPointerCapture(e.pointerId);
  updateInspector();draw(svg,doc,true);
  e.preventDefault();
});
svg.addEventListener("pointermove",e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  const obj=doc.objects.find(o=>o.id===drag.id);if(!obj)return;
  const pt=svgPoint(e);
  const newX=Math.round((drag.x+pt.x-drag.startX)*4)/4;
  const newY=Math.round((drag.y+pt.y-drag.startY)*4)/4;
  if(newX===obj.x&&newY===obj.y)return;
  if(drag.mode==="resize"){
    obj.w=M.clamp(Math.round((drag.w+pt.x-drag.startX)*4)/4,1,doc.width-obj.x+5);
    obj.h=M.clamp(Math.round((drag.h+pt.y-drag.startY)*4)/4,1,doc.height-obj.y+5);
  }else{
    obj.x=M.clamp(newX,-5,doc.width-1);
    obj.y=M.clamp(newY,-5,doc.height-1);
  }
  drag.moved=true;draw(svg,doc,true);
  $("selection-status").textContent=`X ${obj.x} mm · Y ${obj.y} mm`;
  e.preventDefault();
});
function endDrag(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  const before=drag.before,changed=drag.moved&&before!==JSON.stringify(doc);drag=null;
  if(changed){
    undoStack.push(before);if(undoStack.length>50)undoStack.shift();
    redoStack=[];saveSoon();
  }
  render();
}
svg.addEventListener("pointerup",endDrag);
svg.addEventListener("pointercancel",endDrag);
svg.addEventListener("dblclick",e=>{
  if(e.target.closest?.("[data-item-id]")&&current()?.type==="text")$("item-text").focus();
});
for(const button of document.querySelectorAll("[data-add]")){
  button.addEventListener("click",()=>{
    const type=button.dataset.add;
    trans(()=>{
      const props={x:4+Math.min(12,doc.objects.length*2),y:4+Math.min(12,doc.objects.length*2)};
      if(type==="text")Object.assign(props,{w:Math.min(45,doc.width-8),h:12,text:"Seu texto",fontSize:5,weight:700});
      if(type==="rect")Object.assign(props,{w:25,h:12,fill:"#e3edfa",stroke:"#255ba8",strokeWidth:.35});
      if(type==="ellipse")Object.assign(props,{w:19,h:19,fill:"#a8e6d8",stroke:"#198779",strokeWidth:.3});
      if(type==="line")Object.assign(props,{w:35,h:1,stroke:"#111827",strokeWidth:.5});
      if(type==="barcode")Object.assign(props,{w:Math.min(50,doc.width-8),h:13,text:"EST-001",fill:"#111827"});
      const o=M.element(type,props);doc.objects.push(o);selected=o.id;
    });
  });
}
$("add-image").addEventListener("click",()=>$("image-file").click());
$("image-file").addEventListener("change",async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>1500000){
    toast("Use PNG, JPEG ou WebP de até 1,5 MB.");return;
  }
  const reader=new FileReader();
  reader.onload=()=>trans(()=>{
    const o=M.element("image",{image:reader.result,x:4,y:4,w:Math.min(35,doc.width-8),h:Math.min(27,doc.height-8)});
    doc.objects.push(o);selected=o.id;
  });
  reader.onerror=()=>toast("Falha ao ler a imagem.");
  reader.readAsDataURL(file);
});
function bindItem(id,key,min,max){
  $(id).addEventListener("change",()=>{
    if(!current())return;
    const value=number($(id).value,min,max,current()[key]);
    trans(()=>{current()[key]=value;});
  });
}
for(const [id,key,min,max] of [
  ["item-x","x",-100,310],["item-y","y",-100,400],
  ["item-width","w",1,240],["item-height","h",1,320],
  ["item-font","fontSize",1.3,24],["item-stroke-width","strokeWidth",0,4]
])bindItem(id,key,min,max);
$("item-text").addEventListener("change",()=>trans(()=>{if(current())current().text=$("item-text").value;}));
$("item-align").addEventListener("change",()=>trans(()=>{if(current())current().align=$("item-align").value;}));
$("item-bold").addEventListener("change",()=>trans(()=>{if(current())current().weight=$("item-bold").checked?700:400;}));
$("item-font-family").addEventListener("change",()=>trans(()=>{if(current())current().fontFamily=$("item-font-family").value;}));
for(const [id,key] of [["item-fill","fill"],["item-stroke","stroke"]]){
  $(id).addEventListener("change",()=>trans(()=>{if(current())current()[key]=$(id).value;}));
}
for(const [id,key,min,max] of [["label-width","width",20,210],["label-height","height",15,297]]){
  $(id).addEventListener("change",()=>trans(()=>{doc[key]=number($(id).value,min,max,doc[key]);}));
}
$("label-background").addEventListener("change",()=>trans(()=>{doc.background=$("label-background").value;}));
$("project-name").addEventListener("change",()=>trans(()=>{doc.name=$("project-name").value||"Minha etiqueta";}));
$("delete-element").addEventListener("click",()=>trans(()=>{doc.objects=doc.objects.filter(o=>o.id!==selected);selected=null;}));
$("duplicate-element").addEventListener("click",()=>trans(()=>{
  const o=current();if(!o)return;const cp=M.element(o.type,{...o,id:"",x:o.x+2,y:o.y+2});
  doc.objects.push(cp);selected=cp.id;
}));
$("bring-front").addEventListener("click",()=>trans(()=>{
  const i=doc.objects.findIndex(o=>o.id===selected);if(i<0)return;
  doc.objects.push(doc.objects.splice(i,1)[0]);
}));
$("send-back").addEventListener("click",()=>trans(()=>{
  const i=doc.objects.findIndex(o=>o.id===selected);if(i<0)return;
  doc.objects.unshift(doc.objects.splice(i,1)[0]);
}));
$("undo-btn").addEventListener("click",()=>travel(true));
$("redo-btn").addEventListener("click",()=>travel(false));
$("zoom").addEventListener("input",render);
for(const id of ["sheet-copies","sheet-gap","sheet-margin"])$(id).addEventListener("change",updateSheet);
$("apply-template").addEventListener("click",()=>{
  if(!confirm("Substituir esta etiqueta pelo modelo selecionado? Você poderá desfazer."))return;
  trans(()=>{doc=M.project($("template-select").value);selected=null;});
});
$("download-project").addEventListener("click",()=>{
  downloadText(slug()+".json",JSON.stringify(doc,null,2),"application/json;charset=utf-8");
  toast("Projeto exportado em JSON.");
});
$("import-project").addEventListener("click",()=>$("project-file").click());
$("project-file").addEventListener("change",async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;if(file.size>3000000){toast("Projeto JSON maior que 3 MB.");return;}
  try{
    const candidate=M.validate(JSON.parse(await file.text()));
    trans(()=>{doc=candidate;selected=null;});
    toast("Projeto importado com sucesso.");
  }catch(err){toast("Projeto inválido: "+err.message);}
});
$("download-svg").addEventListener("click",()=>{
  downloadText(slug()+".svg",exportSVG(doc));toast("Etiqueta SVG exportada com dimensões reais.");
});
$("download-png").addEventListener("click",async ()=>{
  try{
    const dpi=300,scale=dpi/25.4;
    const w=Math.max(1,Math.round(doc.width*scale)),h=Math.max(1,Math.round(doc.height*scale));
    if(w*h>18000000)throw Error("Imagem muito grande; reduza a etiqueta para PNG.");
    const blob=new Blob([exportSVG(doc)],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    try{
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Falha ao renderizar imagem."));img.src=url;});
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d");
      if(!ctx)throw Error("Canvas indisponível");
      ctx.drawImage(img,0,0,w,h);
      const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Exportação PNG indisponível")),"image/png"));
      downloadBlob(slug()+"-300dpi.png",png);toast("PNG exportado a 300 DPI nominal.");
    }finally{URL.revokeObjectURL(url);}
  }catch(e){toast("Erro no PNG: "+e.message);}
});
$("download-sheet").addEventListener("click",()=>{
  try{
    const result=makeSheetPages();
    downloadText(slug()+"-A4-pagina-1.svg",new XMLSerializer().serializeToString(result.pages[0]));
    toast(result.pages.length>1?"A4 SVG: exportada a página 1 de "+result.pages.length+"; use Imprimir para todas.":"Folha A4 SVG exportada.");
  }catch(e){toast(e.message);}
});
$("print-sheet").addEventListener("click",()=>{
  try{
    const result=makeSheetPages();const root=$("print-root");root.replaceChildren();
    for(const svgPage of result.pages){
      const page=document.createElement("div");page.className="print-page";page.append(svgPage);root.append(page);
    }
    if(typeof window.print!=="function")throw Error("Impressão não é suportada neste aplicativo; exporte a folha SVG.");
    window.print();
    toast("Use A4, escala 100% e margens 0 no diálogo de impressão.");
  }catch(e){toast(e.message);}
});
document.addEventListener("keydown",e=>{
  const editing=e.target.closest?.("input,textarea,select,[contenteditable]");if(editing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();travel(e.shiftKey?false:true);
  }else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){
    e.preventDefault();travel(false);
  }else if((e.key==="Delete"||e.key==="Backspace")&&current()){
    e.preventDefault();trans(()=>{doc.objects=doc.objects.filter(o=>o.id!==selected);selected=null;});
  }else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&current()){
    e.preventDefault();const amount=e.shiftKey?2:.5;
    trans(()=>{const o=current();if(e.key==="ArrowUp")o.y-=amount;else if(e.key==="ArrowDown")o.y+=amount;
      else if(e.key==="ArrowLeft")o.x-=amount;else o.x+=amount;});
  }
});
window.addEventListener("pagehide",persist);
render();
})();
