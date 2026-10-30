/* Etiqueta Studio — controller independente, sem bibliotecas externas.
   Coordenadas físicas em mm; DOM SVG próprio, histórico transacional e exportação local. */
(()=>{
"use strict";
const M=window.EtiquetaModel;
if(!M)throw Error("EtiquetaModel não carregado");
if(window.Capacitor?.isNativePlatform?.())document.documentElement.dataset.appspaceNative="true";
const NS="http://www.w3.org/2000/svg",KEY="appspace.estoque.etiqueta.v1";
const $=id=>document.getElementById(id);
const svg=$("label-canvas");
let doc,selected=null,drag=null,saveTimer=null,toastTimer=null,viewMode="label";
let undoStack=[],redoStack=[];
const PRECISION_KEY="appspace.estoque.precision.v1";
let showGrid=false,snapToMm=false;
try{const saved=JSON.parse(localStorage.getItem(PRECISION_KEY)||"null");
  showGrid=saved?.grid===true;snapToMm=saved?.snap===true;
}catch(_){}
const snapped=n=>snapToMm?Math.round(n):Math.round(n*4)/4;
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
  const beforeSelected=selected;
  try{fn();doc=M.validate(doc);}
  catch(e){doc=JSON.parse(before);selected=beforeSelected;render();toast(e.message||"Alteração inválida");return;}
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
    // Barras divisórias antigas têm h=1 mm por causa do limite mínimo do modelo.
    // Alinhar só essas linhas; diagonais intencionais (h > 1) continuam diagonais.
    const endY = o.h <= 1 ? o.y : o.y + o.h;
    group.append(s("line",{x1:o.x,y1:o.y,x2:o.x+o.w,y2:endY,
      stroke:o.stroke,"stroke-width":Math.max(.2,o.strokeWidth||.4),"stroke-linecap":"round"}));
  }else if(o.type==="image"){
    group.append(s("image",{x:o.x,y:o.y,width:o.w,height:o.h,href:o.image,preserveAspectRatio:"xMidYMid meet"}));
  }else if(o.type==="barcode"){
    const barcode=M.barcodeBits(o.text);
    if(barcode){
      const quiet=Math.min(2.5,o.w*.065); // Zona de silêncio para o leitor óptico
      const unit=(o.w-2*quiet)/barcode.bits.length;
      for(let i=0;i<barcode.bits.length;i++)if(barcode.bits[i]==="1")
        group.append(s("rect",{x:o.x+quiet+i*unit,y:o.y,width:unit,height:o.h,fill:o.fill}));
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
  // Não herdar o traço global dos ícones SVG do portal (causa caracteres inflados).
  svgElement.setAttribute("stroke","none");
  svgElement.setAttribute("stroke-width","0");
  if(!interactive){svgElement.setAttribute("width",project.width+"mm");svgElement.setAttribute("height",project.height+"mm");}
  svgElement.append(s("rect",{width:project.width,height:project.height,fill:project.background}));
   if(interactive&&showGrid){
     const defs=s("defs"),pattern=s("pattern",{id:"studio-grid-pattern",width:5,height:5,patternUnits:"userSpaceOnUse"});
     pattern.append(s("path",{d:"M 5 0 L 0 0 0 5",fill:"none",stroke:"#64748b","stroke-width":.2,opacity:.45}));
     defs.append(pattern);svgElement.append(defs);
     svgElement.append(s("rect",{width:project.width,height:project.height,fill:"url(#studio-grid-pattern)","pointer-events":"none"}));
   }
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
        cx:o.x+o.w,cy:o.type==="line" && o.h<=1 ? o.y : o.y+o.h,r:Math.max(1,Math.min(1.8,doc.width/70)),
        fill:"#ffffff",stroke:"#2e7bfa","stroke-width":.4}));
    }
  }
}
function exportSVG(project){const node=s("svg",{xmlns:NS});draw(node,project);return new XMLSerializer().serializeToString(node);}
function slug(){return (doc.name||"etiqueta").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"etiqueta";}
async function downloadBlob(name,blob){
  if(!window.EtiquetaFiles?.save)throw Error("Exportador de arquivos não disponível");
  return window.EtiquetaFiles.save(name,blob);
}
function downloadText(name,content,type){
  return downloadBlob(name,new Blob([content],{type:type||"image/svg+xml;charset=utf-8"}));
}
function notifyExport(result,label){
  toast(result==="shared" ? label+" preparado. Salve em Arquivos ou Drive antes de desinstalar o aplicativo." : label+" exportado.");
}
function makeSheetPages(firstPageOnly=false){
  const gap=number($("sheet-gap").value,0,20,2),margin=number($("sheet-margin").value,0,30,5);
  const count=Math.round(number($("sheet-copies").value,1,200,12));
  const layout=M.sheet(doc.width,doc.height,gap,margin);
  if(!layout.perPage)throw Error("Etiqueta maior que a área imprimível. Ajuste o tamanho ou as margens.");
  const total=firstPageOnly?1:Math.ceil(count/layout.perPage);
  const pages=[];
  for(let page=0;page<total;page++){
    const paper=s("svg",{xmlns:NS,width:"210mm",height:"297mm",viewBox:"0 0 210 297",stroke:"none"});
    paper.append(s("rect",{width:210,height:297,fill:"#ffffff"}));
    const labels=Math.min(layout.perPage,count-page*layout.perPage);
    for(let i=0;i<labels;i++){
      const pos=layout.positions[i],clipId="label-clip-"+page+"-"+i;
      const defs=s("defs"),clip=s("clipPath",{id:clipId});
      clip.append(s("rect",{width:doc.width,height:doc.height}));defs.append(clip);paper.append(defs);
      const wrapper=s("g",{transform:`translate(${pos.x} ${pos.y})`,
        "clip-path":"url(#"+clipId+")"});
      const local=s("svg");draw(local,doc);
      // Manter todas as geometrias como coordenadas físicas da folha A4.
      // SVG aninhado herdava a regra global svg{width:20px;height:20px}.
      while(local.firstChild)wrapper.append(local.firstChild);
      paper.append(wrapper);
    }
    pages.push(paper);
  }
  return {pages,layout,count};
}
function updateA4Preview(){
  const preview=$("a4-preview");
  if(!preview||viewMode!=="a4")return;
  try{
    const {pages}=makeSheetPages(true);
    if(!pages.length)return;
    preview.replaceChildren(...[...pages[0].childNodes].map(node=>node.cloneNode(true)));
    preview.setAttribute("viewBox","0 0 210 297");
    preview.setAttribute("stroke","none");
    preview.setAttribute("stroke-width","0");
    // Apenas na tela: guia sutil para visualizar o limite de cada etiqueta.
    const layout=M.sheet(doc.width,doc.height,$("sheet-gap").value,$("sheet-margin").value);
    const copies=Math.round(number($("sheet-copies").value,1,200,12));
    for(const p of layout.positions.slice(0,Math.min(layout.perPage,copies))){
      preview.append(s("rect",{x:p.x,y:p.y,width:doc.width,height:doc.height,
        fill:"none",stroke:"#b6bdc9","stroke-width":0.18,"pointer-events":"none"}));
    }
  }catch(e){preview.replaceChildren();$("sheet-summary").textContent=e.message;}
}
function updateSheet(){
  const info=M.sheet(doc.width,doc.height,$("sheet-gap").value,$("sheet-margin").value);
  $("sheet-summary").textContent=info.perPage
    ?`${info.columns} colunas × ${info.rows} linhas · até ${info.perPage} etiquetas por folha`
    :"Etiqueta não cabe na folha com essas margens.";
  updateA4Preview();
}
function updateInspector(){
  const item=current();
  $("selection-empty").hidden=Boolean(item);
  $("selection-props").hidden=!item;
  $("selection-status").textContent=viewMode==="a4"?"Proporção A4 · volte à edição para mover":item?TYPE_NAMES[item.type]+" selecionado · arraste para mover":"Toque em um elemento para editar";
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
  svg.style.setProperty("--label-ratio",doc.width+" / "+doc.height);
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
const G=window.EtiquetaGestures;
if(!G)throw Error("EtiquetaGestures não carregado");
let lastTouchTap=null;
function editContentFromCanvas(id){
  const obj=doc.objects.find(o=>o.id===id);
  if(!obj||!["text","barcode"].includes(obj.type))return;
  selected=obj.id;
  render();
  window.dispatchEvent(new CustomEvent("etiqueta:edit-content",{detail:{id:obj.id}}));
}
svg.addEventListener("pointerdown",e=>{
  if(e.button!==0&&e.pointerType==="mouse")return;
  const point=svgPoint(e);
  if(drag){
    // O segundo toque é reservado para pinça no elemento já selecionado.
    if(e.pointerType!=="touch"||drag.points.size!==1||drag.mode==="pinch")return;
    const item=doc.objects.find(o=>o.id===drag.id);
    if(!item)return;
    drag.points.set(e.pointerId,point);
    const first=[...drag.points.entries()][0];
    drag.mode="pinch";
    drag.pinch={first:first[1],second:point,start:{...item}};
    lastTouchTap=null;
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();return;
  }
  const handle=e.target.closest?.("[data-resize-id]");
  const group=e.target.closest?.("[data-item-id]");
  if(!handle&&!group){selected=null;lastTouchTap=null;render();return;}
  const id=handle?handle.getAttribute("data-resize-id"):group.getAttribute("data-item-id");
  if(selected!==id)lastTouchTap=null;
  selected=id;
  const o=current();if(!o)return;
  drag={pointerId:e.pointerId,id:o.id,startX:point.x,startY:point.y,
    x:o.x,y:o.y,w:o.w,h:o.h,points:new Map([[e.pointerId,point]]),
    before:JSON.stringify(doc),mode:handle?"resize":"move",moved:false};
  svg.setPointerCapture(e.pointerId);
  updateInspector();draw(svg,doc,true);
  e.preventDefault();
});
svg.addEventListener("pointermove",e=>{
  if(!drag||!drag.points.has(e.pointerId))return;
  const obj=doc.objects.find(o=>o.id===drag.id);if(!obj)return;
  const pt=svgPoint(e);
  drag.points.set(e.pointerId,pt);
  if(drag.mode==="pinch"){
    if(drag.points.size!==2)return;
    const points=[...drag.points.values()];
    const geometry=G.pinch(drag.pinch.start,drag.pinch.first,drag.pinch.second,
      points[0],points[1],doc);
    if(!geometry)return;
    Object.assign(obj,geometry);
    drag.moved=JSON.stringify(doc)!==drag.before;
    draw(svg,doc,true);
    $("selection-status").textContent="Pinça: "+obj.w.toFixed(1)+" × "+obj.h.toFixed(1)+" mm";
    e.preventDefault();return;
  }
  const newX=snapped(drag.x+pt.x-drag.startX);
  const newY=snapped(drag.y+pt.y-drag.startY);
  if(drag.mode==="resize"){
    const w=M.clamp(snapped(drag.w+pt.x-drag.startX),1,Math.max(1,Math.min(240,doc.width-obj.x)));
    const h=M.clamp(snapped(drag.h+pt.y-drag.startY),1,Math.max(1,Math.min(320,doc.height-obj.y)));
    if(w===obj.w&&h===obj.h)return;
    obj.w=w;obj.h=h;
  }else{
    if(newX===obj.x&&newY===obj.y)return;
    obj.x=M.clamp(newX,0,Math.max(0,doc.width-obj.w));
    obj.y=M.clamp(newY,0,Math.max(0,doc.height-obj.h));
  }
  drag.moved=JSON.stringify(doc)!==drag.before;
  draw(svg,doc,true);
  $("selection-status").textContent=`X ${obj.x} mm · Y ${obj.y} mm`;
  e.preventDefault();
});
function endDrag(e){
  if(!drag||!drag.points.has(e.pointerId))return;
  const done=drag;
  drag=null; // limpar antes de soltar captura para evitar lostpointercapture duplicado
  if(done.moved&&done.before!==JSON.stringify(doc)){
    undoStack.push(done.before);if(undoStack.length>50)undoStack.shift();
    redoStack=[];saveSoon();
  }
  const tapCandidate=!done.moved&&done.mode!=="pinch"&&
    e.type==="pointerup"&&e.pointerType==="touch";
  if(tapCandidate){
    const item=doc.objects.find(o=>o.id===done.id);
    const pt=svgPoint(e);
    const tap={id:done.id,x:pt.x,y:pt.y,time:e.timeStamp};
    if(item&&["text","barcode"].includes(item.type)&&G.isDoubleTap(lastTouchTap,tap)){
      lastTouchTap=null;
      render();
      editContentFromCanvas(done.id);
    }else{
      lastTouchTap=tap;
      render();
    }
  }else{lastTouchTap=null;render();}
  for(const pointerId of done.points.keys()){
    if(svg.hasPointerCapture?.(pointerId)){
      try{svg.releasePointerCapture(pointerId);}catch(_){}
    }
  }
}
svg.addEventListener("pointerup",endDrag);
svg.addEventListener("pointercancel",endDrag);
svg.addEventListener("lostpointercapture",endDrag);
svg.addEventListener("dblclick",e=>{
  const group=e.target.closest?.("[data-item-id]");
  if(group)editContentFromCanvas(group.getAttribute("data-item-id"));
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
$("studio-delete-selected")?.addEventListener("click",()=>{
  if(!selected)return;
  $("delete-element").click(); // mesmo caminho, histórico e salvamento existentes
});
function clearEntireLabel(){
  if(!doc.objects.length){toast("A etiqueta já está vazia.");return;}
  if(!confirm("Apagar todos os elementos da etiqueta? Você poderá desfazer."))return;
  trans(()=>{doc.objects=[];selected=null;lastTouchTap=null;});
  toast("Conteúdo apagado. Use Desfazer para recuperar.");
}
$("clear-label")?.addEventListener("click",clearEntireLabel);
$("clear-canvas-mobile")?.addEventListener("click",clearEntireLabel);

function duplicateSelected(){trans(()=>{
  const o=current();if(!o)return;const cp=M.element(o.type,{...o,id:"",x:o.x+2,y:o.y+2});
  doc.objects.push(cp);selected=cp.id;
});}
$("duplicate-element").addEventListener("click",duplicateSelected);
for(const [id,axis] of [["studio-center-x","x"],["studio-center-y","y"]]){
  $(id).addEventListener("click",()=>trans(()=>{
    const o=current();if(!o)return;
    o[axis]=snapped(Math.max(0,((axis==="x"?doc.width:doc.height)-(axis==="x"?o.w:o.h))/2));
  }));
}
function syncPrecisionButtons(){
  $("studio-grid").setAttribute("aria-pressed",String(showGrid));
  $("studio-snap").setAttribute("aria-pressed",String(snapToMm));
}
for(const [id,key] of [["studio-grid","grid"],["studio-snap","snap"]]){
  $(id).addEventListener("click",()=>{
    if(key==="grid")showGrid=!showGrid;else snapToMm=!snapToMm;
    try{localStorage.setItem(PRECISION_KEY,JSON.stringify({grid:showGrid,snap:snapToMm}));}catch(_){}
    syncPrecisionButtons();render();
  });
}
syncPrecisionButtons();
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
for(const button of document.querySelectorAll("[data-view-mode]")){
  button.addEventListener("click",()=>{
    viewMode=button.dataset.viewMode==="a4"?"a4":"label";
    $("studio-stage").dataset.view=viewMode;
    $("studio-a4-frame").hidden=viewMode!=="a4";
    for(const b of document.querySelectorAll("[data-view-mode]"))
      b.setAttribute("aria-pressed",String(b.dataset.viewMode===viewMode));
    $("zoom").disabled=viewMode==="a4";
    $("selection-status").textContent=viewMode==="a4"
      ?"Comparação proporcional com papel A4":"Toque em um elemento para editar";
    render();
  });
}
for(const id of ["sheet-copies","sheet-gap","sheet-margin"])$(id).addEventListener("change",updateSheet);
$("apply-template").addEventListener("click",()=>{
  if(!confirm("Substituir esta etiqueta pelo modelo selecionado? Você poderá desfazer."))return;
  trans(()=>{doc=M.project($("template-select").value);selected=null;});
});
$("download-project").addEventListener("click",async()=>{
  try{
    const result=await downloadText(slug()+".json",JSON.stringify(doc,null,2),"application/json;charset=utf-8");
    notifyExport(result,"Projeto JSON");
  }catch(e){toast("Falha ao salvar projeto: "+e.message);}
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
$("download-svg").addEventListener("click",async()=>{
  try{notifyExport(await downloadText(slug()+".svg",exportSVG(doc)),"Etiqueta SVG");}
  catch(e){toast("Falha ao exportar SVG: "+e.message);}
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
      notifyExport(await downloadBlob(slug()+"-300dpi.png",png),"PNG 300 DPI nominal");
    }finally{URL.revokeObjectURL(url);}
  }catch(e){toast("Erro no PNG: "+e.message);}
});
$("download-sheet").addEventListener("click",async()=>{
  try{
    const result=makeSheetPages(),xml=new XMLSerializer();
    if(result.pages.length===1){
      notifyExport(await downloadText(slug()+"-A4.svg",xml.serializeToString(result.pages[0])),"Folha A4");
    }else{
      const files=result.pages.map((page,i)=>({name:"A4-pagina-"+String(i+1).padStart(2,"0")+".svg",content:xml.serializeToString(page)}));
      notifyExport(await downloadBlob(slug()+"-A4-"+result.pages.length+"-paginas.zip",window.EtiquetaFiles.zip(files)),"ZIP com "+files.length+" folhas A4");
    }
  }catch(e){toast("Falha ao exportar A4: "+e.message);}
});
function nativePrinter(){
  const cap=window.Capacitor;
  if(!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.("Printer"))return null;
  return cap.Plugins?.Printer || cap.registerPlugin?.("Printer") || null;
}
function printHtmlPages(pages){
  // Documento autônomo para o plugin Android: sem estilos herdados do AppSpace.
  const content=pages.map(p=>'<div class="page">'+new XMLSerializer().serializeToString(p)+'</div>').join("");
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+
    '<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}'+
    '.page{width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}'+
    '.page:last-child{break-after:auto;page-break-after:auto}'+
    'svg{display:block;width:210mm;height:297mm;stroke:none}</style></head><body>'+content+'</body></html>';
}
async function printUsingSystem(){
  const result=makeSheetPages();
  const plugin=nativePrinter();
  if(plugin && typeof plugin.printHtml==="function"){
    await plugin.printHtml({name:"Etiqueta Studio — A4",html:printHtmlPages(result.pages)});
    toast("Seletor de impressoras aberto. Selecione sua impressora Wi-Fi.");
    return;
  }
  if(window.Capacitor?.isNativePlatform?.()){
    toast("Impressão de rede requer o novo APK com plugin de impressão. Exporte SVG por enquanto.");
    $("printer-help").textContent="O sistema não encontrou o recurso nativo de impressão neste APK. Atualize a base Android e habilite o Serviço de Impressão do sistema (Mopria ou da fabricante).";
    return;
  }
  const root=$("print-root");root.replaceChildren();
  for(const svgPage of result.pages){
    const page=document.createElement("div");page.className="print-page";page.append(svgPage);root.append(page);
  }
  if(typeof window.print!=="function")throw Error("Este dispositivo não oferece impressão. Exporte SVG.");
  window.print();
  toast("No diálogo: escolha A4, escala 100% e margens zero.");
}
$("print-sheet").addEventListener("click",()=>void printUsingSystem().catch(e=>toast("Falha ao abrir impressão: "+e.message)));
$("find-printers").addEventListener("click",()=>void printUsingSystem().catch(e=>toast("Não foi possível abrir o seletor: "+e.message)));
document.addEventListener("keydown",e=>{
  const editing=e.target.closest?.("input,textarea,select,[contenteditable]");if(editing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="d"&&current()){
    e.preventDefault();duplicateSelected();
  }else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();travel(e.shiftKey?false:true);
  }else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){
    e.preventDefault();travel(false);
  }else if((e.key==="Delete"||e.key==="Backspace")&&current()){
    e.preventDefault();trans(()=>{doc.objects=doc.objects.filter(o=>o.id!==selected);selected=null;});
  }else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&current()){
    e.preventDefault();const amount=snapToMm?(e.shiftKey?5:1):(e.shiftKey?2:.5);
    trans(()=>{const o=current();const axis=e.key==="ArrowUp"||e.key==="ArrowDown"?"y":"x";
      const delta=e.key==="ArrowUp"||e.key==="ArrowLeft"?-amount:amount;
      o[axis]=M.clamp(snapped(o[axis]+delta),0,Math.max(0,(axis==="x"?doc.width:doc.height)-(axis==="x"?o.w:o.h)));
    });
  }
});
window.addEventListener("pagehide",persist);
render();
})();

