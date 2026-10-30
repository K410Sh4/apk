/* Renderização SVG isolada da biblioteca do AppSpace: layout sempre em milímetros. */
(function(root,factory){
  const api=factory(root.EtiquetaModel);
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.EtiquetaBatchRender=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(M){
 "use strict";
 const NS="http://www.w3.org/2000/svg";
 const s=(tag,attributes={},text)=>{
   const el=document.createElementNS(NS,tag);
   for(const [k,v] of Object.entries(attributes))if(v!=null)el.setAttribute(k,String(v));
   if(text!==undefined)el.textContent=String(text);
   return el;
 };
 function lines(text,size,w,h){
   const limit=Math.max(1,Math.floor(w/(size*.53))),n=Math.max(1,Math.floor(h/(size*1.18)));
   const out=[];
   for(const paragraph of String(text??"").split("\n")){
     let line="";
     for(const word of paragraph.split(/\s+/)){
       if(!word)continue;
       if(line&&line.length+1+word.length>limit){out.push(line);line="";}
       if(word.length>limit){
         if(line){out.push(line);line="";}
         for(let i=0;i<word.length;i+=limit){
           const part=word.slice(i,i+limit);
           if(i+limit<word.length)out.push(part);else line=part;
         }
       }else line=line?line+" "+word:word;
     }
     if(line||!out.length)out.push(line);
     if(out.length>=n)break;
   }
   return out.slice(0,n);
 }
 function item(g,o){
   if(o.type==="rect")g.append(s("rect",{x:o.x,y:o.y,width:o.w,height:o.h,rx:Math.min(o.radius,o.w/2,o.h/2),fill:o.fill,stroke:o.stroke,"stroke-width":o.strokeWidth}));
   else if(o.type==="ellipse")g.append(s("ellipse",{cx:o.x+o.w/2,cy:o.y+o.h/2,rx:o.w/2,ry:o.h/2,fill:o.fill,stroke:o.stroke,"stroke-width":o.strokeWidth}));
   else if(o.type==="line")g.append(s("line",{x1:o.x,y1:o.y,x2:o.x+o.w,y2:o.h<=1?o.y:o.y+o.h,stroke:o.stroke,"stroke-width":Math.max(.2,o.strokeWidth||.4),"stroke-linecap":"round"}));
   else if(o.type==="image")g.append(s("image",{x:o.x,y:o.y,width:o.w,height:o.h,href:o.image,preserveAspectRatio:"xMidYMid meet"}));
   else if(o.type==="barcode"){
     const code=M.barcodeBits(o.text);
     if(!code)throw Error("Código Code 39 inválido: "+o.text);
     const quiet=Math.min(2.5,o.w*.065),unit=(o.w-2*quiet)/code.bits.length;
     for(let i=0;i<code.bits.length;i++)if(code.bits[i]==="1")
       g.append(s("rect",{x:o.x+quiet+i*unit,y:o.y,width:unit,height:o.h,fill:o.fill}));
   }else if(o.type==="text"){
     const x=o.align==="center"?o.x+o.w/2:o.align==="right"?o.x+o.w:o.x;
     const text=s("text",{x,y:o.y+o.fontSize,"font-size":o.fontSize,"font-family":o.fontFamily,
       "font-weight":o.weight,"text-anchor":o.align==="center"?"middle":o.align==="right"?"end":"start",
       fill:o.fill,stroke:"none"});
     lines(o.text,o.fontSize,o.w,o.h).forEach((line,i)=>{
       text.append(s("tspan",{x,dy:i===0?0:o.fontSize*1.18},line));
     });
     g.append(text);
   }
 }
 function drawLabel(g,label){
   g.append(s("rect",{width:label.width,height:label.height,fill:label.background,stroke:"none"}));
   for(const o of label.objects)item(g,o);
 }
 function labelSvg(raw){
   const label=M.validate(raw);
   const svg=s("svg",{xmlns:NS,width:label.width+"mm",height:label.height+"mm",viewBox:`0 0 ${label.width} ${label.height}`,stroke:"none"});
   drawLabel(svg,label);
   return svg;
 }
 function a4Page(items,preview=false,guidePositions=[]){
   const svg=s("svg",{xmlns:NS,width:"210mm",height:"297mm",viewBox:"0 0 210 297",stroke:"none"});
   svg.append(s("rect",{width:210,height:297,fill:"#ffffff",stroke:"none"}));
   if(preview&&items.length){
     const first=items[0].label;
     for(const pos of guidePositions){
       svg.append(s("rect",{x:pos.x,y:pos.y,width:first.width,height:first.height,fill:"none",
         stroke:"#dce1e9","stroke-width":.15,"stroke-dasharray":"1 .7","pointer-events":"none"}));
     }
   }
   items.forEach(({label,position},i)=>{
     const id="batch-clip-"+i,def=s("defs"),clip=s("clipPath",{id});
     clip.append(s("rect",{width:label.width,height:label.height}));def.append(clip);svg.append(def);
     const g=s("g",{transform:`translate(${position.x} ${position.y})`,"clip-path":"url(#"+id+")"});
     drawLabel(g,label);svg.append(g);
     if(preview)svg.append(s("rect",{x:position.x,y:position.y,width:label.width,height:label.height,
        fill:"none",stroke:"#b9c4d1","stroke-width":.18,"pointer-events":"none"}));
   });
   return svg;
 }
 function printHtml(pages){
   const serializer=new XMLSerializer();
   return '<!doctype html><html><head><meta charset="utf-8"><style>'+
     '@page{size:A4;margin:0}html,body{margin:0;background:white}'+
     '.page{display:block;width:210mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}'+
     '.page:last-child{page-break-after:auto;break-after:auto}svg{display:block;width:210mm;height:297mm;stroke:none}</style>'+
     '</head><body>'+pages.map(page=>'<div class="page">'+serializer.serializeToString(a4Page(page))+'</div>').join("")+'</body></html>';
 }
 return Object.freeze({labelSvg,a4Page,printHtml});
});
