"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const M=require("../apps/estoque/etiquetas/model.js");
for(const key of Object.keys(M.presets)){
  const d=M.project(key);
  assert.ok(d.width>=20&&d.width<=210);
  assert.ok(d.height>=15&&d.height<=297);
  assert.deepEqual(M.validate(JSON.parse(JSON.stringify(d))),d,"Modelo "+key+" deve sobreviver a exportação/importação");
}
const barcode=M.barcodeBits("est-001");
assert.equal(barcode.text,"EST-001");
assert.ok(barcode.bits.startsWith("100101101101"),"Code39 exige delimitador de início");
assert.ok(barcode.bits.endsWith("100101101101"),"Code39 exige delimitador de fim");
assert.equal(M.barcodeBits("!!!"),null,"Texto inválido não deve gerar código");
assert.equal(M.barcodeBits("ABC_123"),null,"Code 39 não pode remover caracteres do SKU silenciosamente");
assert.equal(M.barcodeBits("1234567890123456789012345"),null,"Código longo não pode ser truncado");
assert.equal(M.barcodeBits("A/B-01")?.text,"A/B-01","Caracteres válidos devem permanecer intactos");
assert.throws(()=>M.element("barcode",{text:"ABC_123"}),/Code 39 inválido/);
assert.throws(()=>M.validate({schema:1,width:60,height:40,objects:[{type:"barcode",text:"AA_0001"}]}),/Code 39 inválido/);
assert.equal(M.element("barcode",{text:"est-001"}).text,"EST-001");

const layout=M.sheet(60,40,2,5);
assert.equal(layout.columns,3);assert.equal(layout.rows,6);assert.equal(layout.perPage,18);
assert.equal(layout.positions[0].x,5);assert.equal(layout.positions[0].y,5);
assert.ok(layout.positions.every(p=>p.x+60<=210&&p.y+40<=297));
const payload=M.project("vazio");
payload.objects.push({type:"text",text:"<script>alert(1)</script>",fill:"url(https://example.com)",x:4,y:4,w:50,h:10});
const validated=M.validate(payload);
assert.equal(validated.objects[0].text,"<script>alert(1)</script>");
assert.equal(validated.objects[0].fill,"#111827","Cor injetada rejeitada");
assert.throws(()=>M.element("script"),/não permitido/);
assert.throws(()=>M.element("image",{image:"https://evil.test/pixel.png"}),/inválida/);
assert.throws(()=>M.validate({schema:2,objects:[]}),/incompatível/);
assert.throws(()=>M.validate({schema:1,objects:new Array(101).fill({type:"rect"})}),/inválido/);
const html=fs.readFileSync(path.join(root,"apps/estoque/etiquetas/index.html"),"utf8");
const controller=fs.readFileSync(path.join(root,"apps/estoque/etiquetas/editor.js"),"utf8");
new Function(controller);
for(const id of ["label-canvas","label-width","label-height","item-text","download-svg",
  "download-png","download-sheet","print-sheet","import-project","download-project","undo-btn","redo-btn"]){
  assert.ok(html.includes('id="'+id+'"'),"Controle ausente: "+id);
}
assert.ok(controller.includes("setPointerCapture"));
assert.ok(controller.includes("localStorage.setItem"));
assert.ok(controller.includes("window.print()"));
assert.ok(controller.includes("M.sheet("));
assert.ok(controller.includes("EtiquetaFiles.zip"),"Folhas múltiplas precisam ser exportáveis");
const vm=require("node:vm");
const exporterSource=fs.readFileSync(path.join(root,"apps/estoque/etiquetas/files.js"),"utf8");
const sandbox={window:{},Blob,TextEncoder,Uint8Array,Uint32Array,DataView,btoa,setTimeout,URL,document:{}};
vm.runInNewContext(exporterSource,sandbox,{filename:"files.js"});
const packed=sandbox.window.EtiquetaFiles.zip([
  {name:"A4-pagina-01.svg",content:"<svg>primeira</svg>"},
  {name:"A4-pagina-02.svg",content:"<svg>segunda</svg>"}
]);
assert.equal(packed.type,"application/zip");
assert.ok(packed.size>100,"ZIP multipágina não pode estar vazio");
(async()=>{
  const bytes=new Uint8Array(await packed.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50,"Cabeçalho ZIP incorreto");
  assert.equal(view.getUint32(bytes.length-22,true),0x06054b50,"Diretório ZIP incorreto");
  assert.equal(view.getUint16(bytes.length-12,true),2,"ZIP deve conter duas páginas");
  const mockCap={isNativePlatform:()=>true,isPluginAvailable:x=>["Filesystem","Share"].includes(x),Plugins:{}};
  let wrote=null,shared=null;
  mockCap.Plugins.Filesystem={writeFile:async x=>{wrote=x;},getUri:async()=>({uri:"file:///cache/meu-projeto.json"})};
  mockCap.Plugins.Share={share:async x=>{shared=x;}};
  sandbox.window.Capacitor=mockCap;
  const result=await sandbox.window.EtiquetaFiles.save("meu-projeto.json",new Blob(["{}"],{type:"application/json"}));
  assert.equal(result,"shared");
  assert.equal(wrote.directory,"CACHE");
  assert.equal(wrote.data,"e30=");
  assert.equal(shared.files[0],"file:///cache/meu-projeto.json");
  console.log("[Etiqueta Studio] ZIP multipágina e exportação nativa simulada: OK");
})().catch(e=>{console.error(e);process.exitCode=1;});

console.log("[Etiqueta Studio] 5 modelos, Code39, A4, importação segura e controles SVG: OK");
