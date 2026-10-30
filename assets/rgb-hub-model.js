/* AppSpace: inventário MANUAL do hub SATA/PWM/ARGB, sem comandos de hardware.
 * Fontes: fotografia do diagrama enviada pelo usuário e conectores confirmados.
 */
(function(root,factory){
"use strict";
const value=factory();
if(typeof module==="object"&&module.exports)module.exports=value;
else root.AppSpaceRgbHub=value;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const DEFAULTS=Object.freeze({
 power:"sata",
 fanSignal:"cfan",
 argbSignal:"unknown",
 coolerPath:"unknown"
});
const OPTIONS=Object.freeze({
 power:["sata","unknown"],
 fanSignal:["cfan","sfan","none","unknown"],
 argbSignal:["unknown","not-connected","usb-bridge","motherboard"],
 coolerPath:["unknown","hub","independent"]
});
function normalize(input={}){
 const result={};
 for(const [field,valid] of Object.entries(OPTIONS))
  result[field]=valid.includes(input?.[field])?input[field]:DEFAULTS[field];
 return result;
}
function assess(input={}){
 const profile=normalize(input),warnings=[],next=[];
 let light="Nenhuma comunicação RGB física confirmada";
 let lightState="pending";
 const fan=profile.fanSignal==="cfan"?
  "CFAN: sinal de rotação/PWM, não de cores":
  profile.fanSignal==="sfan"?"SFAN: sinal de rotação, não de cores":
  profile.fanSignal==="none"?"Nenhum cabo FAN informado":
  "Conexão FAN ainda não confirmada";
 if(profile.power==="sata")next.push("Alimentação SATA informada; o AppSpace não consegue comandar LEDs por esse cabo.");
 if(profile.fanSignal==="cfan"){
  warnings.push("CFAN é dedicado à ventilação do processador. Confirme que o cooler da CPU recebe alimentação e controle adequados.");
 }
 if(profile.coolerPath==="unknown")
  warnings.push("Ainda não foi confirmado onde a ventoinha do processador está ligada.");
 if(profile.argbSignal==="motherboard"){
  warnings.push("A Pichau H610M-T não possui header ARGB 5 V segundo as especificações oficiais. Confira a identificação física: não conecte ARGB ao FAN ou ao RGB 12 V.");
  light="Conexão ARGB informada é incompatível com a placa-mãe declarada";
  lightState="warning";
 }else if(profile.argbSignal==="usb-bridge"){
  light="Ponte USB–ARGB informada manualmente, mas protocolo ainda não validado";
  lightState="unverified";
  next.push("Identificar VID/PID e protocolo da ponte USB. Controle físico permanece bloqueado até validação.");
 }else if(profile.argbSignal==="not-connected"){
  light="Entrada ARGB sem sinal externo; controle pelo remoto/hub";
  next.push("Para sincronizar fisicamente: ponte USB programável com saída ARGB 5 V e pinagem confirmada.");
 }else{
  next.push("Conferir se a entrada ARGB 5 V de 3 pinos do hub está livre ou ligada a algum equipamento.");
 }
 if(profile.coolerPath==="hub")
  warnings.push("Se o cooler da CPU passa pelo hub, confirme que a ligação PWM/RPM e a refrigeração continuam corretas.");
 if(profile.fanSignal==="none")warnings.push("Sem controle FAN identificado: confira o funcionamento das ventoinhas.");
 const details={
  power:profile.power==="sata"?"Fonte SATA (energia, sem dados)": "Alimentação não verificada",
  fan,light
 };
 return {profile,details,lightState,hardwareControl:false,warnings,next};
}
return Object.freeze({DEFAULTS,OPTIONS,normalize,assess});
});
