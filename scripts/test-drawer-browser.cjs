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
    for(const [folder,count] of [['estoque',2],['edicao-de-video',0],['meu-pc',1]]){
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
  await page.keyboard.press('Escape');assert.equal(await page.locator('.folder-card:visible').count(),3);assertions+=4;
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
  const labelsPage=await labelsContext.newPage();labelsPage.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[320,640],[412,915],[1280,800]]){
    await labelsPage.setViewportSize({width,height});
    await labelsPage.goto(base+'/apps/estoque/etiquetas/index.html');
    await labelsPage.evaluate(()=>localStorage.removeItem('appspace.estoque.precision.v1'));
    await labelsPage.reload();
    await labelsPage.locator('#studio-grid').click();
    assert.equal(await labelsPage.locator('#studio-grid').getAttribute('aria-pressed'),'true');
    await labelsPage.locator('#studio-snap').click();
    assert.equal(await labelsPage.locator('#studio-snap').getAttribute('aria-pressed'),'true');
    if(width===412)await labelsPage.screenshot({path:path.join(output,'etiqueta-editor-mobile.png'),fullPage:true});
    await labelsPage.goto(base+'/apps/estoque/etiquetas/lote/index.html');
    await labelsPage.evaluate(()=>localStorage.removeItem('appspace.estoque.lote.v1'));
    await labelsPage.reload();
    await labelsPage.locator('#next-list').click();
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
