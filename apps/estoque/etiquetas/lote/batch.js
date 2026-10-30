/* Etiqueta Studio · Lote v1: modelo -> tabela -> prévia A4 -> impressão.
   Estado local isolado, todas as geometrias físicas em milímetros. */
(()=>{
"use strict";
const M=window.EtiquetaModel,B=window.EtiquetaBatch,R=window.EtiquetaBatchRender,F=window.EtiquetaFiles;
if(!M||!B||!R||!F)throw Error("Recursos do lote não carregados");
const $=id=>document.getElementById(id);
const TEMPLATE_KEY="appspace.estoque.etiqueta.v1";
const BATCH_KEY="appspace.estoque.lote.v1";
const byText=(tag,value,className)=>{
  const e=document.createElement(tag);
  if(value!==undefined)e.textContent=String(value);
  if(className)e.className=className;
  return e;
};
function toast(message){
  $("batch-toast").textContent=message;$("batch-toast").classList.add("visible");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("batch-toast").classList.remove("visible"),4000);
}
function loadTemplate(){
  try{
    const raw=localStorage.getItem(TEMPLATE_KEY);
    if(raw)return M.validate(JSON.parse(raw));
  }catch(e){console.warn("[Etiqueta Lote] Modelo não recuperado:",e);}
  return M.project("preco");
}
const template=loadTemplate();
let batch;try{batch=B.validateData(JSON.parse(localStorage.getItem(BATCH_KEY)||"null"),template);}
catch(e){console.warn("[Etiqueta Lote] Lista não recuperada:",e);batch=B.fresh(template);}
const fields=B.variableFields(template);
let page=0,computed=null,saveTimer=null;
function save(){
  clearTimeout(saveTimer);
  try{localStorage.setItem(BATCH_KEY,JSON.stringify(batch));$("batch-saved").textContent="Salvo localmente";}
  catch(_){$("batch-saved").textContent="Erro ao salvar";toast("Armazenamento cheio. Exporte a lista antes de sair.");}
}
function changed(){ $("batch-saved").textContent="Salvando...";clearTimeout(saveTimer);saveTimer=setTimeout(save,260);}
function fieldsSelected(){return fields.filter(f=>batch.fields.includes(f.id));}
function displayStep(step){
  if(!["model","list","preview"].includes(step))return;
  if(step==="list"&&!batch.fields.length){toast("Selecione ao menos um campo variável no modelo.");return;}
  if(step==="preview"){
    try{B.validateForPrint(template,batch);}
    catch(e){toast(e.message);if(step==="preview")$("list-error").hidden=false,$("list-error").textContent=e.message;return;}
  }
  batch.activeStep=step;
  for(const target of ["model","list","preview"]){
    $("step-"+target).hidden=step!==target;
    const button=document.querySelector('[data-step="'+target+'"]');
    if(button){if(target===step)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");}
  }
  if(step==="list"){renderTable();$("list-error").hidden=true;}
  if(step==="preview"){page=0;refreshPreview();}
  changed();
  window.scrollTo?.({top:0,behavior:"instant"});
}
function renderFields(){
  const list=$("batch-field-list");list.replaceChildren();
  if(!fields.length){
    list.append(byText("p","Este modelo ainda não tem textos editáveis. Volte ao editor para adicionar um texto ou código de barras."));
    return;
  }
  for(const field of fields){
    const label=byText("label",undefined,"batch-field");
    const check=document.createElement("input");check.type="checkbox";check.checked=batch.fields.includes(field.id);
    check.setAttribute("aria-label","Variável: "+field.name);
    label.dataset.selected=String(check.checked);
    check.addEventListener("change",()=>{
      if(check.checked&&!batch.fields.includes(field.id))batch.fields.push(field.id);
      else if(!check.checked)batch.fields=batch.fields.filter(id=>id!==field.id);
      label.dataset.selected=String(check.checked);changed();
    });
    const texts=byText("span");
    texts.append(byText("strong",field.name),byText("small",field.type==="barcode"?"Código de barras Code 39":"Texto"));
    label.append(check,texts);list.append(label);
  }
}
function displayTemplate(){
  $("model-name").textContent=template.name;
  $("model-dimensions").textContent=template.width+" × "+template.height+" mm";
  const holder=$("model-visual");holder.replaceChildren(R.labelSvg(template));
  renderFields();
}
function countSummary(){
  $("batch-row-count").textContent=batch.rows.length;
  $("batch-copies-count").textContent=B.count(batch);
  $("batch-fields-count").textContent=batch.fields.length;
}
function newRow(){
  const last=batch.rows.at(-1);
  return {id:"row-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,5),
    quantity:1,values:Object.fromEntries(fields.map(f=>[f.id,last?.values?.[f.id]??f.initial]))};
}
function renderTable(){
  countSummary();
  const head=$("batch-table-head"),body=$("batch-table-body");head.replaceChildren();body.replaceChildren();
  const row=document.createElement("tr");
  for(const label of ["#",...fieldsSelected().map(x=>x.name),"Quantidade","Ações"])
    row.append(byText("th",label));
  head.append(row);
  batch.rows.forEach((data,index)=>{
    const tr=document.createElement("tr");
    tr.append(byText("td",index+1));
    for(const field of fieldsSelected()){
      const td=document.createElement("td"),input=document.createElement("input");
      input.type="text";input.value=data.values[field.id]??"";input.maxLength=250;
      input.setAttribute("aria-label",field.name+" do item "+(index+1));
      input.placeholder=field.type==="barcode"?"Ex.: EST-001":"Digite o valor";
      input.addEventListener("input",()=>{data.values[field.id]=input.value;changed();});
      td.append(input);tr.append(td);
    }
    const qtyTd=document.createElement("td"),qty=document.createElement("input");
    qty.type="number";qty.min="1";qty.max="200";qty.step="1";qty.value=data.quantity;
    qty.setAttribute("aria-label","Quantidade do item "+(index+1));
    qty.addEventListener("change",()=>{
      const q=Number(qty.value);
      if(!Number.isInteger(q)||q<1||q>200){toast("Informe uma quantidade inteira de 1 a 200.");qty.value=data.quantity;return;}
      data.quantity=q;countSummary();changed();
    });
    qtyTd.append(qty);tr.append(qtyTd);
    const actions=document.createElement("td"),remove=byText("button","✕");
    remove.type="button";remove.setAttribute("aria-label","Excluir linha "+(index+1));
    remove.addEventListener("click",()=>{
      if(batch.rows.length===1){toast("Mantenha ao menos uma linha na lista.");return;}
      batch.rows.splice(index,1);changed();renderTable();
    });
    actions.append(remove);tr.append(actions);body.append(tr);
  });
}
function bindLayout(){
  for(let i=1;i<=10;i++){const opt=document.createElement("option");opt.value=String(i);opt.textContent=String(i);$("layout-cols").append(opt);}
  for(let i=1;i<=30;i++){const opt=document.createElement("option");opt.value=String(i);opt.textContent=String(i);$("layout-rows").append(opt);}
  const bindings={
    "layout-cols":"columns","layout-rows":"rows","layout-margin":"margin",
    "layout-gap-x":"gapX","layout-gap-y":"gapY",
    "layout-align-x":"alignX","layout-align-y":"alignY"
  };
  for(const [id,key] of Object.entries(bindings)){
    const input=$(id);input.value=String(batch.layout[key]);
    input.addEventListener("change",()=>{
      let value=input.value;
      if(key==="columns"||key==="rows")value=value==="auto"?"auto":Number(value);
      else if(["margin","gapX","gapY"].includes(key))value=Number(value);
      batch.layout[key]=value;page=0;changed();refreshPreview();
    });
  }
}
function describeLayout(result){
  const {layout,copies,pageCount}=result;
  $("batch-layout-result").textContent=layout.columns+" colunas × "+layout.rows+" linhas • "+
    layout.perPage+" etiquetas por folha • "+copies+" no total • "+pageCount+" página(s) A4.";
  $("batch-print-summary").textContent=copies+" etiquetas distribuídas em "+pageCount+" folha(s) A4. "+
    "Confira cada página antes de confirmar a impressão.";
}
function refreshPreview(){
  $("preview-error").hidden=true;
  try{
    computed=B.pages(template,batch);
    if(page>=computed.pages.length)page=computed.pages.length-1;
    if(page<0)page=0;
    describeLayout(computed);
    const svg=R.a4Page(computed.pages[page],true);
    const paper=$("batch-paper");paper.replaceChildren(svg);
    $("page-counter").textContent="Página "+(page+1)+" de "+computed.pages.length;
    $("preview-page-label").textContent="A4 • "+(page+1)+"/"+computed.pages.length;
    $("page-prev").disabled=page===0;
    $("page-next").disabled=page>=computed.pages.length-1;
    $("batch-print").disabled=false;$("batch-download").disabled=false;
  }catch(e){
    computed=null;
    $("batch-paper").replaceChildren();
    $("batch-layout-result").textContent="Ajuste a grade: "+e.message;
    $("preview-error").textContent=e.message;$("preview-error").hidden=false;
    $("page-counter").textContent="Prévia indisponível";
    $("batch-print").disabled=true;$("batch-download").disabled=true;
  }
}
function renderPages(){return B.pages(template,batch);}
async function exportPages(){
  const result=renderPages(),serializer=new XMLSerializer();
  const stem=(template.name||"etiquetas").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,45)||"etiquetas";
  if(result.pages.length===1){
    await F.save(stem+"-A4.svg",new Blob([serializer.serializeToString(R.a4Page(result.pages[0]))],{type:"image/svg+xml"}));
  }else{
    const pages=result.pages.map((data,i)=>({name:"A4-pagina-"+String(i+1).padStart(3,"0")+".svg",
      content:serializer.serializeToString(R.a4Page(data))}));
    await F.save(stem+"-A4-"+pages.length+"-folhas.zip",F.zip(pages));
  }
  toast("Arquivo preparado. No Android, escolha Arquivos ou Drive e confirme o salvamento.");
}
function nativePrinter(){
  const cap=window.Capacitor;
  if(!cap?.isNativePlatform?.())return null;
  if(!cap.isPluginAvailable?.("Printer"))return null;
  return cap.Plugins?.Printer||cap.registerPlugin?.("Printer")||null;
}
async function printBatch(){
  const result=renderPages(),printer=nativePrinter();
  if(printer?.printHtml){
    await printer.printHtml({name:"Etiqueta Studio — Lote A4",html:R.printHtml(result.pages)});
    toast("Seletor Android aberto. Escolha a impressora e a escala 100%.");
    return;
  }
  if(window.Capacitor?.isNativePlatform?.()){
    throw Error("O APK não oferece impressão nativa. Exporte o SVG/ZIP e abra em um aplicativo de impressão.");
  }
  const root=$("batch-print-root");root.replaceChildren();
  for(const items of result.pages){
    const wrapper=byText("div",undefined,"print-page");wrapper.append(R.a4Page(items));root.append(wrapper);
  }
  window.print();
}
function exportList(){
  const content={schema:1,modelIds:fields.map(f=>f.id),batch};
  return F.save("etiqueta-lista.json",new Blob([JSON.stringify(content,null,2)],{type:"application/json"}));
}
async function importList(file){
  if(!file||file.size>1000000)throw Error("Arquivo inválido ou acima de 1 MB.");
  const data=JSON.parse(await file.text());
  if(data.schema!==1||!Array.isArray(data.modelIds)||!data.modelIds.every(id=>fields.some(f=>f.id===id)))
    throw Error("A lista pertence a outro modelo. Abra o projeto original antes de importar.");
  if(!data.batch||!Array.isArray(data.batch.rows)||data.batch.rows.length>100)
    throw Error("Lista JSON inválida.");
  batch=B.validateData(data.batch,template);
  if(!batch.fields.length)throw Error("A lista não contém campos variáveis.");
  renderFields();renderTable();bindStateToLayout();changed();
}
function bindStateToLayout(){
  const bindings={"layout-cols":"columns","layout-rows":"rows","layout-margin":"margin",
    "layout-gap-x":"gapX","layout-gap-y":"gapY","layout-align-x":"alignX","layout-align-y":"alignY"};
  for(const [id,key] of Object.entries(bindings))$(id).value=String(batch.layout[key]);
}
for(const btn of document.querySelectorAll("[data-step]"))
  btn.addEventListener("click",()=>displayStep(btn.dataset.step));
$("next-list").addEventListener("click",()=>displayStep("list"));
$("back-model").addEventListener("click",()=>displayStep("model"));
$("next-preview").addEventListener("click",()=>displayStep("preview"));
$("back-list").addEventListener("click",()=>displayStep("list"));
$("add-row").addEventListener("click",()=>{
  if(batch.rows.length>=100){toast("Limite de 100 produtos por lista.");return;}
  batch.rows.push(newRow());changed();renderTable();
});
$("page-prev").addEventListener("click",()=>{if(page>0){page--;refreshPreview();}});
$("page-next").addEventListener("click",()=>{if(computed&&page<computed.pages.length-1){page++;refreshPreview();}});
$("reset-layout").addEventListener("click",()=>{
  batch.layout={columns:"auto",rows:"auto",margin:5,gapX:2,gapY:2,alignX:"center",alignY:"start"};
  bindStateToLayout();changed();page=0;refreshPreview();
});
$("batch-download").addEventListener("click",()=>void exportPages().catch(e=>toast("Falha na exportação: "+e.message)));
$("batch-print").addEventListener("click",()=>void printBatch().catch(e=>toast("Falha na impressão: "+e.message)));
$("download-list").addEventListener("click",()=>void exportList().then(()=>toast("Lista preparada para salvar.")).catch(e=>toast("Erro: "+e.message)));
$("import-list").addEventListener("click",()=>$("list-file").click());
$("list-file").addEventListener("change",e=>{
 const file=e.target.files?.[0];e.target.value="";
 if(file)void importList(file).then(()=>toast("Lista importada.")).catch(err=>toast(err.message));
});
window.addEventListener("pagehide",save);
displayTemplate();bindLayout();renderTable();
displayStep(batch.activeStep);
})();
