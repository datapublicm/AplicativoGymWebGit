/* Gymlytics 01.08: controles complementarios de catálogos, 100 % locales.
   Sin llamadas a Supabase ni cambios de esquema remoto. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const details=['Agrupación','Anotación','Máquina','Agarre / Implemento','Técnica'];
 const detailKeys=['agrupacion','anotacion','instrumento','agarre_implemento','tecnica'];
 const normalize=value=>String(value??'').trim();
 function makeExtra(name='',value=''){
  const row=document.createElement('div');row.className='catalog-extra-row';
  row.innerHTML='<input class="extra-campo" maxlength="120" placeholder="Característica adicional" aria-label="Nombre de característica">'+
   '<input class="extra-valor" maxlength="500" placeholder="Valor o descripción" aria-label="Valor de característica">'+
   '<button type="button" class="outline-btn extra-remove" aria-label="Quitar detalle">×</button>';
  row.querySelector('.extra-campo').value=name;
  row.querySelector('.extra-valor').value=value;
  return row;
 }
 function collect(){
  const form=el('catalogForm'),values=Object.fromEntries(new FormData(form).entries());
  values.detalles_extra=[...el('catalogExtraDetails').querySelectorAll('.catalog-extra-row')]
   .map(row=>({campo:normalize(row.querySelector('.extra-campo').value),
    valor:normalize(row.querySelector('.extra-valor').value)}))
   .filter(x=>x.campo&&x.valor);
  el('catalogExtraPayload').value=JSON.stringify(values.detalles_extra);
  return values;
 }
 window.GymCatalogCollectExerciseValues=collect;
 function readExercise(){
  const id=window.GymCatalogSelectedExerciseId||el('exerciseExistingSelect')?.value;
  return (window.GymExerciseLibrary||[]).find(x=>String(x.id)===String(id));
 }
 function loadDetails(){
  const exercise=readExercise();
  if(!exercise){el('catalogForm').reset();el('catalogExtraDetails').replaceChildren();return;}
  el('catalogForm').elements.namedItem('e').value=exercise.nombre;
  for(let i=0;i<details.length;i++){
   const field=el('catalogForm').querySelector('[name="'+detailKeys[i]+'"]');
   if(!field)continue;
   field.value=(exercise.detalles||[]).find(x=>x.campo===details[i]||(details[i]==='Máquina'&&x.campo==='Instrumento'))?.valor||
    (detailKeys[i]==='anotacion'?exercise.zona_entrenamiento:
     detailKeys[i]==='tecnica'?exercise.tecnica_actualizada:'')||'';
  }
  const extras=(exercise.detalles||[]).filter(d=>!details.includes(d.campo)&&d.campo!=='Instrumento');
  el('catalogExtraDetails').replaceChildren(...extras.map(x=>makeExtra(x.campo,x.valor)));
  collect();
 }
 const extra=el('catalogExtraDetails');
 el('addExerciseExtra')?.addEventListener('click',event=>{
  event.preventDefault();
  if(extra.children.length>=30){el('catalogFeedback').textContent='Máximo 30 detalles adicionales.';return;}
  const added=makeExtra();extra.append(added);collect();
  added.querySelector('.extra-campo').focus();
  added.scrollIntoView?.({block:'nearest'});
  el('catalogFeedback').textContent='Característica añadida: completa nombre y valor y guarda el ejercicio.';
 });
 extra?.addEventListener('click',event=>{
  const remove=event.target.closest('.extra-remove');
  if(remove){remove.closest('.catalog-extra-row').remove();collect();}
 });
 extra?.addEventListener('input',collect);
 el('catalogForm')?.addEventListener('submit',collect,true);
 el('exerciseExistingSelect')?.addEventListener('change',loadDetails);
 window.GymCatalogExerciseChanged=loadDetails;
 // «Modificar» guarda nombre y detalles en una única transacción IndexedDB.
 const dialog=el('siteGPSDialog'),feedback=el('siteGPSFeedback');
 function gpsBadge(){
  const id=el('siteExistingSelect')?.value;
  const site=(window.GymEntities?.sites||[]).find(x=>String(x.id)===String(id));
  const saved=site?.latitud!=null&&site?.longitud!=null;
  const label=el('siteGPSStatus');
  if(label){label.textContent=saved?'✓ Ubicación registrada':'Sin ubicación';label.dataset.registered=saved?'true':'false';}
  return saved;
 }
 window.GymSiteGpsRefresh=gpsBadge;
 el('siteExistingSelect')?.addEventListener('change',gpsBadge);

 function map(){
  const latitude=Number(el('siteGPSLat').value),longitude=Number(el('siteGPSLon').value);
  const valid=el('siteGPSLat').value!==''&&el('siteGPSLon').value!==''&&
   Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)&&Math.abs(longitude)<=180;
  const frame=el('siteGPSMap'),fallback=el('siteGPSMapFallback');
  if(!valid||!navigator.onLine){
   frame.hidden=true;frame.removeAttribute('src');fallback.hidden=false;return;
  }
  const delta=.004,bbox=[longitude-delta,latitude-delta,longitude+delta,latitude+delta].join(',');
  frame.src='https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bbox)+
   '&layer=mapnik&marker='+encodeURIComponent(latitude+','+longitude);
  frame.hidden=false;fallback.hidden=true;
 }
 el('openSiteGPS')?.addEventListener('click',()=>{
  const choices=(window.GymEntities?.sites||[]);
  const id=el('siteExistingSelect').value||((choices.length===1)?String(choices[0].id):'');
  const site=(window.GymEntities?.sites||[]).find(x=>String(x.id)===id);
  const reference=(window.GymReferenceChoices?.('site',{})||[]).find(x=>x.id===id);
  if(!site&&!reference){el('siteFeedback').textContent='Selecciona primero una sede.';return;}
  dialog.dataset.siteId=id;el('siteGPSLabel').textContent='Sede: '+(site?.nombre||reference.name)+' · '+(site?.latitud!=null&&site?.longitud!=null?'Ubicación registrada':'Sin ubicación');
  el('siteGPSLat').value=site?.latitud??'';el('siteGPSLon').value=site?.longitud??'';
  feedback.textContent='';map();
  if(!dialog.open)dialog.showModal();
  dialog.scrollIntoView?.({block:'center'});
 });
 el('closeSiteGPS')?.addEventListener('click',()=>dialog.close());
 for(const id of ['siteGPSLat','siteGPSLon'])el(id)?.addEventListener('change',map);
 el('getCurrentGPS')?.addEventListener('click',()=>{
  if(!navigator.geolocation){feedback.textContent='El dispositivo no ofrece GPS.';return;}
  feedback.textContent='Obteniendo ubicación…';
  navigator.geolocation.getCurrentPosition(position=>{
   if(!dialog.open)return;
   el('siteGPSLat').value=position.coords.latitude.toFixed(7);
   el('siteGPSLon').value=position.coords.longitude.toFixed(7);
   map();feedback.textContent='Ubicación obtenida. Confirma para guardarla offline.';
  },error=>{feedback.textContent='GPS no disponible: '+error.message;},
  {enableHighAccuracy:true,timeout:15000,maximumAge:60000});
 });
 el('saveSiteGPS')?.addEventListener('click',async event=>{
  event.currentTarget.disabled=true;
  try{
   const savedId=await window.GymCloud.updateSiteGPS(dialog.dataset.siteId,el('siteGPSLat').value,el('siteGPSLon').value);
   dialog.dataset.siteId=String(savedId);
   el('siteExistingSelect').value=String(savedId);
   map();gpsBadge();const savedSite=(window.GymEntities?.sites||[]).find(s=>String(s.id)===String(savedId));
   el('siteGPSLabel').textContent='✓ Ubicación registrada · '+(savedSite?.nombre||'Sede');
   feedback.textContent='✓ Ubicación registrada. Marcador guardado offline.';
  }catch(error){feedback.textContent=String(error.message||error);}
  finally{event.currentTarget.disabled=false;}
 });
 const mode=el('registroSelectByFields'),group=el('registroAgrupacion'),wrap=el('registroAgrupacionWrap');
 const variant=el('registroVariante'),vwrap=el('registroVarianteWrap'),exercise=el('ejercicio'),zone=el('zona');
 const lib=()=>window.GymExerciseLibrary||[];
 const detail=(e,k)=>(e.detalles||[]).find(x=>x.campo===k||(k==='Máquina'&&x.campo==='Instrumento'))?.valor||'';
 const norm=x=>String(x||'').trim();
 const filters=[
  {node:group,label:'Agrupación',get:e=>detail(e,'Agrupación')},
  {node:zone,label:'Anotación',get:e=>detail(e,'Anotación')||e.zona_entrenamiento||''},
  {node:exercise,label:'Ejercicio',get:e=>e.nombre||''},
  {node:el('instrumento'),label:'Máquina',get:e=>detail(e,'Máquina')},
  {node:el('implemento'),label:'Agarre / Implemento',get:e=>detail(e,'Agarre / Implemento')},
  {node:el('tecnica'),label:'Técnica',get:e=>detail(e,'Técnica')||e.tecnica_actualizada||''}
 ];
 const unique=values=>[...new Set(values.map(norm).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 function setChoices(node,values,label){
  if(!node)return;
  const old=node.value,options=unique(values);
  node.replaceChildren(new Option(options.length?'Seleccionar '+label+'…':'Sin opciones',''));
  options.forEach(v=>node.add(new Option(v,v)));
  node.value=options.includes(old)?old:'';
  node.disabled=!options.length;
 }
 function variants(){
  if(!exercise||!variant)return;
  const choices=lib().filter(e=>norm(e.nombre)===norm(exercise.value)&&
   (!mode?.checked||filters.every(({node,get})=>!node?.value||norm(get(e))===norm(node.value))));
  const prior=window.GymSelectedExerciseId;
  variant.replaceChildren(new Option('Seleccionar variante…',''));
  for(const e of choices){
   const caption=[detail(e,'Máquina'),detail(e,'Agarre / Implemento'),detail(e,'Técnica')||e.tecnica_actualizada]
    .filter(Boolean).join(' · ');
   const similar=choices.filter(x=>[detail(x,'Máquina'),detail(x,'Agarre / Implemento'),detail(x,'Técnica')||x.tecnica_actualizada].filter(Boolean).join(' · ')===caption);
   const repeated=similar.length>1?' · Variante '+(similar.findIndex(x=>x.id===e.id)+1):'';
   variant.add(new Option((caption||e.nombre)+repeated,String(e.id)));
  }
  vwrap.hidden=choices.length<=1;variant.disabled=choices.length<=1;
  variant.value=choices.some(e=>String(e.id)===String(prior))?String(prior):
   choices.length===1?String(choices[0].id):'';
  window.GymSelectedExerciseId=variant.value||null;
  window.GymRegistroRefresh?.();
 }
 function applyVariant(){
  const e=lib().find(x=>String(x.id)===String(window.GymSelectedExerciseId||''));if(!e)return;
  for(const [id,value] of [
   ['zona',detail(e,'Anotación')||e.zona_entrenamiento],
   ['instrumento',detail(e,'Máquina')],['implemento',detail(e,'Agarre / Implemento')],
   ['tecnica',detail(e,'Técnica')||e.tecnica_actualizada]
  ]){
   const node=el(id);if(value&&node&&[...node.options].some(o=>o.value===value))node.value=value;
  }
  window.GymRegistroRefresh?.();
 }
 function refresh(){
  wrap.hidden=!mode?.checked;
  if(!mode?.checked){variants();return;}
  let possible=lib().slice();
  for(const {node,label,get} of filters){
   if(!node)continue;
   setChoices(node,possible.map(get),label.toLowerCase());
   if(node.value)possible=possible.filter(e=>norm(get(e))===norm(node.value));
  }
  variants();
 }
 function order(){
  const a=exercise?.closest('.field'),b=zone?.closest('.field');
  if(a&&b&&a.parentElement===b.parentElement)
   a.parentElement.insertBefore(mode?.checked?b:a,mode?.checked?a:b);
 }
 window.GymOfflineRefreshSelectors=refresh;
 mode?.addEventListener('change',()=>{order();refresh();applyVariant();});
 for(const {node} of filters){
  node?.addEventListener('change',()=>{
   if(mode?.checked)refresh();
   else variants();
   applyVariant();
  });
 }
 variant?.addEventListener('change',()=>{window.GymSelectedExerciseId=variant.value||null;applyVariant();});
 el('addExerciseExtra')?.addEventListener('click',()=>window.GymCatalogFieldRefresh?.());
 order();refresh();gpsBadge();
})();
