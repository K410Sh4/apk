'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function loadModule(name, overrides = {}, globals = {}) {
  const module = {exports:{}};
  vm.runInNewContext(source(name), {module, exports:module.exports,
    require:id => Object.hasOwn(overrides,id) ? overrides[id] : require(id),
    console, Buffer, URL, Response, AbortSignal, setTimeout, clearTimeout, ...globals}, {filename:name});
  return module.exports;
}
class Node {
  constructor() { this.listeners={}; this.children=[]; this.attributes={}; this.dataset={}; this.style={setProperty(){}}; this.value=''; this.textContent=''; this.hidden=false; this.classList={add(){},remove(){}}; }
  addEventListener(type,fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type,event={}) { event.target ||= this; event.preventDefault ||= ()=>{}; for(const fn of this.listeners[type]||[]) fn(event); }
  append(...nodes) { for(const node of nodes) { if(node.parent) node.parent.children.splice(node.parent.children.indexOf(node),1); node.parent=this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children=[]; this.append(...nodes); }
  get childNodes() {return this.children;}
  get firstChild() {return this.children[0]||null;}
  setAttribute(name,value) {this.attributes[name]=String(value);}
  getAttribute(name) {return this.attributes[name]||null;}
  closest(selector) {return selector==='[data-resize-id]' && this.attributes['data-resize-id'] ? this : selector==='[data-item-id]' && this.attributes['data-item-id'] ? this : null;}
  cloneNode(deep) {const n=new Node();n.attributes={...this.attributes}; if(deep)n.append(...this.children.map(x=>x.cloneNode(true)));return n;}
  setPointerCapture() {}
  getScreenCTM() {return {inverse:()=>({})};}
  createSVGPoint() {return {x:0,y:0,matrixTransform(){return this;}};}
}
function browser(name, {stored={},capacitor,fetch,query={}}={}) {
  const nodes=new Map(),window=new Node(),document=new Node();
  const intervals=new Map(); let timer=0;
  document.documentElement=new Node(); document.hidden=false; document.readyState='loading';
  document.body=new Node();
  document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  document.querySelectorAll=s=>query[s]||[];
  document.createElementNS=()=>new Node();
  window.Capacitor=capacitor;
  window.EtiquetaModel=require('../apps/estoque/etiquetas/model.js');
  window.EtiquetaGestures=require('../apps/estoque/etiquetas/gestures.js');
  const storage=new Map(Object.entries(stored));
  const context={window,document,location:{protocol:'https:'},console,URL,AbortController,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    fetch, setTimeout:()=>++timer,clearTimeout(){},setInterval:fn=>{intervals.set(++timer,fn);return timer;},clearInterval:id=>intervals.delete(id)};
  for(const [id,value] of Object.entries({'zoom':'100','sheet-gap':'2','sheet-margin':'5','sheet-copies':'12'}))document.getElementById(id).value=value;
  context.Capacitor=capacitor;
  context.screen={orientation:{lock:async()=>{},unlock:async()=>{}}};
  vm.runInNewContext(source('assets/pc-connection.js'),context,{filename:'assets/pc-connection.js'});
  window.AppSpacePC=context.AppSpacePC;
  window.screen=context.screen;
  vm.runInNewContext(source(name), context, {filename:name});
  return {window,document,nodes,storage,intervals,location:context.location,
    get:id=>document.getElementById(id)};
}
function lanHarness() {
  let handler;
  const server=new EventEmitter(); server.listen=()=>{server.listening=true;};server.unref=()=>{};server.close=()=>{};
  const api=loadModule('desktop/lan.cjs',{'node:http':{createServer:fn=>{handler=fn;return server;}},'node:os':{...os,networkInterfaces:()=>({})},'./gpu.cjs':{createGpuSampler:()=>({start(){},stop(){},sample:()=>({percent:null,status:'unsupported'})})},'./rgb.cjs':{createRgbInventory:()=>({scan:async()=>({available:true,devices:[]})})},'./pc-controls.cjs':{createWindowsControls:()=>({read:async()=>({available:false}),write:async()=>({available:false})})}}).startLanServer();
  function request(body,finish=true) {
    const req=new EventEmitter();req.headers={host:'127.0.0.1:38473'};req.socket={remoteAddress:'127.0.0.1'};req.method='POST';req.url='/pair';req.destroy=()=>{};
    const res={setHeader(){},writeHead(code){this.status=code;},end(body){this.body=body;}};
    handler(req,res);
    const end=()=>{req.emit('data',Buffer.from(body));req.emit('end');};
    if(finish)end();
    return {res,end};
  }
  return {api,request};
}
test('LAN rejects JSON null without crashing the desktop process',()=>{
  const {request}=lanHarness();
  assert.equal(request('null').res.status,400);
  assert.equal(request('[]').res.status,400);
  assert.equal(request('"text"').res.status,400);
});
test('LAN reserves attempts before concurrent request bodies arrive',()=>{
  const {request}=lanHarness();
  const queued=Array.from({length:8},()=>request('{"code":"000000"}',false));
  assert.equal(request('{"code":"000000"}').res.status,429);
  queued.forEach(x=>x.end());
});
test('OTA checks the installed native version, not the version of downloaded JavaScript',async()=>{
  const updater={notifyAppReady:async()=>{},current:async()=>({native:'0.6.0',bundle:{id:'web',version:'0.6.3'}}),getBuiltinVersion:async()=>({version:'0.6.0'}),getNextBundle:async()=>null};
  const b=browser('assets/ota.js',{capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorUpdater:updater}},fetch:async()=>({ok:true,json:async()=>({schema:1,version:'0.7.2',minNative:'0.7.0',url:'https://github.com/K410Sh4/apk/releases/download/appspace-web-v0.7.2/appspace-web-v0.7.2.zip',sha256:'a'.repeat(64)})})});
  assert.equal(await b.window.AppSpaceOTA.checkUpdates(),null);
  assert.match(b.get('ota-status').textContent,/APK mais novo/);
});
test('OTA restore selects builtin and disables automatic reinstall',async()=>{
  let resetOptions;
  const updater={notifyAppReady:async()=>{},current:async()=>({native:'0.7.0',bundle:{id:'builtin'}}),getBuiltinVersion:async()=>({version:'0.7.0'}),getNextBundle:async()=>null,reset:async opts=>{resetOptions=opts;},reload:async()=>{}};
  const b=browser('assets/ota.js',{stored:{'appspace.ota.auto':'off'},capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorUpdater:updater}}});
  b.document.emit('DOMContentLoaded');await tick();
  b.storage.set('appspace.ota.auto','on'); b.get('ota-reset').emit('click');await tick();
  assert.equal(resetOptions.toLastSuccessful,false);
  assert.equal(b.storage.get('appspace.ota.auto'),'off');
});
test('OTA restores the queued update button after changing pages',async()=>{
  const updater={notifyAppReady:async()=>{},current:async()=>({native:'0.7.0',bundle:{id:'builtin'}}),getBuiltinVersion:async()=>({version:'0.7.0'}),getNextBundle:async()=>({id:'pending',version:'0.7.2'})};
  const b=browser('assets/ota.js',{stored:{'appspace.ota.auto':'off'},capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorUpdater:updater}}});
  b.document.emit('DOMContentLoaded');await tick();assert.equal(b.get('ota-apply').hidden,false);
});
test('label resize can return to its starting size during the same drag',()=>{
  const b=browser('apps/estoque/etiquetas/editor.js');const svg=b.get('label-canvas');
  const group=svg.children.find(n=>n.getAttribute('data-item-id'));const id=group.getAttribute('data-item-id');
  const handle=new Node();handle.setAttribute('data-resize-id',id);
  svg.emit('pointerdown',{target:handle,pointerId:1,clientX:56,clientY:13});
  svg.emit('pointermove',{pointerId:1,clientX:61,clientY:18});
  svg.emit('pointermove',{pointerId:1,clientX:56,clientY:13});
  svg.emit('pointerup',{pointerId:1});b.window.emit('pagehide');
  const doc=JSON.parse(b.storage.get('appspace.estoque.etiqueta.v1'));
  assert.equal(doc.objects[0].w,52);assert.equal(doc.objects[0].h,9);
});
test('A4 preview clears old artwork when label no longer fits',()=>{
  const a4=new Node();a4.dataset.viewMode='a4';
  const b=browser('apps/estoque/etiquetas/editor.js',{query:{'[data-view-mode]':[a4]}});
  a4.emit('click');assert.ok(b.get('a4-preview').children.length>0);
  b.get('label-width').value='210';b.get('label-width').emit('change');
  assert.equal(b.get('a4-preview').children.length,0);
});
test('monitor ignores metrics returned after exiting to Meu PC',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const b=browser('assets/pc-monitor.js',{stored:{'appspace.pcmonitor.v1':JSON.stringify({ip:'192.168.1.2',token:'a'.repeat(64)})},fetch:()=>pending});
 b.document.emit('DOMContentLoaded');
 b.get('monitor-exit').emit('click');
 resolve({ok:true,json:async()=>({cpu:{percent:20},memory:{percent:30}})});
 await tick();await tick();
 assert.notEqual(b.get('monitor-cpu').textContent,'20%');
 assert.equal(b.intervals.size,0);
 assert.ok(b.storage.has('appspace.pc.connection.v1'),'Legacy pairing migrated');
});
test('monitor uses shared PC session, locks landscape, and X restores screen without removing session',async()=>{
 const events=[];
 const capacitor={isNativePlatform:()=>true,Plugins:{
   ScreenOrientation:{lock:async({orientation})=>{events.push('lock:'+orientation)},unlock:async()=>{events.push('unlock')}},
   StatusBar:{hide:async()=>{events.push('hide')},show:async()=>{events.push('show')}},
   CapacitorHttp:{request:async()=>({status:200,data:{hostname:'PC',
     cpu:{percent:42,frequencyMHz:3600},
     memory:{percent:50,totalBytes:17179869184,usedBytes:8589934592},
     uptimeSeconds:3600,gpu:{percent:null}}})}
 }};
 const saved={'appspace.pc.connection.v1':JSON.stringify({ip:'192.168.1.2',token:'a'.repeat(64),transport:'usb',hostname:'PC'})};
 const b=browser('assets/pc-monitor.js',{stored:saved,capacitor});
 b.document.emit('DOMContentLoaded');
 await tick();await tick();await tick();
 assert.equal(b.document.body.dataset.monitorActive,'true');
 assert.ok(events.includes('lock:landscape'));
 assert.ok(events.includes('hide'));
 assert.equal(b.get('monitor-cpu').textContent,'42%');
 assert.equal(b.get('monitor-gpu').textContent,'N/D');
 b.get('monitor-exit').emit('click');
 await tick();await tick();await tick();
 assert.ok(events.includes('unlock'));
 assert.ok(events.includes('show'));
 assert.equal(b.document.body.dataset.monitorActive,undefined);
 assert.ok(b.storage.has('appspace.pc.connection.v1'),'Shared token must remain');
 assert.equal(b.intervals.size,0);
 assert.match(b.location.href,/\.\.\/index\.html$/);
});
test('monitor returns to shared connection folder without any saved PC',()=>{
 const b=browser('assets/pc-monitor.js');
 b.document.emit('DOMContentLoaded');
 assert.match(b.location.href,/connection=required/);
 assert.equal(b.intervals.size,0);
});
test('monitor resumes after browser back/forward cache restores the page',async()=>{
 const b=browser('assets/pc-monitor.js',{stored:{'appspace.pc.connection.v1':JSON.stringify({ip:'192.168.1.2',token:'a'.repeat(64)})},fetch:async()=>({ok:true,json:async()=>({cpu:{},memory:{}})})});
 b.document.emit('DOMContentLoaded');await tick();b.window.emit('pagehide',{persisted:true});
 assert.equal(b.intervals.size,0);b.window.emit('pageshow',{persisted:true});await tick();
 assert.equal(b.intervals.size,1);
});
test('web OTA policy excludes docs but retains Qwen UI assets',()=>{
 const {isWebAsset,isDocumentation}=require('../desktop/web-asset-policy.cjs');
 assert.equal(isWebAsset('index.html'),true);
 assert.equal(isWebAsset('mod-hub.js'),true);
 assert.equal(isWebAsset('mod-hub.css'),true);
 assert.equal(isWebAsset('README.md'),false);
 assert.equal(isDocumentation('README.md'),true);
 assert.equal(isWebAsset('install.exe'),false);
 assert.equal(isWebAsset('payload.ps1'),false);
});
test('new desktop binary ignores an older cached OTA bundle',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'appspace-test-'));
  try{
    const folder=path.join(dir,'web-updates','v0.6.3');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'index.html'),'old');
    fs.writeFileSync(path.join(dir,'web-updates','active.json'),JSON.stringify({version:'0.6.3'}));
    const {createDesktopUpdater}=loadModule('desktop/updates.cjs',{'extract-zip':async()=>{},'./web-asset-policy.cjs':require('../desktop/web-asset-policy.cjs')});
    assert.equal(createDesktopUpdater(dir,'0.7.0').status().currentVersion,'0.7.0');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('desktop reset cannot race an active installation',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'appspace-test-'));
  try{
    const {createDesktopUpdater}=loadModule('desktop/updates.cjs',{'extract-zip':async()=>{},'./web-asset-policy.cjs':require('../desktop/web-asset-policy.cjs')},{fetch:()=>pending});
    const updater=createDesktopUpdater(dir,'0.7.0');const install=updater.install();
    const resetting=assert.rejects(updater.reset(),/andamento/);
    resolve(new Response(JSON.stringify({schema:1,version:'0.7.0',minNative:'0.7.0',url:'https://github.com/K410Sh4/apk/releases/download/appspace-web-v0.7.0/appspace-web-v0.7.0.zip',sha256:'a'.repeat(64)})));
    await install;await resetting;
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Android preparation stamps package version and is idempotent',()=>{
  const gradlePath=path.join(root,'mobile/android/app/build.gradle');
  const manifestPath=path.join(root,'mobile/android/app/src/main/AndroidManifest.xml');
  const files=new Map([[path.join(root,'package.json'),'{"version":"0.7.0"}'],[gradlePath,'android {\n defaultConfig {\n  versionCode 1\n  versionName "1.0"\n }\n}\n'],[manifestPath,'<manifest><application /></manifest>']]);
  const fakeFs={existsSync:p=>files.has(p),readFileSync:p=>{if(!files.has(p))throw Error('Missing '+p);return files.get(p);},writeFileSync:(p,s)=>files.set(p,s),mkdirSync(){}};
  const run=()=>loadModule('scripts/prepare-mobile-lan.cjs',{'node:fs':fakeFs},{__dirname:path.join(root,'scripts')});
  run();const once=new Map(files);run();assert.deepEqual(files,once);
  assert.match(files.get(gradlePath),/versionName "0\.7\.0"/);
  assert.match(files.get(gradlePath),/versionCode 7000/);
});
test('OTA still offers and installs a compatible update',async()=>{
  let downloaded,activated;
  const updater={notifyAppReady:async()=>{},current:async()=>({native:'0.7.0',bundle:{id:'builtin'}}),getBuiltinVersion:async()=>({version:'0.7.0'}),getNextBundle:async()=>null,
    download:async args=>{downloaded=args;return {id:'new-bundle'};},set:async args=>{activated=args.id;}};
  const b=browser('assets/ota.js',{stored:{'appspace.ota.auto':'off'},capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorUpdater:updater}},fetch:async()=>({ok:true,json:async()=>({schema:1,version:'0.7.2',minNative:'0.7.0',url:'https://github.com/K410Sh4/apk/releases/download/appspace-web-v0.7.2/appspace-web-v0.7.2.zip',sha256:'a'.repeat(64)})})});
  b.document.emit('DOMContentLoaded');await tick();
  assert.equal((await b.window.AppSpaceOTA.checkUpdates()).version,'0.7.2');
  b.get('ota-install').emit('click');await tick();
  assert.equal(downloaded.checksum,'a'.repeat(64));assert.equal(activated,'new-bundle');
});
test('label movement still persists and supports undo/redo',()=>{
  const b=browser('apps/estoque/etiquetas/editor.js'),svg=b.get('label-canvas');
  const group=svg.children.find(n=>n.getAttribute('data-item-id'));
  svg.emit('pointerdown',{target:group,pointerId:1,clientX:4,clientY:4});
  svg.emit('pointermove',{pointerId:1,clientX:8,clientY:9});svg.emit('pointerup',{pointerId:1});
  const saved=()=>{b.window.emit('pagehide');return JSON.parse(b.storage.get('appspace.estoque.etiqueta.v1'));};
  assert.equal(saved().objects[0].x,8);
  b.get('undo-btn').emit('click');assert.equal(saved().objects[0].x,4);
  b.get('redo-btn').emit('click');assert.equal(saved().objects[0].x,8);
});
test('LAN still accepts the correct code after invalid requests',()=>{
  const {api,request}=lanHarness();
  assert.equal(request('null').res.status,400);
  const response=request(JSON.stringify({code:api.status().pin})).res;
  assert.equal(response.status,200);assert.match(JSON.parse(response.body).token,/^[a-f0-9]{64}$/);
});

test('batch page offset leaves previously used positions blank and previews on demand',()=>{
  const M=require('../apps/estoque/etiquetas/model.js');
  const B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const doc=M.project('preco'),batch=B.fresh(doc);
  batch.layout.startSlot=3;
  batch.rows[0].quantity=25;
  const verified=B.validateForPrint(doc,batch);
  assert.equal(verified.pageCount,Math.ceil((25+2)/verified.layout.perPage));
  const all=B.pages(doc,batch);
  assert.equal(all.pages[0].length,verified.layout.perPage-2);
  assert.deepEqual(all.pages[0][0].position,verified.layout.positions[2]);
  for(let i=0;i<verified.pageCount;i++){
    const preview=B.previewPage(doc,batch,i);
    assert.equal(preview.pageIndex,i);
    assert.deepEqual(preview.items,all.pages[i]);
  }
  assert.equal(all.pages.flat().length,25);
  batch.layout.startSlot=verified.layout.perPage+1;
  assert.throws(()=>B.validateForPrint(doc,batch),/primeira posição/);
});
test('batch CSV round trip preserves products, quotes, quantities and neutralizes formulas',()=>{
  const M=require('../apps/estoque/etiquetas/model.js');
  const B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const doc=M.project('preco'),batch=B.fresh(doc);
  const ids=batch.fields;
  batch.rows[0].quantity=3;
  batch.rows[0].values[ids[0]]='Produto; "premium"';
  batch.rows[0].values[ids[1]]='=SUM(A1:A2)';
  batch.rows.push({id:'row-test',quantity:2,values:{...batch.rows[0].values,[ids[0]]:'Biscoito'}});
  const csv=B.toCsv(doc,batch);
  assert.match(csv,/Quantidade/);
  assert.ok(csv.includes("'=SUM(A1:A2)"),'Formula must be neutralized in exported CSV');
  const imported=B.fromCsv(csv,doc,batch);
  assert.equal(B.count(imported),5);
  assert.equal(imported.rows[0].values[ids[0]],'Produto; "premium"');
  assert.equal(imported.rows[0].values[ids[1]],'=SUM(A1:A2)');
  assert.equal(imported.rows[1].values[ids[0]],'Biscoito');
  assert.throws(()=>B.fromCsv('Quantidade;Outro campo\n1;A',doc,batch),/não reconhecida/);
  assert.throws(()=>B.fromCsv(csv.replace('"3"','"501"'),doc,batch),/1 a 200/);
});
test('editor precision toggles never leak grid to exported document and alignment is undoable',()=>{
  const b=browser('apps/estoque/etiquetas/editor.js'),svg=b.get('label-canvas');
  const group=svg.children.find(n=>n.getAttribute('data-item-id'));
  svg.emit('pointerdown',{target:group,pointerId:1,clientX:4,clientY:4});
  svg.emit('pointerup',{pointerId:1});
  b.get('studio-grid').emit('click');
  b.get('studio-snap').emit('click');
  assert.equal(b.get('studio-grid').getAttribute('aria-pressed'),'true');
  assert.equal(b.get('studio-snap').getAttribute('aria-pressed'),'true');
  assert.ok(svg.children.some(n=>n.attributes?.id==='studio-grid-pattern'||n.children?.some(x=>x.attributes?.id==='studio-grid-pattern')));
  b.get('studio-center-x').emit('click');
  const getSaved=()=>{b.window.emit('pagehide');return JSON.parse(b.storage.get('appspace.estoque.etiqueta.v1'));};
  const centered=getSaved().objects[0].x;
  assert.equal(centered,Math.round((60-52)/2));
  b.get('studio-center-y').emit('click');
  assert.equal(getSaved().objects[0].y,Math.round((40-9)/2));
  b.get('undo-btn').emit('click');
  assert.equal(getSaved().objects[0].y,4);
  assert.deepEqual(JSON.parse(b.storage.get('appspace.estoque.precision.v1')),{grid:true,snap:true});
});

test('REA architecture keeps barcode and readable SKU identical on production',()=>{
  const M=require('../apps/estoque/etiquetas/model.js'),B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const template=M.project('codigo'),batch=B.fresh(template);
  assert.deepEqual(batch.fields,['product.sku']);
  batch.rows[0].values['product.sku']='EST-999';
  const rendered=B.pages(template,batch).pages[0][0].label.objects.filter(o=>o.binding==='product.sku');
  assert.equal(rendered.length,2);
  assert.deepEqual(rendered.map(o=>o.text),['EST-999','EST-999']);
  // Antigos documentos (sem binding) são convertidos sem alterar IDs.
  const legacy=JSON.parse(JSON.stringify(template));
  legacy.objects.forEach(o=>delete o.binding);
  const migrated=M.validate(legacy);
  assert.deepEqual(migrated.objects.filter(o=>o.binding==='product.sku').map(o=>o.type),['barcode','text']);
});
test('REA model redesign preserves semantic product data',()=>{
  const M=require('../apps/estoque/etiquetas/model.js'),B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const initial=M.project('preco'),batch=B.fresh(initial);
  batch.rows[0].values['product.name']='Arroz';
  batch.rows[0].values['product.price']='R$ 12,40';
  const redesigned=M.project('preco');
  redesigned.objects[0].fontFamily='Georgia';
  const restored=B.validateData(batch,redesigned);
  assert.deepEqual(restored.fields,['product.name','product.price']);
  assert.equal(restored.rows[0].values['product.name'],'Arroz');
  assert.equal(restored.rows[0].values['product.price'],'R$ 12,40');
  assert.equal(B.pages(redesigned,restored).pages[0][0].label.objects[0].text,'Arroz');
  // Dados legados indexados por ID são migrados para o campo novo.
  const legacy=JSON.parse(JSON.stringify(initial));
  const nameId=legacy.objects[0].id;
  const old={fields:[nameId],rows:[{id:'r1',quantity:1,values:{[nameId]:'Café'}}],layout:batch.layout};
  const mapped=B.validateData(old,initial);
  assert.equal(mapped.rows[0].values['product.name'],'Café');
});
test('REA preview rejects overflowing text instead of printing an incomplete price',()=>{
  const M=require('../apps/estoque/etiquetas/model.js'),B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const doc=M.project('preco'),batch=B.fresh(doc);
  batch.rows[0].values['product.price']='R$ 12345,99';
  assert.equal(M.textLayout('R$ 12345,99',9,52,12).overflow,true);
  assert.throws(()=>B.validateForPrint(doc,batch),/Texto não cabe/);
  assert.throws(()=>M.validateForOutput({...doc,objects:[...doc.objects,
    M.element('text',{x:100,y:4,text:'EXTERNO'})]}),/fora dos limites/);
});
test('REA multi-page production accepts 101 sheets for sparse large labels',()=>{
  const M=require('../apps/estoque/etiquetas/model.js'),B=require('../apps/estoque/etiquetas/lote/batch-model.js');
  const t=M.project('preco');t.width=200;t.height=200;
  const batch=B.fresh(t);batch.rows[0].quantity=101;
  const pages=B.pages(t,batch);
  assert.equal(pages.pages.length,101);
  assert.equal(pages.pages.flat().length,101);
  const native=source('native/label-documents/LabelDocumentsPlugin.java');
  assert.match(native,/ACTION_CREATE_DOCUMENT/);assert.match(native,/ACTION_OPEN_DOCUMENT/);
  assert.match(source('scripts/prepare-label-documents.cjs'),/registerPlugin\(LabelDocumentsPlugin.class\)/);
});

test('Android release blocks missing persistent signing credentials and injects Gradle config idempotently',()=>{
  const file='scripts/prepare-release-signing.cjs';
  const gradleOriginal="android {\\n    buildTypes { release { minifyEnabled false } }\\n}\\n";
  let written=gradleOriginal;
  const mock={
    statSync:()=>({isFile:()=>true}),
    readFileSync:()=>written,
    writeFileSync:(_p,txt)=>{written=txt;}
  };
  const keys={
    APPSPACE_RELEASE_KEYSTORE_PATH:'/tmp/appspace-test.jks',
    APPSPACE_RELEASE_STORE_PASSWORD:'testSecretStoreOnly',
    APPSPACE_RELEASE_KEY_ALIAS:'test',
    APPSPACE_RELEASE_KEY_PASSWORD:'testSecretKeyOnly'
  };
  assert.throws(()=>loadModule(file,{'node:fs':mock},{
    __dirname:path.join(root,'scripts'),process:{env:{}}
  }),/Assinatura de release não configurada/);
  loadModule(file,{'node:fs':mock},{__dirname:path.join(root,'scripts'),process:{env:keys}});
  assert.match(written,/APPSPACE_STABLE_RELEASE_SIGNING/);
  assert.match(written,/signingConfig signingConfigs.appspaceRelease/);
  assert.doesNotMatch(written,/testSecretStoreOnly|testSecretKeyOnly/);
  const once=written;
  loadModule(file,{'node:fs':mock},{__dirname:path.join(root,'scripts'),process:{env:keys}});
  assert.equal(written,once);
  const workflow=source('.github/workflows/appspace-native-release.yml');
  assert.match(workflow,/assembleRelease/);
  assert.match(workflow,/apksigner/);
  assert.match(workflow,/secrets.APPSPACE_ANDROID_KEYSTORE_BASE64/);
  assert.doesNotMatch(workflow,/gradlew\s+assembleDebug/);
});
