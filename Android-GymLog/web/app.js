'use strict';
const KEY='gymlog_cloud_migracion';
let seriesMode='normal', seriesGroups=4, seriesCustomized=false;
const FLOW=[['g','gimnasio'],['s','sede'],['z','zona'],['kind','tipo'],['i','instrumento'],['a','implemento'],['gr','agarre'],['e','ejercicio'],['t','tecnica']];
const INITIAL={g:'Smart Fit',s:'La Rambla Brasil',z:'Espalda lateral',kind:'Máquina',i:'Máquina de polea alta',a:'Cable Pulldown',gr:'No especificado',e:'Jalón al pecho',t:'01 - Ejecución base'};
let model={records:[],photos:{}},toastTimer;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const makeId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2,9);
const uniq=arr=>[...new Set(arr)].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));
const dateNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmtDate=s=>s?.split('-').reverse().join('/')||'—';
function readStorage(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.records)&&d.photos&&typeof d.photos==='object')return d}catch{}return {records:[],photos:{}}}
function persist(){return true} // Fotos: vista previa en memoria; no se almacenan como datos de entrenamiento.
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400)}
function getValue(key){if(key==='kind')return document.querySelector('input[name="tipo"]:checked')?.value||'';return $(FLOW.find(x=>x[0]===key)[1]).value}
function fillSelect(id,choices,preferred){const el=$(id),old=el.value,selection=[preferred,old,choices[0]].find(v=>choices.includes(v))||'';el.replaceChildren();if(!choices.length){el.add(new Option('Sin opciones para esta selección',''));el.disabled=true;return}el.disabled=false;for(const value of choices)el.add(new Option(value,value));el.value=selection}
function fillTypes(choices,preferred){const valid=new Set(choices);const old=getValue('kind');const chosen=[preferred,old,'Máquina',...choices].find(v=>valid.has(v));document.querySelectorAll('input[name="tipo"]').forEach(r=>{r.disabled=!valid.has(r.value);r.checked=r.value===chosen})}
function allCatalog(){return [...(window.GymBaseCatalog||[]),...(window.GymCustomCatalog||[])].filter(r=>r.g&&r.s&&r.e)}
function cascade(start=0,preferred={}){
 const all=allCatalog(),ent=window.GymEntities||{gyms:[],sites:[],machines:[],options:[]},lib=window.GymExerciseLibrary||[];
 const extras=type=>(ent.options||[]).filter(x=>x.tipo===type).map(x=>x.nombre);
 let related=all;
 for(let n=0;n<FLOW.length;n++){
  const [key,id]=FLOW[n];
  const value=()=>getValue(key);
  let choices;
  if(key==='g')choices=uniq([...all.map(r=>r.g),...ent.gyms.map(g=>g.nombre)]);
  else if(key==='s'){
   const ownGym=ent.gyms.find(g=>g.nombre===getValue('g'));
   const ownSites=ent.sites.filter(site=>site.gimnasio_id===ownGym?.id).map(s=>s.nombre);
   choices=uniq([...related.map(r=>r.s),...ownSites,'No registrado']);
  }else if(key==='z')choices=uniq([...related.map(r=>r.z),...all.map(r=>r.z),...lib.map(r=>r.zona_entrenamiento),...extras('zona'),'Sin clasificar']);
  else if(key==='kind')choices=uniq([...related.map(r=>r.kind),...all.map(r=>r.kind),...ent.machines.map(m=>m.tipo_equipo)]);
  else if(key==='i')choices=uniq([...related.map(r=>r.i),
   ...all.filter(r=>r.kind===getValue('kind')).map(r=>r.i),
   ...ent.machines.filter(m=>m.tipo_equipo===getValue('kind')).map(m=>m.nombre)]);
  else if(key==='a'||key==='gr')choices=uniq([...related.map(r=>r[key]),...all.map(r=>r[key]),...extras(key==='a'?'accesorio':'agarre'),'No especificado']);
  else if(key==='e')choices=uniq([...related.map(r=>r.e),...all.map(r=>r.e),...lib.map(r=>r.nombre)]);
  else choices=uniq([...related.flatMap(r=>r.t||[]),
   ...all.filter(r=>r.e===getValue('e')).flatMap(r=>r.t||[]),
   ...lib.filter(r=>r.nombre===getValue('e')).map(r=>r.tecnica_actualizada),
   ...extras('tecnica'),'Ejecución base']);
  if(n>=start){
   if(key==='kind')fillTypes(choices,preferred[key]);
   else fillSelect(id,choices,preferred[key]);
  }
  const chosen=value();
  related=related.filter(r=>key==='t'?(r.t||[]).includes(chosen):r[key]===chosen);
 }
 updateDetailState();
}
function chosenRow(){
 const values=Object.fromEntries(FLOW.map(([key])=>[key,getValue(key)]));
 if(!values.g||!values.s||!values.i||!values.e||!values.t)return null;
 const matched=allCatalog().find(r=>FLOW.filter(x=>x[0]!=='t').every(([key])=>r[key]===values[key]));
 if(matched)return matched;
 const library=(window.GymExerciseLibrary||[]).find(e=>e.nombre===values.e);
 const sample=allCatalog().find(r=>r.e===values.e);
 return {
  g:values.g,s:values.s,z:values.z||'Sin clasificar',kind:values.kind||'Otro',
  i:values.i,a:values.a||'No especificado',gr:values.gr||'No especificado',e:values.e,
  t:[values.t],m:sample?.m||library?.musculos_principales?.join(', ')||'Pendiente de asignación',
  ms:sample?.ms||library?.musculos_secundarios?.join(', ')||'Pendiente de asignación',
  n:0,last:null
 };
}
function techniqueDescription(value){const t=(value||'').toLowerCase();if(t.includes('ejecución base'))return 'Ejecución de referencia documentada para este ejercicio y contexto.';if(t.includes('impulso')||t.includes('balanceo'))return 'Condición relacionada con el uso o control del impulso y del balanceo corporal durante la ejecución.';if(t.includes('sinergismo')||t.includes('compensación'))return 'Condición que describe cambios en la participación de músculos auxiliares o movimientos compensatorios.';if(t.includes('rom'))return 'Condición relacionada con la amplitud del rango de movimiento (ROM) y su control.';if(t.includes('control')||t.includes('estabilidad'))return 'Condición que describe un cambio en el control técnico o la estabilidad durante el movimiento.';if(t.includes('retroceso'))return 'Condición relacionada con el control de la fase de retorno del movimiento.';if(t.includes('lenta'))return 'Condición de ejecución con una duración más prolongada por repetición.';if(t.includes('desbalance'))return 'Condición donde se registra una pérdida o diferencia de estabilidad durante la ejecución.';return 'Denominación procedente del historial del ejercicio. Puedes precisar sus características en las observaciones.'}
function updateDetailState(){const r=chosenRow(),t=getValue('t');$('openDetail').disabled=!(r&&t);$('selected-summary').textContent=r?r.e:'Elige un ejercicio';$('tech-caption').textContent=r?`${t} · ${r.n} registros históricos en este contexto`:'La referencia se habilitará al completar la selección.'}
function picturePlaceholder(text){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 330"><rect width="450" height="330" fill="#f1f5fb"/><circle cx="225" cy="116" r="38" fill="#b7cce7"/><path d="M145 235q16-81 80-81t80 81" fill="none" stroke="#92b3dc" stroke-width="23" stroke-linecap="round"/><path d="M120 268h210" stroke="#d2e1f2" stroke-width="9" stroke-linecap="round"/><text x="225" y="310" text-anchor="middle" fill="#6f8bb0" font-size="17" font-family="Arial">${text}</text></svg>`)}
function photoFor(type,r){const key=type==='equipo'?`${r.g}|${r.s}|${r.i}`:`${r.g}|${r.s}|${r.i}|${r.e}`;if(model.photos[type+':'+key])return [model.photos[type+':'+key],true];if(type==='equipo'&&r.i==='Máquina de polea alta')return ['./assets/polea-alta.webp',true];if(type==='ejercicio'&&r.e==='Jalón al pecho')return ['./assets/jalon-pecho.webp',true];return [picturePlaceholder(type==='equipo'?'Equipo':'Ejercicio'),false]}
function detailOpen(){const r=chosenRow();if(!r||!getValue('t'))return;const tec=getValue('t');$('detailTitle').textContent=r.e;$('detailDesc').textContent=`${r.e} en ${r.i.toLowerCase()}, con trabajo orientado a ${r.z.toLowerCase()}. Accesorio/implemento: ${r.a}. Agarre: ${r.gr}. Esta ficha resume el contexto registrado; no sustituye instrucciones técnicas individuales.`;$('detailMainMuscle').textContent=r.m;$('detailOtherMuscle').textContent=r.ms;$('detailTechnique').textContent=`${tec}. ${techniqueDescription(tec)} (interpretación del nombre, no descripción clínica validada).`;$('detailHistory').textContent=`Historial de referencia: ${r.n} filas de entrenamiento en el Excel v2.5${r.last?' · Último registro: '+r.last[0]+' · '+r.last[1]+' (unidad de peso no indicada) · '+r.last[2]+' repeticiones':''}.`;
 for(const type of ['equipo','ejercicio']){const [src,hasPhoto]=photoFor(type,r);$(type==='equipo'?'detailEquipmentImg':'detailExerciseImg').src=src;$(type==='equipo'?'equipmentNoPhoto':'exerciseNoPhoto').hidden=hasPhoto}
 anatomyData=null;gymlyticsAnatomyView('frontal');$('detailModal').showModal();
 const token=++anatomyRequestId;
 const status=$('anatomyCloudState');if(status)status.textContent='Consultando relaciones musculares en Supabase…';
 window.GymCloud?.loadAnatomy?.(r)?.then(data=>{
  if(token!==anatomyRequestId)return;
  anatomyData=data;
  if(status)status.textContent=data.id?
   (data.primary.length+data.secondary.length?'Relaciones musculares vinculadas por ID.':'Ejercicio vinculado; asignación de músculos pendiente.'):
   'Ejercicio de referencia del Excel: pendiente de registro y vínculos anatómicos en Supabase.';
  const root=$('anatomy3dPlaceholder');
  root.querySelector('strong').textContent=data.zones3d.length?'Zonas 3D vinculadas':'Modelo 3D pendiente';
  root.querySelector('span').textContent=data.zones3d.length?
   data.zones3d.length+' zonas con ID encontradas. La visualización 3D interactiva se integrará después.':
   'La vista 3D está vinculada a tbl_musculo_zonas3d; aún no tiene modelos asociados.';
  for(const type of ['equipo','ejercicio']){
   const url=data.photos[(type==='equipo'?'maquina':'ejercicio')+':general'];
   if(url){const key=type==='equipo'?`${r.g}|${r.s}|${r.i}`:`${r.g}|${r.s}|${r.i}|${r.e}`;
    model.photos[type+':'+key]=url;detailOpenAfterUpload(type);}
  }
  gymlyticsAnatomyDraw();
 }).catch(e=>{if(token===anatomyRequestId&&status)status.textContent='No se pudo consultar Supabase: '+e.message;});}
function showPage(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='tablas')drawHistory();if(page==='dashboard')drawReports();window.scrollTo({top:0,behavior:'instant'})}
function setMobileStep(step){const target=step==='series'?'series':'context';$('page-registro').classList.toggle('step-context',target==='context');$('page-registro').classList.toggle('step-series',target==='series');document.querySelectorAll('[data-mobile-step]').forEach(b=>{const selected=b.dataset.mobileStep===target;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});window.scrollTo({top:0,behavior:'instant'});}

/* Pestañas de ejercicios independientes, como en un navegador. Los borradores
   se conservan en memoria hasta que el usuario los guarde en Supabase. */
let draftTabs=[],activeDraftId=null,draftSeq=0;
function snapshotExerciseRows(){return [...$('seriesRows').querySelectorAll('tr')].map(row=>({
 series:row.dataset.serie,sub:row.dataset.sub,unit:row.querySelector('select').value,
 weight:row.querySelector('.weight').value,reps:row.querySelector('.reps').value,help:row.querySelector('.help').value
}));}
function storeActiveDraft(){
 const tab=draftTabs.find(x=>x.id===activeDraftId);if(!tab)return;
 tab.values=Object.fromEntries(FLOW.map(([key])=>[key,getValue(key)]));
 tab.date=$('fecha').value;tab.notes=$('observaciones').value;
 tab.seriesMode=seriesMode;tab.seriesGroups=seriesGroups;tab.seriesCustomized=seriesCustomized;
 tab.rows=snapshotExerciseRows();
 tab.stage=$('page-registro').classList.contains('step-series')?'series':'context';
 tab.title=getValue('e')||tab.title;
}
function showDraftTabs(){
 $('exerciseTabs').innerHTML=draftTabs.map(tab=>`<span class="exercise-tab-item"><button type="button" role="tab" aria-selected="${tab.id===activeDraftId}" data-exercise-switch="${esc(tab.id)}" class="${tab.id===activeDraftId?'selected':''}" title="${esc(tab.title)}">${esc(tab.title)}</button>${draftTabs.length>1?`<button type="button" class="exercise-tab-close" aria-label="Cerrar ${esc(tab.title)}" data-exercise-close="${esc(tab.id)}">×</button>`:''}</span>`).join('');
}
function openDraft(id,saveCurrent=true){
 if(saveCurrent)storeActiveDraft();
 const tab=draftTabs.find(x=>x.id===id);if(!tab)return;
 activeDraftId=tab.id;
 cascade(0,tab.values);
 $('fecha').value=tab.date||dateNow();$('observaciones').value=tab.notes||'';
 seriesMode=tab.seriesMode;seriesGroups=tab.seriesGroups;seriesCustomized=tab.seriesCustomized;
 renderSeries();
 const rows=new Map((tab.rows||[]).map(x=>[x.series+'|'+x.sub,x]));
 for(const row of $('seriesRows').querySelectorAll('tr')){
  const v=rows.get(row.dataset.serie+'|'+row.dataset.sub);if(!v)continue;
  row.querySelector('select').value=v.unit;row.querySelector('.weight').value=v.weight;
  row.querySelector('.reps').value=v.reps;row.querySelector('.help').value=v.help;
 }
 updateSeriesCount();showDraftTabs();
 setMobileStep(tab.stage||'context');
}
function newDraft(saveCurrent=true){
 if(saveCurrent)storeActiveDraft();
 const first=allCatalog()[0], values=first?{g:first.g,s:first.s,z:first.z,kind:first.kind,i:first.i,a:first.a,gr:first.gr,e:first.e,t:first.t?.[0]}:{...INITIAL};
 const tab={id:'e'+(++draftSeq),title:'Ejercicio '+draftSeq,values,date:$('fecha').value||dateNow(),notes:'',seriesMode:'normal',seriesGroups:4,seriesCustomized:false,rows:[],stage:'context'};
 draftTabs.push(tab);openDraft(tab.id,false);
}
function closeDraft(id){
 const tab=draftTabs.find(t=>t.id===id);if(!tab||draftTabs.length<=1)return;
 if(id===activeDraftId)storeActiveDraft();
 if(tab.rows?.some(row=>row.weight||row.reps||row.help)&&!confirm('Este ejercicio tiene series sin guardar. ¿Cerrar su pestaña y descartarlas?'))return;
 const idx=draftTabs.indexOf(tab);draftTabs.splice(idx,1);
 if(id===activeDraftId)openDraft(draftTabs[Math.max(0,idx-1)].id,false);
 else showDraftTabs();
}
function refreshActiveDraftTitle(){const tab=draftTabs.find(t=>t.id===activeDraftId);if(!tab)return;tab.title=getValue('e')||tab.title;showDraftTabs();}
function resetExerciseTabs(){draftTabs=[];activeDraftId=null;draftSeq=0;newDraft(false);}
function hasSeriesData(){return getEntries().length>0}
function renderIndependentCatalog(){
 const entities=window.GymEntities||{gyms:[],sites:[],machines:[],options:[]};
 const el=$('siteGymSelect'),previous=el.value;
 el.replaceChildren();
 if(!entities.gyms.length){el.add(new Option('Primero registra un gimnasio',''));el.disabled=true;}
 else{
  el.disabled=false;
  for(const gym of entities.gyms)el.add(new Option(gym.nombre,gym.id));
  if(entities.gyms.some(g=>g.id===previous))el.value=previous;
 }
 const entries=$('customCatalogItems');
 entries.innerHTML=(entities.options||[]).length?
  '<div class="catalog-options-list">'+entities.options.map(x=>
   '<span class="catalog-option-pill"><strong>'+esc(({zona:'Zona',accesorio:'Accesorio',agarre:'Agarre',tecnica:'Técnica'})[x.tipo]||x.tipo)+'</strong> · '+esc(x.nombre)+'</span>'
  ).join('')+'</div>':'';
 if(window.GymBaseCatalog?.length||window.GymCustomCatalog?.length) cascade(0);
}
function renderOwnCatalog(){
 const list=document.getElementById('catalogEntries');if(!list)return;
 const records=[...(window.GymCustomCatalog||[]),...(window.GymExerciseLibrary||[]).map(r=>({e:r.nombre,g:'Catálogo personal',s:'Sin vincular',i:'Se vincula al entrenar'}))];
 list.innerHTML=records.length?records.map(r=>`<div class="catalog-row"><strong>${esc(r.e)}</strong><small>${esc(r.g)} · ${esc(r.s)} · ${esc(r.i)}</small></div>`).join(''):
 '<div class="empty">Todavía no hay ejercicios propios. Puedes crear el primero aquí.</div>';
}
function changeSeriesMode(mode){if(!['normal','sub','lateral'].includes(mode))return;if(mode!==seriesMode&&hasSeriesData()&&!confirm('Cambiar el tipo de subdivisión borrará los valores aún no guardados. ¿Continuar?'))return;seriesMode=mode;if(!seriesCustomized)seriesGroups=mode==='normal'?4:3;renderSeries();$('splitOptions').hidden=true;$('toggleSubdivisions').setAttribute('aria-expanded','false')}
function resizeSeries(delta){const next=Math.max(1,Math.min(12,seriesGroups+delta));if(next===seriesGroups)return;if(delta<0&&[...$('seriesRows').querySelectorAll('tr')].slice(-1*(seriesMode==='normal'?1:2)).some(row=>[...row.querySelectorAll('input')].some(i=>i.value.trim()))&&!confirm('La última serie tiene datos sin guardar. ¿Quitarla?'))return;seriesGroups=next;seriesCustomized=true;renderSeries(true)}
function renderSeries(preserve=false){const retained=preserve?new Map([...$('seriesRows').querySelectorAll('tr')].map(row=>[row.dataset.serie+'|'+row.dataset.sub,{unit:row.querySelector('select')?.value||'kg',weight:row.querySelector('.weight')?.value||'',reps:row.querySelector('.reps')?.value||'',help:row.querySelector('.help')?.value||''}])):new Map();const subs=seriesMode==='normal'?['-']:seriesMode==='sub'?['Sub1','Sub2']:['Derecha','Izquierda'];const rows=[];
 for(let n=1;n<=seriesGroups;n++){const label=`Serie ${n}`;subs.forEach((sub,index)=>{const v=retained.get(label+'|'+sub)||{};const tag=label+(sub==='-'?'':' · '+sub);rows.push(`<tr class="${index===0?'group-start ':''}" data-serie="${esc(label)}" data-sub="${esc(sub)}">${index===0?`<td class="series-name" rowspan="${subs.length}">${esc(label)}</td>`:''}${seriesMode!=='normal'?`<td class="division division-col">${esc(sub)}</td>`:''}<td class="unit-cell"><select aria-label="Unidad, ${esc(tag)}"><option${v.unit==='kg'||!v.unit?' selected':''}>kg</option><option${v.unit==='lb'?' selected':''}>lb</option></select></td><td class="number-cell"><input class="entry weight" type="number" min="0" step="any" inputmode="decimal" placeholder="—" value="${esc(v.weight||'')}" aria-label="Peso, ${esc(tag)}"></td><td class="number-cell"><input class="entry reps" type="number" min="0" step="1" inputmode="numeric" placeholder="—" value="${esc(v.reps||'')}" aria-label="Repeticiones, ${esc(tag)}"></td><td class="number-cell"><input class="entry help" type="number" min="0" step="1" inputmode="numeric" placeholder="—" value="${esc(v.help||'')}" aria-label="Asistencias, ${esc(tag)}"></td></tr>`)});}
 $('seriesRows').innerHTML=rows.join('');$('seriesGroupCount').textContent=seriesGroups===1?'1 serie':`${seriesGroups} series`;$('removeSeriesGroup').disabled=seriesGroups===1;$('addSeriesGroup').disabled=seriesGroups===12;$('seriesModeLabel').textContent=seriesMode==='normal'?`${seriesGroups} series normales · sin subdivisiones`:seriesMode==='sub'?`${seriesGroups} series · Sub1 y Sub2`:`${seriesGroups} series · Derecha e Izquierda`;$('toggleSubdivisions').textContent=seriesMode==='normal'?'⊞ Adicionar subdivisiones':'⇄ Cambiar subdivisiones';
 document.querySelector('.series-panel').classList.toggle('mode-normal',seriesMode==='normal');updateSeriesCount();}
function getEntries(){return [...$('seriesRows').querySelectorAll('tr')].map(row=>{const weight=row.querySelector('.weight').value.trim(),reps=row.querySelector('.reps').value.trim(),help=row.querySelector('.help').value.trim();return {el:row,series:row.dataset.serie,sub:row.dataset.sub,unit:row.querySelector('select').value,weight,reps,assistance:help,dirty:!!(weight||reps||help)}}).filter(x=>x.dirty)}
function updateSeriesCount(){const n=getEntries().length;$('seriesCount').textContent=n===1?'1 fila con datos':`${n} filas con datos`;$('saveSummary').textContent=n?`${n} fila${n!==1?'s':''} por validar y guardar.`:'Introduce al menos una fila con peso y repeticiones.';[...$('seriesRows').querySelectorAll('tr')].forEach(row=>row.classList.toggle('filled',[...row.querySelectorAll('input')].some(i=>i.value.trim())))}
async function saveSeries(){
 const r=chosenRow(),date=$('fecha').value,tech=getValue('t'),entries=getEntries();
 if(!r||!tech||!date||!entries.length){toast('Completa ejercicio, fecha y al menos una serie.');return}
 if(entries.some(x=>x.weight===''||x.reps===''||Number(x.weight)<0||Number(x.reps)<=0||Number(x.assistance||0)<0)){
  toast('Revisa peso, repeticiones y asistencias.');return;
 }
 if(!window.GymCloud?.canWrite()){toast('Inicia sesión para guardar en Supabase.');return}
 const savedDraftId=activeDraftId;
 const payload={exercise:r,date,technique:tech,notes:$('observaciones').value.trim(),entries};
 const rowSignature=()=>JSON.stringify({date:$('fecha').value,tech:getValue('t'),exercise:chosenRow()?.e,
   notes:$('observaciones').value.trim(),entries:getEntries().map(({el,...entry})=>entry)});
 const submittedSignature=rowSignature();
 const btn=$('saveRecords'),feedback=$('saveFeedback');feedback.hidden=true;feedback.textContent='';btn.disabled=true;btn.textContent='Guardando en Supabase…';
 try{
  await window.GymCloud.saveWorkout(payload);
 }catch(err){
  toast('No se guardó: '+String(err.message||err).slice(0,140));
  btn.disabled=false;btn.textContent='Guardar series';return;
 }
 // El guardado ya se confirmó: un error de lectura posterior no debe invitar a guardar de nuevo.
 const origin=draftTabs.find(tab=>tab.id===savedDraftId);
 if(activeDraftId===savedDraftId&&rowSignature()===submittedSignature){
  renderSeries();$('observaciones').value='';
 }else if(origin&&activeDraftId!==savedDraftId){
  origin.rows=[];origin.notes='';
 }else{
  feedback.textContent='✅ Series guardadas. Detectamos cambios durante el guardado; revisa las series que siguen visibles antes de guardar nuevamente.';
  feedback.hidden=false;
 }
 btn.textContent='Actualizando historial…';
 try{
  model.records=await window.GymCloud.loadHistory();
  drawRecent();drawHistory(true);drawReports();
  toast('Series guardadas en Supabase ✓');
 }catch(err){
  feedback.textContent='✅ Series guardadas en Supabase. No se pudo actualizar el historial: no vuelvas a guardar estas mismas series.';feedback.hidden=false;
  toast('Series GUARDADAS; no se pudo actualizar el historial. No las guardes otra vez.');
 }
 finally{btn.disabled=false;btn.textContent='Guardar series'}
}
function recordHtml(r){return `<div class="record-item"><div><strong>${esc(r.exercise)}</strong><p>${esc(fmtDate(r.date))} · ${esc(r.gym)} · ${esc(r.sede)}<br>${esc(r.series)}${r.subdivision!=='-'?' · '+esc(r.subdivision):''} · ${esc(r.technique)}${r.assistance!==null&&r.assistance!==undefined?' · Asist.: '+esc(r.assistance):''}</p></div><aside><strong>${esc(r.weight)} ${esc(r.unit)} × ${esc(r.reps)}</strong><small>repeticiones</small><div class="record-actions"><button type="button" data-delete="${esc(r.id)}" title="Eliminar serie">Eliminar</button></div></aside></div>`}
function orderedRecords(){return [...model.records].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''))}
function drawRecent(){const list=orderedRecords().slice(0,3);$('recentRecords').innerHTML=list.length?list.map(recordHtml).join(''):'<div class="empty">Aún no hay registros nuevos. Completa una fila y guárdala.</div>'}
let historyVisible=60;
function drawHistory(reset=false){
 if(reset)historyVisible=60;
 const q=$('historySearch').value.trim().toLocaleLowerCase();
 const list=orderedRecords().filter(r=>[r.gym,r.sede,r.zone,r.equipment,r.exercise,r.technique].join(' ').toLocaleLowerCase().includes(q));
 $('historyRecords').innerHTML=list.length?list.slice(0,historyVisible).map(recordHtml).join(''):'<div class="empty">No se encontraron series registradas.</div>';
 $('historyPagination').hidden=list.length<=historyVisible;
 $('historyPageInfo').textContent='Mostrando '+Math.min(historyVisible,list.length).toLocaleString('es-PE')+' de '+list.length.toLocaleString('es-PE')+' series';
}
async function deleteRecord(id){
 if(!window.GymCloud?.canWrite())return;
 const row=model.records.find(x=>x.id===id);if(!row||!confirm(`¿Eliminar ${row.series} de ${row.exercise}?`))return;
 try{await window.GymCloud.deleteSeries(id)}
 catch(err){toast('No se pudo eliminar: '+String(err.message||err).slice(0,90));return}
 model.records=model.records.filter(x=>x.id!==id);
 drawRecent();drawHistory();drawReports();
 try{
  model.records=await window.GymCloud.loadHistory();
  drawRecent();drawHistory();drawReports();
  toast('Serie eliminada de Supabase');
 }catch(err){toast('Serie ELIMINADA; no se pudo actualizar el historial.');}
}
function drawReports(){const rows=model.records,days=new Set(rows.map(r=>r.date)).size,vol=rows.reduce((v,r)=>v+r.weight*(r.unit==='lb'?0.45359237:1)*r.reps,0);$('reportStats').innerHTML=`<div class="stat"><strong>${rows.length}</strong><small>Series guardadas</small></div><div class="stat"><strong>${days}</strong><small>Días con registros</small></div><div class="stat"><strong>${Math.round(vol).toLocaleString('es-PE')}</strong><small>Volumen en kg</small></div>`;const counts={};rows.forEach(r=>counts[r.exercise]=(counts[r.exercise]||0)+1);$('frequentExercises').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,n])=>`<div class="freq"><span>${esc(name)}</span><strong>${n}</strong></div>`).join('')||'<div class="empty">Sin ejercicios todavía.</div>';}
function download(name,content,mime){const blob=new Blob([content],{type:mime}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportCsv(){const fields=[['date','Fecha'],['gym','Gimnasio'],['sede','Sede'],['zone','Zona de entrenamiento'],['type','Tipo de equipo'],['equipment','Máquina / equipo'],['accessory','Accesorio / implemento'],['grip','Agarre'],['exercise','Ejercicio'],['technique','Técnica de ejecución'],['series','Número de serie'],['subdivision','Subdivisión'],['unit','Unidad'],['weight','Peso'],['reps','Repeticiones'],['assistance','Asistencias'],['notes','Observaciones']];const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"',lines=[fields.map(x=>quote(x[1])),...orderedRecords().map(r=>fields.map(([k])=>quote(r[k])))].map(x=>x.join(';'));download('GymLog_series_'+dateNow()+'.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');toast('CSV exportado')}
function exportJson(){download('Gymlytics_respaldo_'+dateNow()+'.json',JSON.stringify({version:2,...model},null,2),'application/json');toast('Copia de seguridad exportada')}
async function importJson(event){const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.records)||!parsed.photos||typeof parsed.photos!=='object')throw Error('Incompatible');if(!confirm(`¿Reemplazar los ${model.records.length} registros locales con ${parsed.records.length} registros del archivo?`))return;const previous=model;model={records:parsed.records,photos:parsed.photos};if(!persist()){model=previous;return}drawRecent();drawHistory();toast('Copia de seguridad restaurada')}catch(e){toast('No se pudo importar. Comprueba el JSON.')}finally{event.target.value=''}}
async function uploadPhoto(event){
 const file=event.target.files?.[0],type=event.target.dataset.upload,r=chosenRow();
 if(!r||!file)return;
 if(!file.type.startsWith('image/')){toast('Selecciona una imagen válida');return;}
 const key=type==='equipo'?`${r.g}|${r.s}|${r.i}`:`${r.g}|${r.s}|${r.i}|${r.e}`;
 try{
  const canvas=await photoCanvas(file,820);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));
  if(!blob)throw Error('No se pudo procesar la fotografía');
  const url=canvas.toDataURL('image/jpeg',.78);
  if(!window.GymCloud?.canWrite())throw Error('Inicia sesión para subir fotos');
  await window.GymCloud.uploadUserPhoto({exercise:r,technique:getValue('t'),
   type:type==='equipo'?'maquina':'ejercicio',side:null,blob});
  model.photos[type+':'+key]=url;
  detailOpenAfterUpload(type);
  toast('Fotografía guardada en Supabase ✓');
 }catch(error){toast('Error de fotografía: '+error.message.slice(0,110));}
 finally{event.target.value='';}
}
function photoCanvas(file,maxSize){
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   const scale=Math.min(1,maxSize/Math.max(img.width,img.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.width*scale));
   canvas.height=Math.max(1,Math.round(img.height*scale));
   canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   URL.revokeObjectURL(url);resolve(canvas);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Imagen ilegible'));};img.src=url;
 });
}

function detailOpenAfterUpload(type){const r=chosenRow(),[src,available]=photoFor(type,r);$(type==='equipo'?'detailEquipmentImg':'detailExerciseImg').src=src;$(type==='equipo'?'equipmentNoPhoto':'exerciseNoPhoto').hidden=available}
function install(){$('addExerciseTab').addEventListener('click',()=>newDraft());$('exerciseTabs').addEventListener('click',event=>{const closed=event.target.closest('[data-exercise-close]'),switched=event.target.closest('[data-exercise-switch]');if(closed)closeDraft(closed.dataset.exerciseClose);else if(switched&&switched.dataset.exerciseSwitch!==activeDraftId)openDraft(switched.dataset.exerciseSwitch);});for(let i=0;i<FLOW.length;i++){const [key,id]=FLOW[i];if(key==='kind'){document.querySelectorAll('input[name="tipo"]').forEach(input=>input.addEventListener('change',()=>{cascade(i+1);refreshActiveDraftTitle();}))}else $(id).addEventListener('change',()=>{cascade(i+1);refreshActiveDraftTitle();})}document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('click',()=>showPage(x.dataset.page)));$('openDetail').addEventListener('click',detailOpen);$('closeDetail').addEventListener('click',()=>$('detailModal').close());$('closeDetailBottom').addEventListener('click',()=>$('detailModal').close());document.querySelectorAll('[data-upload]').forEach(x=>x.addEventListener('change',uploadPhoto));$('seriesRows').addEventListener('input',updateSeriesCount);document.querySelectorAll('[data-mobile-step]').forEach(b=>b.addEventListener('click',()=>setMobileStep(b.dataset.mobileStep)));$('continueToSeries').addEventListener('click',()=>setMobileStep('series'));$('backToContext').addEventListener('click',()=>setMobileStep('context'));$('toggleSubdivisions').addEventListener('click',()=>{const open=$('splitOptions').hidden;$('splitOptions').hidden=!open;$('toggleSubdivisions').setAttribute('aria-expanded',String(open))});document.querySelectorAll('[data-series-mode]').forEach(b=>b.addEventListener('click',()=>changeSeriesMode(b.dataset.seriesMode)));$('addSeriesGroup').addEventListener('click',()=>resizeSeries(1));$('removeSeriesGroup').addEventListener('click',()=>resizeSeries(-1));$('saveRecords').addEventListener('click',saveSeries);$('clearSeries').addEventListener('click',()=>{renderSeries();toast('Tabla vaciada')});$('historySearch').addEventListener('input',()=>drawHistory(true));$('historyLoadMore').addEventListener('click',()=>{historyVisible+=60;drawHistory()});$('exportCsv').addEventListener('click',exportCsv);$('exportJson').addEventListener('click',exportJson);document.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(b)deleteRecord(b.dataset.delete)})}
$('fecha').value=dateNow();renderSeries();cascade(0,INITIAL);resetExerciseTabs();install();drawRecent();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});


// Vista anatómica 2D; visor 3D reservado hasta conectar un modelo real.
let gymlyticsAnatomySide='frontal';
let anatomyData=null,anatomyRequestId=0;
function gymlyticsAnatomyDraw(){
 const r=chosenRow();if(!r)return;
 $('anatomyPrimary').textContent=anatomyData?.primary.length?anatomyData.primary.join(', '):(r.m||'Pendiente');$('anatomySecondary').textContent=anatomyData?.secondary.length?anatomyData.secondary.join(', '):(r.ms||'Pendiente');
 document.querySelectorAll('[data-anatomy-side]').forEach(b=>{let on=b.dataset.anatomySide===gymlyticsAnatomySide;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 const key='anatomia:'+gymlyticsAnatomySide+':'+r.e;
 const src=model.photos[key]||anatomyData?.photos['musculos:'+gymlyticsAnatomySide]||anatomyData?.images[gymlyticsAnatomySide];$('anatomyPhoto').hidden=!src;$('anatomyPhoto').removeAttribute('src');if(src)$('anatomyPhoto').src=src;
 $('anatomyEmpty').hidden=Boolean(src);
}
function gymlyticsAnatomyView(side){gymlyticsAnatomySide=side;gymlyticsAnatomyDraw()}
async function gymlyticsAnatomyUpload(event){
 const file=event.target.files?.[0],r=chosenRow(),side=gymlyticsAnatomySide;
 if(!file||!r)return;
 if(!file.type.startsWith('image/')){toast('Selecciona una imagen válida');return;}
 try{
  const canvas=await photoCanvas(file,750);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));
  if(!blob)throw Error('No se pudo procesar la imagen');
  if(!window.GymCloud?.canWrite())throw Error('Inicia sesión para subir fotografías');
  await window.GymCloud.uploadUserPhoto({exercise:r,technique:getValue('t'),type:'musculos',side,blob});
  model.photos['anatomia:'+side+':'+r.e]=canvas.toDataURL('image/jpeg',.78);
  gymlyticsAnatomyDraw();toast('Foto anatómica guardada en Supabase ✓');
 }catch(error){toast('Error al guardar foto: '+error.message.slice(0,110));}
 finally{event.target.value='';}
}

document.querySelectorAll('[data-anatomy-side]').forEach(b=>b.addEventListener('click',()=>gymlyticsAnatomyView(b.dataset.anatomySide)));
$('anatomyUpload').addEventListener('change',gymlyticsAnatomyUpload);

// 2D / 3D always visible. 3D data source: tbl_musculo_zonas3d (empty until uploaded).
let currentAnatomyTab='photos';
function anatomySetTab(tab){
 currentAnatomyTab=tab;
 $('anatomyPhotosTab').classList.toggle('selected',tab==='photos');
 $('anatomy3dTab').classList.toggle('selected',tab==='3d');
 $('anatomyPhotosTab').setAttribute('aria-selected',String(tab==='photos'));
 $('anatomy3dTab').setAttribute('aria-selected',String(tab==='3d'));
 document.querySelector('.anatomy-options').hidden=tab==='3d';
 const frame=$('anatomyPhoto').parentElement;frame.hidden=tab==='3d';
 $('anatomy3dPlaceholder').hidden=tab!=='3d';
 document.querySelector('.anatomy-photo-button').hidden=tab==='3d';
}
$('anatomyPhotosTab').addEventListener('click',()=>anatomySetTab('photos'));
$('anatomy3dTab').addEventListener('click',()=>anatomySetTab('3d'));
$('openDetail').addEventListener('click',()=>anatomySetTab('photos'));
