'use strict';
// Execute with Playwright installed. CI installs the pinned test tool separately.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist/ui-check');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(body);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync(output,{recursive:true});
 let assertions=0;const errors=[];
 try{
  for(const theme of ['dark','light'])for(const nav of ['classic','minimal']){
   const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   await context.addInitScript(({theme,nav})=>localStorage.setItem('appspace.preferences.v1',JSON.stringify({theme,mobileNavStyle:nav})),{theme,nav});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const [width,height] of [[320,640],[360,800],[412,915],[844,390],[1280,800]]){
    await page.setViewportSize({width,height});
    for(const [folder,count] of [['estoque',2],['edicao-de-video',0],['meu-pc',2],['ia',1]]){
     await page.goto(base+'/apps/'+folder+'/index.html');
     await page.waitForSelector('[data-app-drawer]');
     assert.equal(await page.locator('[data-drawer-app]:visible').count(),count,folder+' app count');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),folder+' horizontal overflow '+width);
     const input=await page.locator('#drawer-search').boundingBox();assert.ok(input.width>=100,'usable search '+width);
     assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
     assertions+=4;
     if(width===412&&nav==='minimal')await page.screenshot({path:path.join(output,folder+'-'+theme+'-mobile.png'),fullPage:true});
     if(width===1280&&theme==='dark'&&nav==='classic'&&folder==='estoque')await page.screenshot({path:path.join(output,'estoque-desktop.png'),fullPage:true});
    }
   }
   await context.close();
  }
  const ctx=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/apps/estoque/index.html');
  await page.locator('#drawer-search').fill('IMPRESSÃO');
  await page.waitForFunction(()=>document.getElementById('drawer-count').textContent==='2 de 2 aplicativos');
  await page.locator('#drawer-search').fill('lote');
  await page.waitForFunction(()=>document.querySelectorAll('#drawer-grid li:not([hidden])').length===1);
  assert.equal(await page.locator('[data-drawer-app]:visible .drawer-app-name').innerText(),'Etiquetas em lote');
  await page.locator('[data-drawer-app]:visible').click();
  await page.waitForURL('**/etiquetas/lote/index.html');await page.goBack();
  assert.equal(await page.locator('#drawer-search').inputValue(),'lote');
  await page.locator('#drawer-search').fill('zzzzzz');
  await page.waitForSelector('#drawer-reset-search:visible');
  await page.locator('#drawer-reset-search').click();
  assert.equal(await page.locator('[data-drawer-app]:visible').count(),2);
  await page.locator('#drawer-sort').selectOption('za');
  await page.waitForFunction(()=>document.querySelector('.drawer-app-name').textContent==='Etiquetas em lote');
  await page.locator('#drawer-search').focus();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#drawer-search').inputValue(),'');
  assertions+=6;
  // A pesquisa da Home deve considerar apenas as pastas exibidas.
  await page.goto(base+'/index.html');
  await page.keyboard.press('/');assert.equal(await page.evaluate(()=>document.activeElement.id),'app-search');
  assert.ok(await page.locator('#app-search').isVisible());
  await page.locator('#app-search').fill('zzzzzz');
  assert.ok(await page.locator('#search-empty').isVisible());
  await page.keyboard.press('Escape');assert.equal(await page.locator('.folder-card:visible').count(),4);assertions+=4;
  await page.evaluate(()=>localStorage.setItem('appspace.preferences.v1',JSON.stringify({mobileNavStyle:'minimal'})));
  await page.reload();
  await page.evaluate(()=>window.savedTile=document.querySelector('.launcher-tile'));
  await page.setViewportSize({width:430,height:915});
  assert.ok(await page.evaluate(()=>window.savedTile===document.querySelector('.launcher-tile')),'resize preserves tile identity');
  await page.keyboard.press('/');assert.equal(await page.evaluate(()=>document.activeElement.id),'launcher-search');
  await page.keyboard.press('Escape');
  await page.locator('.launcher-tile--mypc').click();await page.waitForURL('**/apps/meu-pc/index.html');
  assert.equal(await page.locator('#mypc-connection-panel').getAttribute('open'),null);
  await page.locator('#mypc-monitor-link').click();
  assert.notEqual(await page.locator('#mypc-connection-panel').getAttribute('open'),null);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'mypc-ip');
  await page.locator('.drawer-back').click();await page.waitForURL('**/index.html#launcher');
  assert.ok(await page.locator('#launcher').isVisible());
  // Touch listeners remain live after rendering/reordering the launcher.
  await page.locator('.launcher-tile--stock').click();await page.waitForURL('**/apps/estoque/index.html');
  assertions+=6;
  // Qwen Mod Hub: navegação, persistência, importação e controles efetivos locais.
  await page.goto(base+'/apps/ia/index.html');
  assert.equal(await page.locator('[data-drawer-app]:visible').count(),1);
  await page.locator('[data-drawer-app]:visible').click();
  await page.waitForURL('**/apps/ia/qwen-mod-hub/index.html');
  assert.ok(await page.locator('[data-mod="think"]').isChecked());
  await page.locator('[data-mod="think"]').uncheck();
  await page.locator('#ai-think-mode').selectOption('deep');
  assert.ok(!(await page.locator('#ai-advanced-options').evaluate(el=>el.open)),'Opções avançadas devem começar fechadas');
  await page.locator('#ai-advanced-options > summary').click();
  await page.locator('#ai-save').click();
  assert.match(await page.locator('#ai-feedback').innerText(),/salvo neste dispositivo/i);
  assert.ok(await page.locator('#ai-apply').isDisabled());
  await page.reload();
  assert.equal(await page.locator('[data-mod="think"]').isChecked(),false);
  assert.equal(await page.locator('#ai-think-mode').inputValue(),'deep');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appspace.ia.qwen-mod-hub.v1')).mods.think),false);
  await page.locator('#ai-import').setInputFiles({name:'profile.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({schema:1,target:'qwen2.5-coder-7b-instruct',mods:{think:true,memory:false,vulkan:true,verify:true},thinkMode:'economy',contextSize:8192}))});
  assert.equal(await page.locator('[data-mod="memory"]').isChecked(),false);
  assert.equal(await page.locator('#ai-context').inputValue(),'8192');
  await page.locator('.ai-technical > summary').click();
  await page.locator('#ai-host').fill('https://example.com');
  await page.locator('#ai-token').fill('test-token');
  await page.locator('#ai-connect').click();
  assert.match(await page.locator('#ai-feedback').innerText(),/somente http\(s\) e um host local\/privado/i);
  assert.ok(await page.locator('#ai-apply').isDisabled());
  assertions+=13;
  // Integração de UI com agente mockado: status, aplicação, chat e limpeza.
  const aiCtx=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  await aiCtx.addInitScript(()=>{
    const original=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      const value=String(url);
      if(value.startsWith('http://127.0.0.1:8765/api/v1/')){
        const route=value.split('/api/v1/')[1];
        let payload;
        if(route==='status')payload={agent:'rea-qwen-mod-host',apiVersion:1,capabilities:{mods:true,chat:true},model:{ready:true,id:'qwen-test'}};
        else if(route==='mods/apply')payload={agent:'rea-qwen-mod-host',apiVersion:1,applied:true,modelReady:true,moduleStatus:{vulkan:{state:'manual'}}};
        else if(route==='chat')payload={agent:'rea-qwen-mod-host',apiVersion:1,answer:'Resposta local simulada <script>não executar</script>',passes:3,elapsedMs:40,memoryUsed:0,verification:'revisão textual'};
        else if(route==='memory/clear')payload={agent:'rea-qwen-mod-host',apiVersion:1,cleared:true};
        else payload={error:'unsupported'};
        return Promise.resolve(new Response(JSON.stringify(payload),{status:route==='unsupported'?404:200,headers:{'content-type':'application/json'}}));
      }
      return original(url,options);
    };
  });
  const aiPage=await aiCtx.newPage();aiPage.on('pageerror',e=>errors.push(e.message));aiPage.on('dialog',d=>d.accept());
  await aiPage.goto(base+'/apps/ia/qwen-mod-hub/index.html');
  assert.equal(await aiPage.locator('[data-mod="memory"]').isChecked(),false,'Memória deve requerer opt-in');
  await aiPage.locator('#ai-token').fill('demo-session-token');
  await aiPage.locator('#ai-connect').click();
  await aiPage.waitForFunction(()=>document.getElementById('ai-connection-status').textContent==='PC conectado');
  assert.ok(await aiPage.locator('#ai-apply').isEnabled());
  await aiPage.locator('#ai-apply').click();
  await aiPage.waitForFunction(()=>document.getElementById('ai-connection-status').textContent.includes('Tudo pronto'));
  assert.ok(await aiPage.locator('#ai-chat-send').isEnabled());
  await aiPage.locator('#ai-prompt').fill('O que faz o Qwen modificado?');
  await aiPage.locator('#ai-chat-send').click();
  await aiPage.waitForSelector('#ai-chat-response:visible');
  assert.match(await aiPage.locator('#ai-chat-response').innerText(),/Resposta local simulada/);
  assert.equal(await aiPage.locator('#ai-chat-response script').count(),0,'Resposta não deve virar HTML executável');
  assert.match(await aiPage.locator('#ai-chat-meta').innerText(),/3 etapas/);
  // A escolha pode ser alterada sem reconectar: aplicar também salva mudanças locais.
  await aiPage.locator('#ai-think-mode').selectOption('deep');
  assert.ok(await aiPage.locator('#ai-apply').isEnabled());
  assert.ok(await aiPage.locator('#ai-chat-send').isDisabled());
  await aiPage.locator('#ai-apply').click();
  await aiPage.waitForFunction(()=>document.getElementById('ai-connection-status').textContent.includes('Tudo pronto'));
  assert.equal(await aiPage.evaluate(()=>JSON.parse(localStorage.getItem('appspace.ia.qwen-mod-hub.v1')).thinkMode),'deep');
  assert.ok(await aiPage.locator('#ai-chat-send').isEnabled());
  // Testa mobile pequeno, mobile horizontal e desktop, mantendo a tela sem rolagem lateral.
  for(const [width,height] of [[320,640],[412,915],[844,390],[1280,800]]){
    await aiPage.setViewportSize({width,height});
    assert.ok(await aiPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Qwen Hub overflow '+width);
    if(width===412) await aiPage.screenshot({path:path.join(output,'qwen-mod-hub-simples-mobile.png'),fullPage:true});
    if(width===1280) await aiPage.screenshot({path:path.join(output,'qwen-mod-hub-simples-desktop.png'),fullPage:true});
  }
  await aiPage.setViewportSize({width:412,height:915});
  await aiPage.locator('#ai-advanced-options > summary').click();
  await aiPage.locator('#ai-clear-memory').click();
  await aiPage.waitForFunction(()=>document.getElementById('ai-feedback').textContent.includes('Memória persistente do agente apagada'));
  assert.match(await aiPage.locator('#ai-feedback').innerText(),/Memória persistente do agente apagada/);
  assertions+=8;await aiCtx.close();
  // A delayed native metrics callback must not reconnect the UI after disconnect.
  const race=await browser.newContext({viewport:{width:412,height:915}});
  await race.addInitScript(()=>{
   localStorage.setItem('appspace.pc.connection.v1',JSON.stringify({ip:'192.168.1.20',token:'a'.repeat(64)}));
   window.Capacitor={isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:()=>new Promise(resolve=>{window.finishMetrics=()=>resolve({status:200,data:{hostname:'PC',cpu:{},memory:{}}});})}}};
  });
  const racePage=await race.newPage();racePage.on('pageerror',e=>errors.push(e.message));racePage.on('dialog',dialog=>dialog.accept());
  await racePage.goto(base+'/apps/meu-pc/index.html');
  await racePage.waitForFunction(()=>typeof window.finishMetrics==='function');
  await racePage.locator('#mypc-connection-panel > summary').click();
  await racePage.locator('#mypc-disconnect').click();
  assert.ok(await racePage.locator('#mypc-submit').isEnabled());
  await racePage.evaluate(()=>window.finishMetrics());
  assert.equal(await racePage.locator('#mypc-status').innerText(),'Não conectado');
  assert.equal(await racePage.evaluate(()=>localStorage.getItem('appspace.pc.connection.v1')),null);
  assertions+=3;await race.close();

  // Editor de etiquetas e fluxo A4: controles reais em mobile e desktop.
  const labelsContext=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  await labelsContext.addInitScript(()=>{
    localStorage.removeItem('appspace.estoque.precision.v1');
    localStorage.removeItem('appspace.estoque.lote.v1');
  });
  const labelsPage=await labelsContext.newPage();labelsPage.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[320,640],[412,915],[1280,800]]){
    await labelsPage.setViewportSize({width,height});
    await labelsPage.goto(base+'/apps/estoque/etiquetas/index.html');
    assert.ok(await labelsPage.locator('.studio-workspace-eyebrow').isVisible());
    assert.ok(await labelsPage.locator('.studio-stage-label').isVisible());
    const hasNewStudioStyles=await labelsPage.evaluate(()=>[...document.styleSheets].some(s=>s.href?.includes('studio-android-v2.css')));
    assert.ok(hasNewStudioStyles,'Studio Android V2 CSS was not loaded');
    await labelsPage.locator('#studio-grid').click();
    assert.equal(await labelsPage.locator('#studio-grid').getAttribute('aria-pressed'),'true');
    await labelsPage.locator('#studio-snap').click();
    assert.equal(await labelsPage.locator('#studio-snap').getAttribute('aria-pressed'),'true');
    if(width===412)await labelsPage.screenshot({path:path.join(output,'etiqueta-editor-mobile.png'),fullPage:true});
    await labelsPage.goto(base+'/apps/estoque/etiquetas/lote/index.html');
    await labelsPage.locator('#next-list').click();
    assert.ok(await labelsPage.locator('td.batch-cell-field[data-label]').count()>0);
    if(width<=412){
      const mobileCards=await labelsPage.evaluate(()=>{
        const table=document.querySelector('.batch-table'),row=table?.querySelector('tbody tr');
        return {
          hasStyles:[...document.styleSheets].some(s=>s.href?.includes('production-android-v2.css')),
          display:getComputedStyle(row).display,tableWidth:table.getBoundingClientRect().width,
          viewport:innerWidth,labels:[...row.querySelectorAll('td')].map(td=>td.dataset.label)
        };
      });
      assert.ok(mobileCards.hasStyles,'Production Android V2 CSS was not loaded');
      assert.equal(mobileCards.display,'grid','Mobile products should be cards, not a wide table');
      assert.ok(mobileCards.tableWidth<=mobileCards.viewport+1,'Mobile products overflow the viewport');
      assert.ok(mobileCards.labels.includes('Cópias'));
      if(width===412)await labelsPage.screenshot({path:path.join(output,'etiqueta-produtos-cartoes-mobile.png'),fullPage:true});
    }
    
    await labelsPage.locator('#next-preview').click();
    await labelsPage.locator('#layout-start-slot').fill('2');
    await labelsPage.locator('#layout-start-slot').press('Tab');
    await labelsPage.waitForFunction(()=>document.getElementById('batch-layout-result').textContent.includes('posição inicial 2'));
    assert.ok(await labelsPage.locator('#batch-paper svg').count()>0);
    assert.ok(await labelsPage.locator('#batch-download').isEnabled());
    if(width===412)await labelsPage.screenshot({path:path.join(output,'etiqueta-lote-a4-mobile.png'),fullPage:true});
    assertions+=4;
  }
  await labelsContext.close();
  // Meu PC V2: telemetria remota mockada, GPU Windows e FPS da tela distintos.
  const monitorCtx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  await monitorCtx.addInitScript(()=>{
    localStorage.setItem('appspace.pc.connection.v1',JSON.stringify({
      ip:'192.168.1.10',token:'a'.repeat(64),transport:'wifi',hostname:'PC-Teste'
    }));
    window.__monitorMockGpu=65;
    const actual=window.fetch.bind(window);
    window.fetch=(url,opts)=>{
      if(String(url).includes(':38473/metrics')){
        const percent=window.__monitorMockGpu;
        const payload={timestamp:Date.now(),hostname:'PC-Teste',
          cpu:{percent:37,frequencyMHz:3800},memory:{percent:48,totalBytes:17179869184,usedBytes:8246337208},
          gpu:{percent,status:percent===null?'unavailable':'ready'},uptimeSeconds:36720};
        return Promise.resolve(new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}}));
      }
      return actual(url,opts);
    };
  });
  const monitorPage=await monitorCtx.newPage();
  monitorPage.on('pageerror',error=>errors.push(error.message));
  await monitorPage.goto(base+'/apps/meu-pc/monitor/index.html');
  await monitorPage.waitForFunction(()=>document.getElementById('monitor-gpu').textContent==='65%',{timeout:10000});
  await monitorPage.waitForFunction(()=>Number(document.getElementById('monitor-fps').textContent)>0,{timeout:10000});
  assert.equal(await monitorPage.locator('#monitor-cpu').innerText(),'37%');
  assert.equal(await monitorPage.locator('#monitor-status').getAttribute('data-online'),'true');
  assert.ok(await monitorPage.locator('#monitor-fps-details').innerText().then(s=>s.includes('não dos jogos')));
  const monLayout=await monitorPage.evaluate(()=>({
    cssLoaded:[...document.styleSheets].some(x=>x.href?.includes('pc-monitor-v2.css')),
    columns:getComputedStyle(document.querySelector('.monitor-metrics')).gridTemplateColumns.split(' ').length,
    fps:Number(document.getElementById('monitor-fps').textContent)
  }));
  assert.ok(monLayout.cssLoaded);
  assert.equal(monLayout.columns,5);
  const visual=await monitorPage.evaluate(()=>{
    const cards=[...document.querySelectorAll('.monitor-metrics>.monitor-metric')];
    const container=document.querySelector('.monitor-metrics').getBoundingClientRect();
    return {
      cssLoaded:[...document.styleSheets].some(sheet=>sheet.href?.includes('pc-monitor-v3.css')),
      icons:cards.map(card=>card.querySelectorAll('.monitor-icon svg').length),
      subtitles:cards.map(card=>card.querySelector('.monitor-metric-subtitle')?.textContent.trim()),
      accents:cards.map(card=>getComputedStyle(card).getPropertyValue('--mon-color').trim()),
      rects:cards.map(card=>{const r=card.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}}),
      container:{x:container.x,right:container.right,y:container.y,bottom:container.bottom},
      headerIcon:!!document.querySelector('.monitor-v2-logo svg')
    };
  });
  assert.ok(visual.cssLoaded,'Monitor PRO V3 CSS precisa estar carregado');
  assert.equal(visual.headerIcon,true);
  assert.deepEqual(visual.icons,[1,1,1,1,1]);
  assert.deepEqual(visual.subtitles,['PROCESSADOR','MEMÓRIA','PLACA DE VÍDEO','TAXA DE QUADROS','TEMPO DE ATIVIDADE']);
  assert.equal(new Set(visual.accents).size,5,'Cada sensor deve ter uma cor distinta');
  assert.ok(visual.rects.every(card=>card.width>=100&&card.height>100));
  assert.ok(visual.rects.every(card=>card.x>=visual.container.x-1&&card.right<=visual.container.right+1));
  assert.ok(visual.rects.every(card=>card.y>=visual.container.y-1&&card.bottom<=visual.container.bottom+1));

  assert.ok(monLayout.fps>0&&monLayout.fps<300);
  await monitorPage.screenshot({path:path.join(output,'pc-monitor-v3-landscape-mobile.png'),fullPage:true});
  await monitorPage.setViewportSize({width:1536,height:708});
  const desktopVisual=await monitorPage.evaluate(()=>{
    const metrics=document.querySelector('.monitor-metrics').getBoundingClientRect();
    const cards=[...document.querySelectorAll('.monitor-metrics>.monitor-metric')].map(el=>el.getBoundingClientRect());
    return {visible:cards.length===5&&cards.every(r=>r.x>=metrics.x-1&&r.right<=metrics.right+1),
      text:getComputedStyle(document.querySelector('.monitor-metric-label')).fontSize};
  });
  assert.ok(desktopVisual.visible,'Monitor desktop mantém cinco cartões');
  assert.ok(parseFloat(desktopVisual.text)>=17,'Títulos grandes no PC');
  await monitorPage.screenshot({path:path.join(output,'pc-monitor-v3-landscape-desktop.png'),fullPage:true});
  await monitorPage.setViewportSize({width:844,height:390});
  await monitorPage.evaluate(()=>window.__monitorMockGpu=null);
  await monitorPage.waitForFunction(()=>document.getElementById('monitor-gpu').textContent==='N/D',{timeout:10000});
  assert.match(await monitorPage.locator('#monitor-gpu-details').innerText(),/indisponível/);
  assertions+=20;
  await monitorCtx.close();
  // RGB Controller: renderizar FIFINE, teclado não confirmado e controladora sem envio HID.
  const rgbCtx=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  await rgbCtx.addInitScript(()=>{
    localStorage.setItem('appspace.pc.connection.v1',JSON.stringify({ip:'192.168.1.10',token:'a'.repeat(64),hostname:'PC-Teste'}));
    const original=window.fetch.bind(window);
    window.fetch=(url,opts)=>{
      if(String(url).includes(':38473/rgb/devices')){
        return Promise.resolve(new Response(JSON.stringify({available:true,reason:null,devices:[
          {id:'controller',present:false,interfaceCount:0,interfaces:[],control:'unverified'},
          {id:'fifine',vid:'3142',pid:'A010',present:true,interfaceCount:2,interfaces:[{name:'fifine Microphone',class:'MEDIA',mi:'00',bus:'USB'}],control:'unverified'},
          {id:'keyboard',vid:'0C45',pid:'8006',present:true,interfaceCount:5,hasVendorHID:true,interfaces:[{name:'Dispositivo definido pelo fornecedor',class:'HIDClass',mi:'01',bus:'HID',vendorDefined:true}],control:'unverified'},
          {id:'redragon',vid:'04D9',pid:'FC30',present:true,interfaceCount:3,interfaces:[],control:'unverified'}],
          openRGB:{connected:false,devices:[]}}),{status:200,headers:{'content-type':'application/json'}}));
      }
      return original(url,opts);
    };
  });
  const rgbPage=await rgbCtx.newPage();rgbPage.on('pageerror',e=>errors.push(e.message));
  await rgbPage.goto(base+'/apps/meu-pc/rgb/index.html');
  await rgbPage.waitForFunction(()=>document.querySelector('[data-device-status="fifine"]')?.textContent==='Detectado');
  await rgbPage.waitForSelector('[data-as-rgb-panel="control"]');
  assert.equal(await rgbPage.locator('.rgb-tabs [role="tab"]').count(),4);
  await rgbPage.locator('#as-rgb-tab-devices').click();
  assert.equal(await rgbPage.locator('[data-as-rgb-panel="devices"]').isVisible(),true);
  assert.equal(await rgbPage.locator('[data-as-rgb-panel="control"]').isVisible(),false);
  assert.equal(await rgbPage.locator('[data-device-status="keyboard"]').innerText(),'Detectado');
  assert.equal(await rgbPage.locator('[data-device-status="controller"]').innerText(),'Não identificado');
  assert.ok((await rgbPage.locator('#rgb-keyboard-detail').innerText()).includes('HID do fabricante'));
  // O motor de sincronização é funcional na prévia sem enviar comandos ao PC.
  await rgbPage.locator('#as-rgb-tab-preview').click();
  assert.equal(await rgbPage.locator('[data-as-rgb-panel="preview"]').isVisible(),true);
  await rgbPage.waitForSelector('#rgb-sync-preview .rgb-sync-tile');
  assert.equal(await rgbPage.locator('.rgb-sync-tile').count(),4);
  await rgbPage.locator('#rgb-sync-effect').selectOption('rainbow');
  await rgbPage.locator('#rgb-sync-brightness').fill('64');
  assert.equal(await rgbPage.locator('#rgb-sync-brightness-value').innerText(),'64%');
  const colors=await rgbPage.locator('.rgb-sync-tile-value').allInnerTexts();
  assert.equal(new Set(colors).size,1,"Arco-íris em fase deve ter mesma cor nos quatro canais");
  await rgbPage.locator('#rgb-sync-effect').selectOption('wave');
  const waveColors=await rgbPage.locator('.rgb-sync-tile-value').allInnerTexts();
  assert.ok(new Set(waveColors).size>1,"Onda deve ter fases diferentes");
  await rgbPage.locator('#rgb-sync-start').click();
  assert.equal(await rgbPage.locator('#rgb-sync-start').innerText(),'Pausar prévia');
  await rgbPage.locator('#rgb-sync-start').click();
  assert.equal(await rgbPage.locator('#rgb-sync-start').innerText(),'Iniciar prévia');
  assert.ok((await rgbPage.locator('.rgb-sync-footnote').innerText()).includes('virtuais'));
  // Conexões reais: SATA alimenta, CFAN controla ventoinhas, ARGB precisa de fonte própria.
  await rgbPage.locator('#as-rgb-tab-advanced').click();
  await rgbPage.waitForSelector('#rgb-hub-form');
  assert.equal(await rgbPage.locator('#rgb-hub-power').inputValue(),'sata');
  assert.equal(await rgbPage.locator('#rgb-hub-fan').inputValue(),'cfan');
  assert.equal(await rgbPage.locator('#rgb-hub-argb').inputValue(),'unknown');
  assert.equal(await rgbPage.locator('#rgb-hub-form').getAttribute('data-hardware-control'),'false');
  assert.ok((await rgbPage.locator('#rgb-hub-warnings').innerText()).includes('cooler da CPU'));
  await rgbPage.locator('#rgb-hub-argb').selectOption('usb-bridge');
  assert.ok((await rgbPage.locator('#rgb-hub-physical-status').innerText()).includes('protocolo ainda não validado'));
  assert.equal(await rgbPage.locator('#rgb-hub-form').getAttribute('data-hardware-control'),'false');
  await rgbPage.locator('#rgb-hub-save').click();
  await rgbPage.reload();
  await rgbPage.waitForSelector('#as-rgb-tab-advanced[aria-selected="true"]');
  await rgbPage.waitForSelector('#rgb-hub-form');
  assert.equal(await rgbPage.locator('#rgb-hub-argb').inputValue(),'usb-bridge');
  await rgbPage.locator('#rgb-hub-argb').selectOption('motherboard');
  assert.ok((await rgbPage.locator('#rgb-hub-warnings').innerText()).includes('não possui header ARGB'));
  await rgbPage.locator('#rgb-hub-reset').click();
  assert.equal(await rgbPage.locator('#rgb-hub-argb').inputValue(),'unknown');
  assert.equal(await rgbPage.locator('#rgb-hub-form').getAttribute('data-hardware-control'),'false');
  await rgbPage.locator('#rgb-search').fill('MI_01');
  assert.ok((await rgbPage.locator('#rgb-count').innerText()).includes('1 interface'));
  assert.ok(await rgbPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await rgbPage.screenshot({path:path.join(output,'rgb-controller-mobile.png'),fullPage:true});
  await rgbPage.setViewportSize({width:1280,height:800});
  assert.ok(await rgbPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await rgbPage.screenshot({path:path.join(output,'rgb-controller-desktop.png'),fullPage:true});
  assertions+=32;await rgbCtx.close();
  // Reproduzir captura real: GUI RGB nova + AppSpacePC antigo da OTA 0.7.30
  // cuja allowlist rejeita /rgb/devices. Desktop deve usar API interna.
  const rgbDesktopCtx=await browser.newContext({viewport:{width:1280,height:740}});
  await rgbDesktopCtx.addInitScript(()=>{
    window.__legacyCalls=0;window.__directCalls=0;
    const legacyPC={
      isDesktop:true,get:()=>({ip:'local',hostname:'Este computador'}),
      request:()=>{window.__legacyCalls++;throw Error('Rota não autorizada')}
    };
    Object.defineProperty(window,'AppSpacePC',{
      configurable:true,get:()=>legacyPC,set:()=>{} // Anular carregamento do adapter antigo.
    });
    const initialFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      if(String(url)==='/__api/rgb/devices'){
        window.__directCalls++;
        return Promise.resolve(new Response(JSON.stringify({
          available:true,devices:[
            {id:'controller',present:false,interfaceCount:0,interfaces:[]},
            {id:'fifine',vid:'3142',pid:'A010',present:true,interfaceCount:1,
              interfaces:[{name:'fifine Microphone',class:'MEDIA',mi:'00',bus:'USB'}]},
            {id:'keyboard',vid:'0C45',pid:'8006',present:true,interfaceCount:1,hasVendorHID:true,
              interfaces:[{name:'Dispositivo definido pelo fornecedor',class:'HIDClass',mi:'01',bus:'HID',vendorDefined:true}]},
            {id:'redragon',present:false,interfaceCount:0,interfaces:[]}
          ],
          openRGB:{connected:false,devices:[]}
        }),{status:200,headers:{'content-type':'application/json'}}));
      }
      return initialFetch(url,options);
    };
  });
  const rgbNative=await rgbDesktopCtx.newPage();rgbNative.on('pageerror',e=>errors.push(e.message));
  await rgbNative.goto(base+'/apps/meu-pc/rgb/index.html');
  await rgbNative.waitForFunction(()=>document.querySelector('[data-device-status="fifine"]')?.textContent==='Detectado');
  assert.equal(await rgbNative.locator('#rgb-status').innerText(),'Windows conectado');
  assert.equal(await rgbNative.locator('[data-device-status="keyboard"]').innerText(),'Detectado');
  assert.ok(!(await rgbNative.locator('#rgb-alert').innerText()).includes('Rota não autorizada'));
  assert.deepEqual(await rgbNative.evaluate(()=>[window.__legacyCalls,window.__directCalls]),[0,1]);
  const font=await rgbNative.evaluate(()=>getComputedStyle(document.body).fontFamily);
  assert.ok(font.includes('Segoe UI')||font.includes('system-ui'),'A interface RGB não pode herdar fonte serifada');
  assert.ok(await rgbNative.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await rgbNative.screenshot({path:path.join(output,'rgb-controller-desktop-stale-ota-fixed.png'),fullPage:true});
  assertions+=6;await rgbDesktopCtx.close();
  // AppSpace Clean: desktop/mobile dashboard and accessible settings disclosure.
  const cleanCtx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const cleanHome=await cleanCtx.newPage();cleanHome.on('pageerror',e=>errors.push(e.message));
  await cleanHome.goto(base+'/index.html');
  assert.ok(await cleanHome.locator('.hero').isVisible());
  assert.ok((await cleanHome.locator('.hero').boundingBox()).height<290,'Home should not have a huge hero');
  assert.ok(!(await cleanHome.locator('.stats-grid').isVisible()),'Duplicate statistics should not consume space');
  assert.equal(await cleanHome.locator('.folder-card:visible').count(),4);
  assert.equal(await cleanHome.locator('.app-card:visible').count(),3);
  assert.ok(await cleanHome.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await cleanHome.screenshot({path:path.join(output,'appspace-clean-home-desktop.png'),fullPage:true});
  await cleanHome.setViewportSize({width:412,height:915});
  assert.ok(await cleanHome.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await cleanHome.screenshot({path:path.join(output,'appspace-clean-home-mobile.png'),fullPage:true});
  const cleanSettings=await cleanCtx.newPage();cleanSettings.on('pageerror',e=>errors.push(e.message));
  await cleanSettings.goto(base+'/configuracoes.html');
  await cleanSettings.waitForSelector('.as-settings-group');
  assert.equal(await cleanSettings.locator('.as-settings-group').count(),4);
  assert.ok(await cleanSettings.locator('#as-settings-appearance').evaluate(el=>el.open));
  assert.ok(!(await cleanSettings.locator('.settings-preview').isVisible()));
  await cleanSettings.locator('[href="#as-settings-updates"]').click();
  assert.ok(await cleanSettings.locator('#as-settings-updates').evaluate(el=>el.open));
  assert.ok(!(await cleanSettings.locator('#as-settings-appearance').evaluate(el=>el.open)));
  await cleanSettings.locator('[href="#as-settings-mobile"]').click();
  assert.ok(await cleanSettings.locator('#navegacao-mobile').isVisible());
  assert.ok(await cleanSettings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await cleanSettings.screenshot({path:path.join(output,'appspace-clean-settings-desktop.png'),fullPage:true});
  await cleanSettings.setViewportSize({width:412,height:915});
  assert.ok(await cleanSettings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await cleanSettings.screenshot({path:path.join(output,'appspace-clean-settings-mobile.png'),fullPage:true});
  assertions+=17;await cleanCtx.close();
  // Local files keep the folder and editor available without networking.
  const offline=await browser.newContext({offline:true,viewport:{width:412,height:915}});
  const local=await offline.newPage();local.on('pageerror',e=>errors.push(e.message));
  await local.goto(pathToFileURL(path.join(root,'apps/estoque/index.html')).href);
  assert.equal(await local.locator('[data-drawer-app]:visible').count(),2);
  await local.locator('[href="./etiquetas/index.html"]').click();await local.waitForSelector('#label-canvas');
  assert.ok(await local.locator('#label-canvas').isVisible());assertions+=2;
  await offline.close();await ctx.close();
  assert.deepEqual(errors,[],'No uncaught browser errors');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({assertions,errors,viewports:[320,360,412,844,1280],themes:['dark','light'],navigation:['classic','minimal']},null,2));
  console.log('[Drawer UI] '+assertions+' assertions passed, offline navigation and no uncaught browser errors.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
