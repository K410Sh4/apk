/* Etiqueta Studio — matemática dos gestos independente do SVG.
   Milímetros são a única unidade persistida. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.EtiquetaGestures=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const center=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function pinch(start,first,second,firstNow,secondNow,label,snap=false){
    const d0=distance(first,second);
    if(d0<1)return null;
    const factor=clamp(distance(firstNow,secondNow)/d0,.1,8);
    const maxW=Math.min(240,Math.max(1,label.width));
    const maxH=Math.min(320,Math.max(1,label.height));
    const round=n=>snap?Math.round(n):Math.round(n*4)/4;
    const w=clamp(round(start.w*factor),1,maxW);
    // Linhas divisórias mantêm o ângulo original; h=1 é o formato horizontal no modelo.
    const h=start.type==="line"&&start.h<=1?start.h:
      clamp(round(start.h*factor),1,maxH);
    const a=center(first,second),b=center(firstNow,secondNow);
    const x=clamp(round(start.x+(start.w-w)/2+b.x-a.x),0,Math.max(0,label.width-w));
    const y=clamp(round(start.y+(start.h-h)/2+b.y-a.y),0,Math.max(0,label.height-h));
    const result={x,y,w:Math.min(w,label.width-x),h:Math.min(h,label.height-y)};
    if(start.type==="text")result.fontSize=clamp(Math.round(start.fontSize*factor*100)/100,1.3,24);
    if(start.type==="line")result.strokeWidth=clamp(Math.round(start.strokeWidth*factor*100)/100,0,4);
    return result;
  }
  function isDoubleTap(previous,next){
    return Boolean(previous&&next&&previous.id===next.id&&next.time>=previous.time&&
      next.time-previous.time<=360&&distance(previous,next)<=3.5);
  }
  return Object.freeze({pinch,isDoubleTap,distance});
});
