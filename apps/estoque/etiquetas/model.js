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
      text:safeText(raw.text??(type==="barcode"?"123456":type==="text"?"Novo texto":"")),
      fontSize:clamp(raw.fontSize??4.5,1.3,24),
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
    return o;
  }
  function project(template="preco"){
    const t=presets[template]||presets.preco;
    const base={schema:SCHEMA,name:t.name,width:t.width,height:t.height,background:"#ffffff",objects:[]};
    const add=(type,o)=>base.objects.push(element(type,o));
    if(template==="preco"){
      add("text",{x:4,y:4,w:52,h:9,text:"NOME DO PRODUTO",fontSize:4.2,weight:700});
      add("line",{x:4,y:14,w:52,h:0.5,stroke:"#d1d5db",strokeWidth:0.45});
      add("text",{x:4,y:17,w:52,h:12,text:"R$ 29,90",fontSize:9,weight:700});
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
      add("barcode",{x:5,y:12,w:60,h:14,text:"EST-001"});
      add("text",{x:5,y:29,w:60,h:4,text:"EST-001",align:"center",fontSize:3});
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
    const ids=new Set();
    doc.objects.forEach(o=>{if(ids.has(o.id))o.id=uid();ids.add(o.id)});
    return doc;
  }
  function barcodeBits(value){
    const text=safeText(value,40).toUpperCase().replace(/[^0-9A-Z.\- $/+%]/g,"").slice(0,24);
    if(!text)return null;
    return {text,bits:("*"+text+"*").split("").map(c=>CODE39[c]).join("0")};
  }
  function sheet(width,height,gap=2,margin=5){
    width=clamp(width,20,210);height=clamp(height,15,297);
    gap=clamp(gap,0,20);margin=clamp(margin,0,30);
    const columns=Math.floor((210-2*margin+gap)/(width+gap));
    const rows=Math.floor((297-2*margin+gap)/(height+gap));
    if(columns<1||rows<1)return {columns:0,rows:0,perPage:0,positions:[]};
    const positions=[];
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)
      positions.push({x:margin+col*(width+gap),y:margin+row*(height+gap)});
    return {columns,rows,perPage:columns*rows,positions};
  }
  return Object.freeze({SCHEMA,presets,element,project,validate,barcodeBits,sheet,clamp});
});
