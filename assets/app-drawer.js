/* Uma gaveta por pasta. Filtro em lote, ícones preservados e links offline. */
(()=>{
'use strict';
const drawer=document.querySelector('[data-app-drawer]');
if(!drawer)return;
const $=id=>document.getElementById(id),grid=$('drawer-grid'),search=$('drawer-search'),sort=$('drawer-sort');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
const apps=[...grid.querySelectorAll('[data-drawer-app]')].map((link,index)=>({link,item:link.closest('li'),name:link.querySelector('.drawer-app-name').textContent.trim(),index,query:normalize(link.textContent+' '+(link.dataset.search||''))}));
const key='appspace.drawer.v1.'+drawer.dataset.appDrawer;
let frame=0,lastOrder='';
function save(){try{sessionStorage.setItem(key,JSON.stringify({query:search.value,sort:sort.value}));}catch(_){}}
function render(){
 frame=0;
 const query=normalize(search.value),order=sort.value==='za'?'za':'az';
 if(order!==lastOrder){
  const fragment=document.createDocumentFragment();
  [...apps].sort((a,b)=>(order==='za'?-1:1)*collator.compare(a.name,b.name)||a.index-b.index).forEach(app=>fragment.append(app.item));
  grid.append(fragment);lastOrder=order;
 }
 let count=0;
 for(const app of apps){const show=app.query.includes(query);app.item.hidden=!show;if(show)count++;}
 $('drawer-count').textContent=query?`${count} de ${apps.length} aplicativos`:`${apps.length} ${apps.length===1?'aplicativo':'aplicativos'}`;
 $('drawer-clear').hidden=!search.value;
 $('drawer-empty').hidden=count>0;
 $('drawer-grid').hidden=count===0;
 $('drawer-empty-title').textContent=apps.length?'Nenhum aplicativo encontrado':'Esta pasta ainda está vazia';
 $('drawer-empty-message').textContent=apps.length?'Tente outro nome ou limpe a pesquisa.':'Os novos aplicativos aparecerão aqui.';
 $('drawer-reset-search').hidden=!search.value;
 save();
}
function schedule(){if(!frame)frame=requestAnimationFrame(render);}
function clear(){search.value='';if(frame)cancelAnimationFrame(frame);render();search.focus();}
try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&typeof saved.query==='string')search.value=saved.query.slice(0,120);if(['az','za'].includes(saved?.sort))sort.value=saved.sort;}catch(_){}
search.maxLength=120;
search.addEventListener('input',schedule);
sort.addEventListener('change',schedule);
$('drawer-clear').addEventListener('click',clear);
$('drawer-reset-search').addEventListener('click',clear);
search.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();clear();}if(event.key==='Enter')search.blur();});
window.addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;save();});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
render();
})();
