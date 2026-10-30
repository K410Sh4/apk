"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const hub=require("../assets/rgb-hub-model.js");
assert.deepEqual(hub.normalize(),{power:"sata",fanSignal:"cfan",argbSignal:"unknown",coolerPath:"unknown"});
const base=hub.assess();
assert.equal(base.hardwareControl,false);
assert.match(base.details.power,/SATA/);
assert.match(base.details.fan,/CFAN/);
assert.match(base.details.light,/Nenhuma comunicação RGB/);
assert.ok(base.warnings.some(s=>/cooler da CPU/.test(s)));
assert.ok(base.next.some(s=>/3 pinos/.test(s)));
for(const choice of hub.OPTIONS.argbSignal){
 const status=hub.assess({...hub.DEFAULTS,argbSignal:choice});
 assert.equal(status.hardwareControl,false,"Nenhuma opção manual pode ativar escrita RGB");
}
const bridge=hub.assess({argbSignal:"usb-bridge"});
assert.equal(bridge.lightState,"unverified");
assert.match(bridge.details.light,/protocolo ainda não validado/);
const wrong=hub.assess({argbSignal:"motherboard"});
assert.equal(wrong.lightState,"warning");
assert.ok(wrong.warnings.some(x=>/não possui header ARGB/.test(x)));
const unplugged=hub.assess({argbSignal:"not-connected"});
assert.match(unplugged.details.light,/sem sinal externo/);
assert.ok(unplugged.next.some(x=>/USB programável/.test(x)));
assert.deepEqual(hub.normalize({power:"12volt",fanSignal:"bad",argbSignal:"custom",coolerPath:"unknown"}),hub.DEFAULTS);
const html=fs.readFileSync(path.join(__dirname,"../apps/meu-pc/rgb/index.html"),"utf8");
const js=fs.readFileSync(path.join(__dirname,"../assets/rgb-hub-setup.js"),"utf8");
for(const id of ["rgb-hub-form","rgb-hub-power","rgb-hub-fan","rgb-hub-argb","rgb-hub-cooler","rgb-hub-save","rgb-hub-reset","rgb-hub-control-status"]){
 assert.ok(html.includes('id="'+id+'"'),"Campo manual faltando: "+id);
}
assert.ok(js.includes('dataset.hardwareControl="false"'));
assert.ok(!/hid\.write|setFeatureReport|usb\.transfer|usb\.write|serial\.write|rgb\.setColors/i.test(js),"Interface não escreve no hardware");
console.log("[RGB Hub] Perfil SATA/CFAN/ARGB, alertas e bloqueio de escrita: OK");
