/* AppSpace RGB Sync v0.1 — motor matemático de cenas, sem acesso físico ao hardware.
 * Compartilhável entre Node e navegador. Drivers só serão adicionados com protocolos verificados.
 */
(function(root,factory){
 "use strict";
 const moduleValue=factory();
 if(typeof module==="object"&&module.exports)module.exports=moduleValue;
 else root.AppSpaceRgbSync=moduleValue;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const EFFECTS=Object.freeze(["solid","breathing","rainbow","wave","pulse"]);
 const DEFAULTS=Object.freeze({effect:"solid",color:"#9c70ff",brightness:75,speed:50,synchronized:true});
 const clamp=(n,low,high)=>Math.max(low,Math.min(high,Number.isFinite(Number(n))?Number(n):low));
 function normalize(settings={}){
  return {
   effect:EFFECTS.includes(settings.effect)?settings.effect:DEFAULTS.effect,
   color:/^#[0-9a-fA-F]{6}$/.test(settings.color||"")?settings.color.toLowerCase():DEFAULTS.color,
   brightness:Math.round(clamp(settings.brightness??DEFAULTS.brightness,0,100)),
   speed:Math.round(clamp(settings.speed??DEFAULTS.speed,1,100)),
   synchronized:settings.synchronized!==false
  };
 }
 function toRgb(color){
  const h=color.slice(1);return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
 }
 function encode(rgb){
  return "#"+rgb.map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,"0")).join("");
 }
 function fromHsv(h,s,v){
  const hue=((h%360)+360)%360;
  const c=v*s,x=c*(1-Math.abs((hue/60)%2-1)),m=v-c;
  const [r,g,b]=hue<60?[c,x,0]:hue<120?[x,c,0]:hue<180?[0,c,x]:hue<240?[0,x,c]:hue<300?[x,0,c]:[c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
 }
 // Todas as saídas usam o mesmo relógio: sincronismo por frame, não timers independentes.
 function frame(timeMs,deviceIndex=0,count=1,settings=DEFAULTS){
  const opt=normalize(settings);
  const time=clamp(timeMs,0,Number.MAX_SAFE_INTEGER)/1000;
  const speed=0.22+opt.speed/45;
  const phase=opt.synchronized?0:Math.max(0,Math.floor(deviceIndex))*0.75;
  const index=Math.max(0,Math.floor(deviceIndex));
  const len=Math.max(1,Math.floor(count));
  let level=1,rgb=toRgb(opt.color);
  if(opt.effect==="breathing")level=.14+.86*(.5+.5*Math.sin((time*speed+phase)*Math.PI*2));
  else if(opt.effect==="pulse")level=.12+.88*Math.pow(Math.max(0,Math.sin((time*speed+phase)*Math.PI*2)),5);
  else if(opt.effect==="rainbow")rgb=fromHsv((time*speed*90+phase*56)%360,1,1);
  else if(opt.effect==="wave")rgb=fromHsv((time*speed*85+(index/len)*300)%360,1,1);
  const gain=level*opt.brightness/100;
  return encode(rgb.map(n=>n*gain));
 }
 function renderFrame(timeMs,deviceIds,settings){
  const ids=Array.isArray(deviceIds)?deviceIds.slice(0,32):[];
  return ids.map((id,index)=>({id:String(id),color:frame(timeMs,index,ids.length,settings)}));
 }
 return Object.freeze({EFFECTS,DEFAULTS,normalize,frame,renderFrame});
});
