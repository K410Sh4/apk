/* Etiqueta Studio · modelo verificável, sem dependências externas.
   Geometria em milímetros; renderização/DOM ficam em editor.js. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  else root.EtiquetaModel=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const SCHEMA=1;
  const SVG_COLORS=/^#[0-9a-fA-F]{6}$/;
  const CODE39={
    "0":"101001101101","1":"110100101011","2":"101100101011","3":"110110010101",
    "4":"101001101011","5":"110100110101","6":"101100110101","7":"101001011011",
    "8":"110100101101","9":"101100101101","A":"110101001011","B":"101101001011",
    "C":"110110100101","D":"101011001011","E":"110101100101","F":"101101100101",
    "G":"101010011011","H":"110101001101","I":"101101001101","J":"101011001101",
    "K":"110101010011","L":"101101010011","M":"110110101001","N":"101011010011",
    "O":"110101101001","P":"101101101001","Q":"101010110011","R":"110101011001",
    "S":"101101011001","T":"101011011001","U":"110010101011","V":"100110101011",
    "W":"110011010101","X":"100101101011","Y":"110010110101","Z":"100110110101",
    "-":"100101011011",".":"110010101101"," ":"100110101101","$":"100100100101",
    "/":"100100101001","+":"100101001001","%":"101001001001","*":"100101101101"
  };
  const allowedTypes=new Set(["text","rect","ellipse","line","barcode","image"]);
  const BINDING=/^(?:product\.(?:name|price|sku|batch|expiry)|custom\.[a-z0-9_.-]{1,48})$/;
  const FIELD_LABELS=Object.freeze({"product.name":"Nome do produto","product.price":"Preço","product.sku":"Código/SKU","product.batch":"Lote","product.expiry":"Validade"});
  const presets={
    preco:{name:"Preço de prateleira",width:60,height:40},
    produto:{name:"Identificação de produto",width:80,height:50},
    endereco:{name:"Endereço / localização",width:100,height:50},
    codigo:{name:"Etiqueta com código",width:70,height:35},
    vazio:{name:"Em branco",width:60,height:40}
  };
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(n))?Number(n):min));
  const color=(c,def)=>typeof c==="string"&&SVG_COLORS.test(c)?c:def;
  const safeText=(s,max=250)=>String(s??"").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,"").slice(0,max);
  const uid=()=>Math.random().toString(36).slice(2,10);
  function element(type,raw={}){
    if(!allowedTypes.has(type))throw Error("Tipo de elemento não permitido");
    const x=clamp(raw.x??4,-100,310),y=clamp(raw.y??4,-100,400);
    const o={
      id:typeof raw.id==="string"&&/^[a-zA-Z0-9_-]{1,24}$/.test(raw.id)?raw.id:uid(),
      type,x,y,w:clamp(raw.w??30,1,240),h:clamp(raw.h??12,1,320),
      binding:typeof raw.binding==="string"&&BINDING.test(raw.binding)?raw.binding:"",
      text:safeText(raw.text??(type==="barcode"?"123456":type==="text"?"Novo texto":"")),
      fontSize:clamp(raw.fontSize??4.5,1.3,24),
      fontFamily:["Arial","Georgia","Verdana","Courier New"].includes(raw.fontFamily)?raw.fontFamily:"Arial",
      weight:raw.weight===700?700:400,
      align:["left","center","right"].includes(raw.align)?raw.align:"left",
      fill:color(raw.fill,"#111827"),background:color(raw.background,"#ffffff"),
      stroke:color(raw.stroke,"#111827"),strokeWidth:clamp(raw.strokeWidth??0,0,4),
      radius:clamp(raw.radius??1,0,20),
      image:null
    };
    if(type==="image"){
      if(typeof raw.image==="string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.image) && raw.image.length<=2100000) o.image=raw.image;
      else throw Error("Imagem inválida: use PNG, JPEG ou WebP de até 1,5 MB");
    }
    if(type==="barcode"){
      // Rejeitar caracteres inválidos: nunca apagar caracteres de SKU.
      o.text=o.text.toUpperCase();
      if(!barcodeBits(o.text))throw Error("Code 39 inválido: use A–Z, 0–9, espaço, - . $ / + % (1–24 caracteres)");
    }
    return o;
  }
  function project(template="preco"){
    const t=presets[template]||presets.preco;
    const base={schema:SCHEMA,name:t.name,width:t.width,height:t.height,background:"#ffffff",objects:[]};
    const add=(type,o)=>base.objects.push(element(type,o));
    if(template==="preco"){
      add("text",{x:4,y:4,w:52,h:9,text:"NOME DO PRODUTO",fontSize:4.2,weight:700,binding:"product.name"});
      add("line",{x:4,y:14,w:52,h:0.5,stroke:"#d1d5db",strokeWidth:0.45});
      add("text",{x:4,y:17,w:52,h:12,text:"R$ 29,90",fontSize:9,weight:700,binding:"product.price"});
      add("text",{x:4,y:32,w:52,h:5,text:"SKU: 001 • Unidade",fontSize:2.8});
    }else if(template==="produto"){
      add("text",{x:5,y:5,w:70,h:9,text:"IDENTIFICAÇÃO DO PRODUTO",fontSize:4.5,weight:700});
      add("line",{x:5,y:15,w:70,h:0.5,stroke:"#d1d5db",strokeWidth:0.4});
      add("text",{x:5,y:18,w:70,h:7,text:"Produto: Descrição",fontSize:4});
      add("text",{x:5,y:28,w:70,h:7,text:"Lote: 001    Validade: 12/2027",fontSize:3.6});
      add("text",{x:5,y:39,w:70,h:6,text:"Código interno: EST-0001",fontSize:3});
    }else if(template==="endereco"){
      add("text",{x:5,y:5,w:90,h:9,text:"ALMOXARIFADO • SETOR A",fontSize:5.2,weight:700});
      add("text",{x:5,y:18,w:90,h:13,text:"CORREDOR 01 / PRATELEIRA 02",fontSize:5.7,weight:700});
      add("text",{x:5,y:37,w:90,h:6,text:"POSIÇÃO: A-01-02",fontSize:3.9});
    }else if(template==="codigo"){
      add("text",{x:3,y:3,w:64,h:6,text:"ETIQUETA DE ESTOQUE",fontSize:4,weight:700,align:"center"});
      add("barcode",{x:5,y:12,w:60,h:14,text:"EST-001",binding:"product.sku"});
      add("text",{x:5,y:29,w:60,h:4,text:"EST-001",align:"center",fontSize:3,binding:"product.sku"});
    }
    return base;
  }
  function validate(input){
    if(!input||typeof input!=="object"||Array.isArray(input)||input.schema!==SCHEMA)throw Error("Modelo de etiqueta incompatível");
    if(!Array.isArray(input.objects)||input.objects.length>100)throw Error("Número de elementos inválido");
    const doc={
      schema:SCHEMA,name:safeText(input.name||"Minha etiqueta",80),
      width:clamp(input.width,20,210),height:clamp(input.height,15,297),
      background:color(input.background,"#ffffff"),
      objects:input.objects.map(o=>element(o?.type,o))
    };
    // Migração conservadora de modelos v1. Um binding explícito vazio significa campo fixo.
    const legacy=doc.objects.some((o,i)=>input.objects[i]?.binding===undefined);
    if(legacy){
      const barcodes=new Set(doc.objects.filter(o=>o.type==="barcode").map(o=>o.text));
      doc.objects.forEach((o,i)=>{
        if(input.objects[i]?.binding!==undefined)return;
        if(o.type==="text"&&o.text==="NOME DO PRODUTO")o.binding="product.name";
        else if(o.type==="text"&&o.text==="R$ 29,90")o.binding="product.price";
        else if((o.type==="barcode"||o.type==="text")&&barcodes.has(o.text))o.binding="product.sku";
      });
    }
    const ids=new Set();
    doc.objects.forEach(o=>{if(ids.has(o.id))o.id=uid();ids.add(o.id)});
    return doc;
  }
  function barcodeBits(value){
    const text=safeText(value,250).toUpperCase();
    if(!/^[0-9A-Z. $\\/+%-]{1,24}$/.test(text))return null;
    return {text,bits:("*"+text+"*").split("").map(c=>CODE39[c]).join("0")};
  }

  // O layout de texto tem uma única regra para o editor e a impressão.
  // Não trunca sem avisar: qualquer conteúdo omitido invalida a impressão.
  function textLayout(value,fontSize,width,height){
    const text=String(value??"");
    const limit=Math.max(1,Math.floor(width/(fontSize*.53)));
    const maxLines=Math.max(1,Math.floor(height/(fontSize*1.18)));
    const all=[];
    for(const paragraph of text.split("\n")){
      let line="";
      for(const word of paragraph.split(/\s+/)){
        if(!word)continue;
        if(line&&line.length+1+word.length>limit){all.push(line);line="";}
        if(word.length>limit){
          if(line){all.push(line);line="";}
          for(let i=0;i<word.length;i+=limit){const part=word.slice(i,i+limit);
            if(i+limit<word.length)all.push(part);else line=part;}
        }else line=line?line+" "+word:word;
      }
      all.push(line);
    }
    return {lines:all.slice(0,maxLines),overflow:all.length>maxLines,fullLines:all.length};
  }
  function validateForOutput(input){
    const doc=validate(input);
    for(const o of doc.objects){
      if(o.x<0||o.y<0||o.x+o.w>doc.width+.001||o.y+o.h>doc.height+.001)
        throw Error("Elemento fora dos limites da etiqueta: "+o.type+". Reposicione antes de produzir.");
      if(o.type==="text"&&textLayout(o.text,o.fontSize,o.w,o.h).overflow)
        throw Error("Texto não cabe na etiqueta: "+o.text.slice(0,45)+". Aumente a área ou reduza a fonte.");
      if(o.type==="barcode"){
        const code=barcodeBits(o.text);
        if(!code)throw Error("Código de barras inválido: "+o.text);
        if((o.w-2*Math.min(2.5,o.w*.065))/code.bits.length<.19)
          throw Error("Código de barras muito denso para impressão confiável. Aumente sua largura.");
      }
    }
    return doc;
  }
  function layoutA4(width,height,settings={}){
    width=clamp(width,20,210);height=clamp(height,15,297);
    const margin=clamp(settings.margin??5,0,30);
    const gapX=clamp(settings.gapX??2,0,20),gapY=clamp(settings.gapY??2,0,20);
    const areaW=210-2*margin,areaH=297-2*margin;
    const maxCols=Math.floor((areaW+gapX)/(width+gapX));
    const maxRows=Math.floor((areaH+gapY)/(height+gapY));
    if(maxCols<1||maxRows<1)throw Error("A etiqueta não cabe na folha A4 com a margem escolhida.");
    const columns=settings.columns==="auto"||settings.columns==null?maxCols:Math.floor(Number(settings.columns));
    const rows=settings.rows==="auto"||settings.rows==null?maxRows:Math.floor(Number(settings.rows));
    if(!Number.isFinite(columns)||!Number.isFinite(rows)||columns<1||rows<1||
       columns>maxCols||rows>maxRows)throw Error("A grade excede o espaço A4.");
    const startSlot=clamp(Math.floor(Number(settings.startSlot??1)),1,300);
    if(startSlot>columns*rows)throw Error("A primeira posição excede os espaços desta folha. Ajuste a posição inicial.");
    const occupiedW=columns*width+(columns-1)*gapX,occupiedH=rows*height+(rows-1)*gapY;
    const factor=v=>v==="end"?1:v==="center"?.5:0;
    const startX=margin+(areaW-occupiedW)*factor(settings.alignX);
    const startY=margin+(areaH-occupiedH)*factor(settings.alignY);
    const positions=[];
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)
      positions.push({x:startX+col*(width+gapX),y:startY+row*(height+gapY),row,col});
    return {columns,rows,perPage:columns*rows,positions,maxCols,maxRows,
      occupiedW,occupiedH,margin,gapX,gapY,startSlot};
  }
  // Compatibilidade para a antiga prévia do Studio: apenas o posicionamento visual.
  function sheet(width,height,gap=2,margin=5){
    try{
      const layout=layoutA4(width,height,{gapX:gap,gapY:gap,margin,alignX:"start",alignY:"start"});
      return {columns:layout.columns,rows:layout.rows,perPage:layout.perPage,
        positions:layout.positions.map(({x,y})=>({x,y}))};
    }catch(_){return {columns:0,rows:0,perPage:0,positions:[]};}
  }
  return Object.freeze({SCHEMA,presets,element,project,validate,validateForOutput,textLayout,barcodeBits,sheet,layoutA4,clamp,FIELD_LABELS});
});
