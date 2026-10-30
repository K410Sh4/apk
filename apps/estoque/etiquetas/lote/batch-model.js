/* Etiqueta Studio · produção em lote: modelo puro, independente do DOM/Android. */
(function(root,factory){
  const api=factory(typeof module==="object"&&module.exports?require("../model.js"):root.EtiquetaModel);
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.EtiquetaBatch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(M){
  "use strict";
  if(!M)throw Error("Modelo de etiquetas não carregado");
  const safe=s=>String(s??"").replace(/[\u0000-\u001f\u007f]/g,"").slice(0,250);
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(+n)?+n:min));
  const alignments=["start","center","end"];
  const variableFields=template=>M.validate(template).objects
    .filter(o=>o.type==="text"||o.type==="barcode")
    .map(o=>({id:o.id,type:o.type,name:o.text.slice(0,45)||"Campo vazio",initial:o.text}));
  function defaultFields(template){
    const fields=variableFields(template);
    // Seleção inicial explícita: máximo dois campos variáveis; os demais são fixos.
    const selected=fields.filter(o=>o.type==="text").slice(0,2);
    if(!selected.length&&fields.length)selected.push(fields[0]);
    return selected.map(o=>o.id);
  }
  function fresh(template){
    const selected=defaultFields(template);
    const defs=variableFields(template);
    return {version:1,fields:selected,
      rows:[{id:"row-1",quantity:1,values:Object.fromEntries(defs.map(f=>[f.id,f.initial]))}],
      layout:{columns:"auto",rows:"auto",margin:5,gapX:2,gapY:2,alignX:"center",alignY:"start"},
      activeStep:"model"};
  }
  function validateData(raw,template){
    const defs=variableFields(template),ids=new Set(defs.map(x=>x.id));
    if(!raw||typeof raw!=="object")return fresh(template);
    const fields=Array.isArray(raw.fields)?[...new Set(raw.fields.filter(id=>ids.has(id)))]:defaultFields(template);
    const rows=Array.isArray(raw.rows)?raw.rows.slice(0,100).map((r,i)=>({
      id:typeof r?.id==="string"&&/^[a-zA-Z0-9_-]{1,40}$/.test(r.id)?r.id:"row-"+(i+1),
      quantity:clamp(Math.floor(+r?.quantity||1),1,200),
      values:Object.fromEntries(defs.map(f=>[f.id,safe(r?.values?.[f.id]??f.initial)]))
    })):[];
    const x=raw.layout||{};
    const layout={
      columns:x.columns==="auto"?"auto":clamp(Math.floor(+x.columns),1,10),
      rows:x.rows==="auto"?"auto":clamp(Math.floor(+x.rows),1,30),
      margin:clamp(x.margin??5,0,25),
      gapX:clamp(x.gapX??2,0,20),gapY:clamp(x.gapY??2,0,20),
      alignX:alignments.includes(x.alignX)?x.alignX:"center",
      alignY:alignments.includes(x.alignY)?x.alignY:"start"
    };
    if(!rows.length)rows.push({id:"row-1",quantity:1,values:Object.fromEntries(defs.map(f=>[f.id,f.initial]))});
    return {version:1,fields,rows,layout,activeStep:["model","list","preview"].includes(raw.activeStep)?raw.activeStep:"model"};
  }
  function calculate(template,layout){
    const {width:w,height:h}=M.validate(template);
    const margin=clamp(layout.margin,0,25),gapX=clamp(layout.gapX,0,20),gapY=clamp(layout.gapY,0,20);
    const areaW=210-2*margin,areaH=297-2*margin;
    const maxCols=Math.floor((areaW+gapX)/(w+gapX)),maxRows=Math.floor((areaH+gapY)/(h+gapY));
    if(maxCols<1||maxRows<1)throw Error("A etiqueta não cabe na folha A4 com a margem escolhida.");
    const cols=layout.columns==="auto"?maxCols:Math.floor(+layout.columns);
    const rows=layout.rows==="auto"?maxRows:Math.floor(+layout.rows);
    if(!(cols>=1&&cols<=maxCols&&rows>=1&&rows<=maxRows))
      throw Error("A grade excede o espaço A4. Reduza colunas, linhas, margens ou espaçamento.");
    const occupiedW=cols*w+(cols-1)*gapX,occupiedH=rows*h+(rows-1)*gapY;
    const factor=v=>v==="end"?1:v==="center"?.5:0;
    const startX=margin+(areaW-occupiedW)*factor(layout.alignX);
    const startY=margin+(areaH-occupiedH)*factor(layout.alignY);
    const positions=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)
      positions.push({x:startX+col*(w+gapX),y:startY+row*(h+gapY),row,col});
    return {columns:cols,rows,perPage:cols*rows,positions,maxCols,maxRows,
      occupiedW,occupiedH,margin,gapX,gapY};
  }
  function count(batch){
    return batch.rows.reduce((sum,row)=>sum+(Number.isInteger(row.quantity)?row.quantity:0),0);
  }
  function validateForPrint(template,batch){
    const doc=M.validate(template),layout=calculate(doc,batch.layout);
    if(!batch.fields.length)throw Error("Escolha pelo menos um campo variável na etapa Modelo.");
    if(!batch.rows.length)throw Error("Adicione pelo menos uma etiqueta à lista.");
    const copies=count(batch);
    if(copies<1||copies>500)throw Error("Limite de 500 etiquetas por lote. Reduza as quantidades.");
    const valid=new Set(variableFields(doc).map(f=>f.id));
    for(const field of batch.fields)if(!valid.has(field))throw Error("Campo variável não existe mais no modelo.");
    for(const row of batch.rows){
      if(!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>200)throw Error("Quantidade inválida; use 1 a 200 por item.");
      for(const field of batch.fields){
        const element=doc.objects.find(o=>o.id===field);
        const value=safe(row.values[field]??"");
        if(element.type==="barcode"&&!M.barcodeBits(value))
          throw Error("Código de barras inválido na linha "+(batch.rows.indexOf(row)+1)+". Use Code 39 (1–24 caracteres).");
      }
    }
    return {layout,copies,pageCount:Math.ceil(copies/layout.perPage)};
  }
  function* items(template,batch){
    const doc=M.validate(template);
    for(const row of batch.rows)for(let n=0;n<row.quantity;n++){
      const objects=doc.objects.map(obj=>{
        if(!batch.fields.includes(obj.id))return obj;
        return {...obj,text:obj.type==="barcode"?String(row.values[obj.id]??"").toUpperCase():safe(row.values[obj.id]??"")};
      });
      yield {...doc,objects};
    }
  }
  function pages(template,batch){
    const verified=validateForPrint(template,batch),all=[...items(template,batch)],result=[];
    for(let start=0;start<all.length;start+=verified.layout.perPage){
      result.push(all.slice(start,start+verified.layout.perPage).map((label,i)=>({
        label,position:verified.layout.positions[i]
      })));
    }
    return {...verified,pages:result};
  }
  return Object.freeze({variableFields,defaultFields,fresh,validateData,calculate,count,validateForPrint,items,pages});
});
