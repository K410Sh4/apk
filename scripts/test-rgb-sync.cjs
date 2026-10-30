"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const sync=require("../assets/rgb-sync-engine.js");
assert.deepEqual(sync.EFFECTS,["solid","breathing","rainbow","wave","pulse"]);
assert.equal(sync.normalize({effect:"arbitrary",color:"red",brightness:999,speed:-10}).effect,"solid");
assert.equal(sync.normalize({color:"bad"}).color,"#9c70ff");
assert.equal(sync.normalize({brightness:999}).brightness,100);
assert.equal(sync.normalize({speed:-5}).speed,1);
assert.equal(sync.frame(0,0,4,{effect:"solid",color:"#ff0000",brightness:100}),"#ff0000");
assert.equal(sync.frame(0,0,4,{effect:"solid",color:"#ff0000",brightness:50}),"#800000");
assert.equal(sync.frame(0,0,4,{effect:"solid",color:"#ff0000",brightness:0}),"#000000");
const ids=["controller","fifine","keyboard","redragon"];
const solid=sync.renderFrame(7500,ids,{effect:"solid",color:"#2255aa",brightness:100});
assert.equal(solid.length,4);assert.deepEqual(solid.map(v=>v.id),ids);
assert.equal(new Set(solid.map(v=>v.color)).size,1);
for(const effect of sync.EFFECTS){
 const s={effect,color:"#aa3355",brightness:80,speed:50,synchronized:true};
 const a=sync.renderFrame(1540,ids,s),b=sync.renderFrame(1540,ids,s);
 assert.deepEqual(a,b,"Frames determinísticos em "+effect);
 assert.ok(a.every(x=>/^#[0-9a-f]{6}$/.test(x.color)));
}
const rainbow=sync.renderFrame(1371,ids,{effect:"rainbow",brightness:100,synchronized:true});
assert.equal(new Set(rainbow.map(x=>x.color)).size,1,"Arco-íris sincronizado tem uma única fase");
const wave=sync.renderFrame(1371,ids,{effect:"wave",brightness:100,synchronized:true});
assert.equal(new Set(wave.map(x=>x.color)).size,4,"Onda atravessa dispositivos com fases diferentes");
const desync=sync.renderFrame(1371,ids,{effect:"rainbow",brightness:100,synchronized:false});
assert.ok(new Set(desync.map(x=>x.color)).size>1,"Desativar sincronismo altera fases");
assert.equal(sync.renderFrame(50,[],{}).length,0);
assert.equal(sync.renderFrame(50,Array(200).fill("a"),{}).length,32,"Limite de 32 saídas virtuais");
const js=fs.readFileSync(path.resolve(__dirname,"../assets/rgb-sync-ui.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"../apps/meu-pc/rgb/index.html"),"utf8");
assert.ok(!/hid\.write|writeHid|usb\.transfer|sendReport|SendInput/i.test(js),"Não escrever em hardware");
for(const id of ["rgb-sync-effect","rgb-sync-color","rgb-sync-brightness","rgb-sync-speed","rgb-sync-together","rgb-sync-start","rgb-sync-preview"]){
 assert.ok(html.includes('id="'+id+'"'),"Controle RGB ausente: "+id);
}
console.log("[AppSpace RGB Sync] 30+ casos de efeitos, sincronismo, segurança e UI: OK");
