/* Gymlytics 01.08: controles complementarios de catálogos, 100 % locales.
   Sin llamadas a Supabase ni cambios de esquema remoto. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const details=['Agrupación','Anotación','Instrumento','Agarre / Implemento','Técnica'];
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
 function readExercise(){
  const id=el('exerciseExistingSelect')?.value;
  return (window.GymExerciseLibrary||[]).find(x=>String(x.id)===String(id));
 }
 function loadDetails(){
  const exercise=readExercise();if(!exercise)return;
  for(let i=0;i<details.length;i++){
   const field=el('catalogForm').querySelector('[name="'+detailKeys[i]+'"]');
   if(!field)continue;
   field.value=(exercise.detalles||[]).find(x=>x.campo===details[i])?.valor||
    (detailKeys[i]==='anotacion'?exercise.zona_entrenamiento:
     detailKeys[i]==='tecnica'?exercise.tecnica_actualizada:'')||'';
  }
  const extras=(exercise.detalles||[]).filter(d=>!details.includes(d.campo));
  el('catalogExtraDetails').replaceChildren(...extras.map(x=>makeExtra(x.campo,x.valor)));
  collect();
 }
 const extra=el('catalogExtraDetails');
 el('addExerciseExtra')?.addEventListener('click',()=>{
  if(extra.children.length>=30){el('catalogFeedback').textContent='Máximo 30 detalles adicionales.';return;}
  extra.append(makeExtra());collect();
 });
 extra?.addEventListener('click',event=>{
  const remove=event.target.closest('.extra-remove');
  if(remove){remove.closest('.catalog-extra-row').remove();collect();}
 });
 extra?.addEventListener('input',collect);
 el('catalogForm')?.addEventListener('submit',collect,true);
 el('exerciseExistingSelect')?.addEventListener('change',loadDetails);
 el('editExerciseDetails')?.addEventListener('click',async event=>{
  const id=el('exerciseExistingSelect').value,feedback=el('exerciseEditFeedback');
  if(!id){feedback.textContent='Selecciona primero un ejercicio de este perfil.';return;}
  event.currentTarget.disabled=true;
  try{
   await window.GymCloud.updateExerciseDetails(id,collect());
   feedback.textContent='Detalles del ejercicio modificados offline, conservando su identificador.';
  }catch(error){feedback.textContent='No se guardaron los detalles: '+String(error.message||error);}
  finally{event.currentTarget.disabled=false;}
 });
 const dialog=el('siteGPSDialog'),feedback=el('siteGPSFeedback');
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
  const id=el('siteExistingSelect').value;
  const site=(window.GymEntities?.sites||[]).find(x=>String(x.id)===id);
  const reference=(window.GymReferenceChoices?.('site',{})||[]).find(x=>x.id===id);
  if(!site&&!reference){el('siteFeedback').textContent='Selecciona primero una sede.';return;}
  dialog.dataset.siteId=id;el('siteGPSLabel').textContent='Sede: '+(site?.nombre||reference.name);
  el('siteGPSLat').value=site?.latitud??'';el('siteGPSLon').value=site?.longitud??'';
  feedback.textContent='';map();dialog.showModal();
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
   feedback.textContent='Coordenadas de la sede guardadas offline ✓';
  }catch(error){feedback.textContent=String(error.message||error);}
  finally{event.currentTarget.disabled=false;}
 });
 const mode=el('registroSelectByFields'),group=el('registroAgrupacion'),wrap=el('registroAgrupacionWrap');
 const agrupacion=exercise=>(exercise.detalles||[]).find(x=>x.campo==='Agrupación')?.valor||'';
 mode?.addEventListener('change',()=>{
  wrap.hidden=!mode.checked;
  const current=group.value,values=[...new Set((window.GymExerciseLibrary||[]).map(agrupacion).filter(Boolean))].sort();
  group.replaceChildren(new Option('Seleccionar agrupación…',''));
  values.forEach(x=>group.add(new Option(x,x)));
  group.value=values.includes(current)?current:(values.length===1?values[0]:'');
  if(mode.checked)group.dispatchEvent(new Event('change'));
 });
 group?.addEventListener('change',()=>{
  if(!mode.checked)return;
  const selected=group.value;
  const names=[...new Set((window.GymExerciseLibrary||[])
   .filter(ex=>!selected||agrupacion(ex)===selected).map(ex=>ex.nombre))].sort();
  const exercise=el('ejercicio'),current=exercise.value;
  exercise.replaceChildren(new Option(names.length?'Seleccionar ejercicio…':'Agregar ejercicio',''));
  names.forEach(x=>exercise.add(new Option(x,x)));
  exercise.value=names.includes(current)?current:(names.length===1?names[0]:'');
 });
 // Prioridad al ejercicio, y solo después a sus otros campos.
 const exerciseField=el('ejercicio')?.closest('.field'),zoneField=el('zona')?.closest('.field');
 if(exerciseField&&zoneField&&zoneField.parentElement===exerciseField.parentElement)
  exerciseField.parentElement.insertBefore(exerciseField,zoneField);
 el('ejercicio')?.addEventListener('change',()=>{
  const exercise=(window.GymExerciseLibrary||[]).find(x=>x.nombre===el('ejercicio').value);
  if(!exercise)return;
  const get=label=>(exercise.detalles||[]).find(x=>x.campo===label)?.valor||'';
  for(const [id,val] of [['zona',get('Anotación')||exercise.zona_entrenamiento],
   ['instrumento',get('Instrumento')],['implemento',get('Agarre / Implemento')],
   ['tecnica',get('Técnica')||exercise.tecnica_actualizada]]){
   const field=el(id);if(val&&field&&[...field.options].some(x=>x.value===val))field.value=val;
  }
 });
})();
