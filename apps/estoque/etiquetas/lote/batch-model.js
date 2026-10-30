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
  // IDs do canvas nunca são chaves de dados de produto; bindings semânticos são.
  function variableFields(template){
    const objects=M.validate(template).objects.filter(o=>o.type==="text"||o.type==="barcode");
    const fields=new Map();
    for(const o of objects){
      const id=o.binding||o.id;
      if(!fields.has(id))fields.set(id,{id,type:o.type,name:M.FIELD_LABELS?.[id]||o.text.slice(0,45)||"Campo vazio",
        initial:o.text,objectIds:[]});
      const field=fields.get(id);field.objectIds.push(o.id);
      if(o.type==="barcode"){field.type="barcode";field.initial=o.text;}
    }
    return [...fields.values()];
  }
  function defaultFields(template){
    const defs=variableFields(template);
    const bound=defs.filter(f=>f.id.startsWith("product."));
    if(bound.length)return bound.map(f=>f.id);
    const selected=defs.filter(f=>f.type==="text").slice(0,2);
    if(!selected.length&&defs.length)selected.push(defs[0]);
    return selected.map(f=>f.id);
  }
  function fresh(template){
    const selected=defaultFields(template);
    const defs=variableFields(template);
    return {version:2,fields:selected,
      rows:[{id:"row-1",quantity:1,values:Object.fromEntries(defs.map(f=>[f.id,f.initial]))}],
      layout:{columns:"auto",rows:"auto",margin:5,gapX:2,gapY:2,alignX:"center",alignY:"start",startSlot:1},
      activeStep:"model"};
  }
  function validateData(raw,template){
    const defs=variableFields(template),byId=new Map();
    for(const f of defs)for(const id of [f.id,...f.objectIds])byId.set(id,f.id);
    if(!raw||typeof raw!=="object")return fresh(template);
    const originalFields=Array.isArray(raw.fields)?raw.fields.filter(x=>typeof x==="string"):[];
    const mapped=[...new Set(originalFields.map(id=>byId.get(id)).filter(Boolean))];
    const fields=mapped.length?mapped:defaultFields(template);
    const rows=Array.isArray(raw.rows)?raw.rows.slice(0,100).map((r,i)=>{
      const source=r?.values&&typeof r.values==="object"?r.values:{},values={};
      // Reter apenas chaves reconhecidas do domínio ou da interface antiga para não
      // perder a tabela quando o usuário troca o desenho. Os dados não são renderizados
      // nem executados por essas chaves extras.
      for(const [key,value] of Object.entries(source).slice(0,150))
        if(/^[a-zA-Z0-9_.-]{1,80}$/.test(key))values[key]=safe(value);
      for(const def of defs){
        const candidates=[def.id,...originalFields.filter(id=>byId.get(id)===def.id),...def.objectIds];
        const found=candidates.find(id=>Object.prototype.hasOwnProperty.call(source,id));
        values[def.id]=safe(found===undefined?def.initial:source[found]);
      }
      return {id:typeof r?.id==="string"&&/^[a-zA-Z0-9_-]{1,40}$/.test(r.id)?r.id:"row-"+(i+1),
        quantity:clamp(Math.floor(+r?.quantity||1),1,200),values};
    }):[];
    const x=raw.layout||{};
    const layout={
      columns:x.columns==="auto"?"auto":clamp(Math.floor(+x.columns),1,10),
      rows:x.rows==="auto"?"auto":clamp(Math.floor(+x.rows),1,30),
      margin:clamp(x.margin??5,0,25),
      gapX:clamp(x.gapX??2,0,20),gapY:clamp(x.gapY??2,0,20),
      alignX:alignments.includes(x.alignX)?x.alignX:"center",
      alignY:alignments.includes(x.alignY)?x.alignY:"start",
      startSlot:clamp(Math.floor(+x.startSlot||1),1,300)
    };
    if(!rows.length)rows.push({id:"row-1",quantity:1,values:Object.fromEntries(defs.map(f=>[f.id,f.initial]))});
    return {version:2,fields,rows,layout,activeStep:["model","list","preview"].includes(raw.activeStep)?raw.activeStep:"model"};
  }
  function calculate(template,layout){
    const doc=M.validate(template);
    // Somente LabelModel calcula posições A4; a produção usa o mesmo PageSpec.
    return M.layoutA4(doc.width,doc.height,layout);
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
    const fieldDefs=variableFields(doc),valid=new Set(fieldDefs.map(f=>f.id));
    for(const field of batch.fields)if(!valid.has(field))throw Error("Campo variável não existe mais no modelo.");
    for(const row of batch.rows){
      if(!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>200)throw Error("Quantidade inválida; use 1 a 200 por item.");
      for(const field of batch.fields){
        const element=doc.objects.find(o=>(o.binding||o.id)===field&&o.type==="barcode");
        const value=safe(row.values[field]??"");
        if(element&&!M.barcodeBits(value))
          throw Error("Código de barras inválido na linha "+(batch.rows.indexOf(row)+1)+". Use Code 39 (1–24 caracteres).");
      }
    }
    // Validar todos os valores renderizados, não apenas a linha atualmente visível.
    const checked=new Set();
    for(const data of items(doc,batch)){
      const sig=JSON.stringify(data.objects);
      if(checked.has(sig))continue;
      checked.add(sig);M.validateForOutput(data);
    }
    return {layout,copies,pageCount:Math.ceil((copies+layout.startSlot-1)/layout.perPage)};
  }
  function* items(template,batch){
    const doc=M.validate(template);
    for(const row of batch.rows)for(let n=0;n<row.quantity;n++){
      const objects=doc.objects.map(obj=>{
        const key=obj.binding||obj.id;
        if(!batch.fields.includes(key))return obj;
        return {...obj,text:obj.type==="barcode"?String(row.values[key]??"").toUpperCase():safe(row.values[key]??"")};
      });
      yield {...doc,objects};
    }
  }
  // Apenas a página solicitada: não materializa até 500 etiquetas a cada navegação.
  function previewPage(template,batch,index=0){
    const verified=validateForPrint(template,batch);
    const pageIndex=clamp(Math.floor(index),0,verified.pageCount-1);
    const start=pageIndex*verified.layout.perPage;
    const offset=verified.layout.startSlot-1;
    const first=Math.max(0,start-offset),last=Math.min(verified.copies,start+verified.layout.perPage-offset);
    const itemsOnPage=[];
    if(first<last){
      const iterator=items(template,batch);
      for(let i=0;i<first;i++)iterator.next();
      for(let i=first;i<last;i++){
        const next=iterator.next();
        if(next.done)break;
        itemsOnPage.push({label:next.value,position:verified.layout.positions[i+offset-start]});
      }
    }
    return {...verified,pageIndex,items:itemsOnPage};
  }
  function pages(template,batch){
    const verified=validateForPrint(template,batch),result=[];
    for(let i=0;i<verified.pageCount;i++)result.push([]);
    let i=verified.layout.startSlot-1;
    for(const label of items(template,batch)){
      const pageIndex=Math.floor(i/verified.layout.perPage);
      result[pageIndex].push({label,position:verified.layout.positions[i%verified.layout.perPage]});
      i++;
    }
    return {...verified,pages:result};
  }

  // CSV separado por ponto e vírgula, compatível com editores de planilha pt-BR.
  // Células iniciadas por fórmulas são prefixadas com apóstrofo ao exportar.
  const csvCell=value=>{
    let text=String(value??"");
    if(/^[=+@-]|^[\t\r]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  function toCsv(template,batch){
    const defs=variableFields(template).filter(f=>batch.fields.includes(f.id));
    if(!defs.length)throw Error("Selecione campos variáveis antes de exportar CSV.");
    const header=["Quantidade",...defs.map(f=>f.name+" ["+f.id+"]")];
    const rows=batch.rows.map(row=>[row.quantity,...defs.map(f=>row.values[f.id]??"")]);
    return "\ufeff"+[header,...rows].map(cells=>cells.map(csvCell).join(";")).join("\r\n")+"\r\n";
  }
  function parseCsv(text){
    if(typeof text!=="string"||text.length>200000)throw Error("CSV inválido ou maior que 200 KB.");
    const result=[],row=[];let cell="",quoted=false;
    const source=text.replace(/^\uFEFF/,"");
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(quoted){
        if(ch==='"'&&source[i+1]==='"'){cell+='"';i++;}
        else if(ch==='"')quoted=false;
        else cell+=ch;
      }else if(ch==='"'){
        if(cell.length)throw Error("CSV com aspas em posição inválida.");
        quoted=true;
      }else if(ch===';'){row.push(cell);cell="";}
      else if(ch==='\n'||ch==='\r'){
        if(ch==='\r'&&source[i+1]==='\n')i++;
        row.push(cell);result.push(row.splice(0));cell="";
      }else cell+=ch;
    }
    if(quoted)throw Error("CSV com aspas não fechadas.");
    if(cell!==""||row.length){row.push(cell);result.push(row);}
    return result.filter(r=>r.some(v=>v.trim()!==""));
  }
  function fromCsv(text,template,current){
    const data=parseCsv(text);
    if(data.length<2||data.length>101)throw Error("CSV exige cabeçalho e 1 a 100 produtos.");
    const defs=variableFields(template);
    const names=data[0].map(x=>x.trim().toLocaleLowerCase("pt-BR"));
    if(names[0]!=="quantidade")throw Error("A primeira coluna do CSV deve ser Quantidade.");
    if(new Set(names).size!==names.length)throw Error("CSV contém colunas duplicadas.");
    const mapping=names.slice(1).map(name=>{
      const found=defs.filter(f=>name===(f.name+" ["+f.id+"]").toLocaleLowerCase("pt-BR")||
        name===f.id.toLocaleLowerCase("pt-BR")||name===f.name.toLocaleLowerCase("pt-BR"));
      if(found.length!==1)throw Error("Coluna não reconhecida ou ambígua: "+name.slice(0,70));
      return found[0];
    });
    if(!mapping.length||new Set(mapping.map(f=>f.id)).size!==mapping.length)
      throw Error("CSV precisa de ao menos um campo editável sem duplicatas.");
    const rows=data.slice(1).map((cells,index)=>{
      if(cells.length!==names.length)throw Error("Número de colunas incorreto na linha "+(index+2)+".");
      if(!/^[0-9]+$/.test(cells[0].trim()))throw Error("Quantidade inválida na linha "+(index+2)+".");
      const quantity=Number(cells[0].trim());
      if(quantity<1||quantity>200)throw Error("Quantidade deve ser de 1 a 200 na linha "+(index+2)+".");
      const values=Object.fromEntries(defs.map(f=>[f.id,f.initial]));
      mapping.forEach((field,i)=>{
        const raw=cells[i+1];
        values[field.id]=safe(raw.startsWith("'")&&/^[=+@-]/.test(raw.slice(1))?raw.slice(1):raw);
      });
      return {id:"row-"+(index+1),quantity,values};
    });
    const result=validateData({...current,fields:mapping.map(f=>f.id),rows,activeStep:"list"},template);
    if(count(result)>500)throw Error("O CSV ultrapassa 500 etiquetas; reduza as cópias.");
    return result;
  }
  return Object.freeze({variableFields,defaultFields,fresh,validateData,calculate,count,validateForPrint,items,previewPage,pages,toCsv,fromCsv});
});
