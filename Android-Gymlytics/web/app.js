'use strict';
const KEY='gymlog_cloud_migracion';
let seriesMode='normal', seriesGroups=4, seriesCustomized=false;
const FLOW=[['g','gimnasio'],['s','sede'],['z','zona'],['kind','tipo'],['i','instrumento'],['a','implemento'],['gr','agarre'],['e','ejercicio'],['t','tecnica']];
const INITIAL={g:'Smart Fit',s:'La Rambla Brasil',z:'Espalda lateral',kind:'Máquina',i:'Máquina de polea alta',a:'Cable Pulldown',gr:'No especificado',e:'Jalón al pecho',t:'01 - Ejecución base'};
let model={records:[],photos:{}},toastTimer;
let historyReady=false;
const $=id=>document.getElementById(id);
function showHistoryLoadProgress(loaded,total){
 const section=$('historyLoadingStatus');
 if(!section)return;
 if(loaded===null){section.hidden=true;return;}
 section.hidden=false;
 const bar=$('historyLoadingBar'),label=$('historyLoadingText'),percent=$('historyLoadingPercent');
 if(!Number.isSafeInteger(total)||total<0){
  label.textContent='Consultando el total de series en Supabase…';
  percent.textContent='';
  bar.removeAttribute('value');
  return;
 }
 const received=Math.max(0,Math.min(total,Number(loaded)||0));
 const progress=total===0?100:Math.round(received/total*100);
 bar.max=Math.max(1,total);bar.value=total?received:1;
 label.textContent=total===0?'Historial vacío, descarga completa.':received.toLocaleString('es-PE')+' de '+total.toLocaleString('es-PE')+' series recibidas';
 percent.textContent=progress+'%';
}
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
 const sessionStamp=window.GymCloud?.getSessionStamp?.();
 const current=()=>token===anatomyRequestId&&sessionStamp===window.GymCloud?.getSessionStamp?.()&&!!window.GymCloud?.canWrite();
 const status=$('anatomyCloudState');if(status)status.textContent='Consultando relaciones musculares en Supabase…';
 window.GymCloud?.loadAnatomy?.(r)?.then(data=>{
  if(!current())return;
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
 }).catch(e=>{if(current()&&status)status.textContent='No se pudo consultar Supabase: '+e.message;});}
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
/* Una sola tarjeta por catálogo: selector y total visibles, edición y alta desplegables. */
function setupCatalogCompact(){
 const holder=document.querySelector('.catalog-independent');
 if(!holder||holder.dataset.compactReady)return;
 holder.dataset.compactReady='1';
 const defs=[
  {id:'addGymForm',select:'gymExistingSelect',total:'gymCount',label:'Gimnasios',symbol:'▣'},
  {id:'addSiteForm',select:'siteExistingSelect',total:'siteCount',label:'Sedes',symbol:'⌖'},
  {id:'addMachineForm',select:'machineExistingSelect',total:'machineCount',label:'Instrumento',symbol:'⚙'}
 ];
 function makeCard(label,symbol,select,total,contents,insertAt){
  const card=document.createElement('section');card.className='catalog-compact-card';
  const bar=document.createElement('div');bar.className='catalog-compact-bar';
  const heading=document.createElement('strong');heading.className='catalog-compact-label';
  const glyph=document.createElement('span');glyph.className='catalog-compact-symbol';glyph.textContent=symbol;
  const name=document.createElement('span');name.textContent=label;heading.append(glyph,name);
  const picker=select?.closest('label')||null;
  if(picker){picker.classList.add('catalog-compact-picker');bar.append(heading,picker)}
  else bar.append(heading);
  const count=total||document.createElement('span');count.classList.add('catalog-total');bar.append(count);
  const add=document.createElement('button');add.type='button';add.className='catalog-compact-toggle';add.textContent='＋';add.setAttribute('aria-label','Agregar o modificar '+label);
  const detail=document.createElement('div');detail.className='catalog-compact-detail';detail.hidden=true;detail.id='catalogManage'+label.replace(/[^a-z]/gi,'');
  add.setAttribute('aria-controls',detail.id);add.setAttribute('aria-expanded','false');
  add.addEventListener('click',()=>{detail.hidden=!detail.hidden;add.setAttribute('aria-expanded',String(!detail.hidden));add.textContent=detail.hidden?'＋':'−';if(!detail.hidden)detail.querySelector('input:not([type=hidden])')?.focus()});
  bar.append(add);card.append(bar,detail);
  for(const item of contents)if(item)detail.append(item);
  insertAt.append(card);
  return card;
 }
 for(const d of defs){
  const form=$(d.id),select=$(d.select),count=$(d.total),heading=form?.querySelector('h3');
  if(!form||!select||!count)continue;
  heading?.remove();
  makeCard(d.label,d.symbol,select,count,[form],holder);
 }
 const optionForm=$('addOptionForm');
 if(optionForm){
  optionForm.querySelector('h3')?.remove();
  const advanced=makeCard('Editar listas','≡',$('optionExistingSelect'),$('optionCount'),[optionForm],holder);
  advanced.classList.add('catalog-advanced-options');advanced.hidden=true;advanced.id='catalogAdvancedOptions';
  for(const item of [
   {id:'zone',name:'AnotaciónV2',type:'zona',icon:'▤'},
   {id:'grip',name:'Agarre / Implemento',type:'agarre',icon:'✋'},
   {id:'technique',name:'Tecnica_Actualizada',type:'tecnica',icon:'▣'}
  ]){
   const row=document.createElement('section');row.className='catalog-compact-card';
   const bar=document.createElement('div');bar.className='catalog-compact-bar';
   const name=document.createElement('strong');name.className='catalog-compact-label';
   name.innerHTML='<span class="catalog-compact-symbol">'+item.icon+'</span><span>'+item.name+'</span>';
   const select=document.createElement('select');select.id='catalogShortcut'+item.id;
   select.className='catalog-muscle-select';select.setAttribute('aria-label','Valores existentes de '+item.name);
   const badge=document.createElement('span');badge.id='catalogShortcutCount'+item.id;badge.className='catalog-total';badge.textContent='0';
   const add=document.createElement('button');add.type='button';add.className='catalog-compact-toggle';add.textContent='＋';add.setAttribute('aria-label','Agregar o modificar '+item.name);
   const open=(value='')=>{
    const type=optionForm.querySelector('[name="tipo"]');const selected=(window.GymEntities?.options||[]).find(x=>x.tipo+'|'+x.id===value);
    type.value=selected?.tipo||item.type;
    if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
    const active=$('optionExistingSelect');active.value=selected?.id||'';
    $('optionEditName').value=selected?.nombre||'';
    advanced.hidden=false;const toggle=advanced.querySelector('.catalog-compact-toggle');
    if(advanced.querySelector('.catalog-compact-detail').hidden)toggle.click();
    advanced.scrollIntoView?.({block:'nearest',behavior:'smooth'});
   };
   select.addEventListener('change',()=>{if(select.value)open(select.value)});
   add.addEventListener('click',()=>open(select.value));
   bar.append(name,select,badge,add);row.append(bar);holder.insertBefore(row,advanced);
  }
 }
 const exercise=$('catalogForm'),exerciseSel=$('exerciseExistingSelect'),exerciseCount=$('exerciseCount');
 if(exercise&&exerciseSel&&exerciseCount){
  const editing=document.querySelector('.catalog-exercise-selector');
  document.querySelector('.catalog-create>h3')?.remove();
  makeCard('Ejercicios','▣',exerciseSel,exerciseCount,[editing,exercise,$('catalogEntries')],holder);
 }
 const muscle=document.querySelector('.catalog-muscles');
 if(muscle){
  const select=$('muscleExistingSelect'),count=$('muscleCount'),head=muscle.querySelector('h3');
  const card=document.createElement('section');card.className='catalog-compact-card catalog-compact-readonly';
  const bar=document.createElement('div');bar.className='catalog-compact-bar';
  bar.innerHTML='<strong class="catalog-compact-label"><span class="catalog-compact-symbol">◈</span><span>Músculos</span></strong>';
  const label=select?.previousElementSibling;if(label)label.remove();
  if(select){select.classList.add('catalog-muscle-select');bar.append(select)}
  if(count)bar.append(count);
  const note=document.createElement('span');note.className='catalog-readonly-note';note.textContent='Consulta';
  bar.append(note);card.append(bar);muscle.replaceWith(card);head?.remove();
 }
}
function renderCatalogShortcuts(){
 const options=window.GymEntities?.options||[];
 for(const [kind,types] of [
  ['zone',['zona']],['grip',['agarre','accesorio']],['technique',['tecnica']]
 ]){
  const select=$('catalogShortcut'+kind),badge=$('catalogShortcutCount'+kind);
  if(!select||!badge)continue;
  const values=options.filter(x=>types.includes(x.tipo));
  const old=select.value;
  select.replaceChildren(new Option('Selecciona un elemento…',''));
  for(const x of values)select.add(new Option((types.length>1?x.tipo==='agarre'?'Agarre: ':'Implemento: ':'')+x.nombre,x.tipo+'|'+x.id));
  select.value=values.some(x=>x.tipo+'|'+x.id===old)?old:'';
  badge.textContent=String(values.length);
 }
}
function renderSeriesCatalogShortcuts(){
 for(const [id,key] of [['catalogSeriesLookup','series'],['catalogSubdivisionLookup','subdivision']]){
  const select=$(id),badge=$(id+'Count');
  if(!select||!badge)continue;
  const vals=uniq((model.records||[]).map(r=>key==='subdivision'?historyFieldValue(r,key):String(r[key]||'')).filter(Boolean));
  const old=select.value;select.replaceChildren(new Option('Valores registrados…',''));
  for(const val of vals)select.add(new Option(val,val));
  select.value=vals.includes(old)?old:'';
  badge.textContent=String(vals.length);
 }
}
function populateCatalogSelect(selectId,items,labelFn){
 const select=$(selectId);if(!select)return;
 const selected=select.value;
 select.replaceChildren(new Option('Selecciona un elemento…',''));
 for(const item of items)select.add(new Option(labelFn(item),item.id));
 select.value=items.some(x=>x.id===selected)?selected:'';
 const inputId=selectId.replace('ExistingSelect','EditName');
 const input=$(inputId);
 if(input)input.value=items.find(x=>x.id===select.value)?.nombre||'';
}
function existingCatalogItems(kind){
 const ent=window.GymEntities||{gyms:[],sites:[],machines:[],options:[]};
 if(kind==='gym')return ent.gyms||[];
 if(kind==='site')return ent.sites||[];
 if(kind==='machine')return ent.machines||[];
 if(kind==='option')return (ent.options||[]).filter(x=>x.tipo===document.querySelector('#addOptionForm [name="tipo"]')?.value);
 if(kind==='exercise')return [...(window.GymExerciseLibrary||[]).map(x=>({id:x.id,nombre:x.nombre})),...(window.GymCustomCatalog||[]).filter(x=>x.cloud_id).map(x=>({id:x.cloud_id,nombre:x.e}))];
 return [];
}
function renderIndependentCatalog(){
 const ent=window.GymEntities||{gyms:[],sites:[],machines:[],options:[]};
 const el=$('siteGymSelect'),previous=el.value;
 el.replaceChildren();
 if(!ent.gyms.length){el.add(new Option('Primero registra un gimnasio',''));el.disabled=true;}
 else{
  el.disabled=false;
  for(const gym of ent.gyms)el.add(new Option(gym.nombre,gym.id));
  if(ent.gyms.some(g=>g.id===previous))el.value=previous;
 }
 const gymById=new Map((ent.gyms||[]).map(x=>[x.id,x.nombre]));
 populateCatalogSelect('gymExistingSelect',ent.gyms||[],x=>x.nombre);
 populateCatalogSelect('siteExistingSelect',ent.sites||[],x=>x.nombre+' · '+(gymById.get(x.gimnasio_id)||'Sin gimnasio'));
 populateCatalogSelect('machineExistingSelect',ent.machines||[],x=>x.nombre+' · '+(x.tipo_equipo||'Equipo'));
 const values=existingCatalogItems('option');
 populateCatalogSelect('optionExistingSelect',values,x=>x.nombre);
 for(const [id,count] of [['siteCount',ent.sites.length],['machineCount',ent.machines.length]])
  if($(id))$(id).textContent=String(count);
 if($('optionCount'))$('optionCount').textContent=values.length+' / '+ent.options.length+' total';
 if($('customCatalogItems'))$('customCatalogItems').innerHTML='';
 renderCatalogShortcuts();
 if(window.GymBaseCatalog?.length||window.GymCustomCatalog?.length)cascade(0);
}
function renderOwnCatalog(){
 const records=existingCatalogItems('exercise');
 populateCatalogSelect('exerciseExistingSelect',records,x=>x.nombre);
 const entries=$('catalogEntries');
 if(entries)entries.innerHTML=records.length?'':'<div class="empty">Aún no hay ejercicios propios. Puedes agregar el primero aquí.</div>';
}

function changeSeriesMode(mode){if(!['normal','sub','lateral'].includes(mode))return;if(mode!==seriesMode&&hasSeriesData()&&!confirm('Cambiar el tipo de subdivisión borrará los valores aún no guardados. ¿Continuar?'))return;seriesMode=mode;if(!seriesCustomized)seriesGroups=mode==='normal'?4:3;renderSeries();$('splitOptions').hidden=true;$('toggleSubdivisions').setAttribute('aria-expanded','false');$('resetSubdivisions').hidden=mode==='normal'}
function resizeSeries(delta){const next=Math.max(1,Math.min(12,seriesGroups+delta));if(next===seriesGroups)return;if(delta<0&&[...$('seriesRows').querySelectorAll('tr')].slice(-1*(seriesMode==='normal'?1:2)).some(row=>[...row.querySelectorAll('input')].some(i=>i.value.trim()))&&!confirm('La última serie tiene datos sin guardar. ¿Quitarla?'))return;seriesGroups=next;seriesCustomized=true;renderSeries(true)}
function renderSeries(preserve=false){const retained=preserve?new Map([...$('seriesRows').querySelectorAll('tr')].map(row=>[row.dataset.serie+'|'+row.dataset.sub,{unit:row.querySelector('select')?.value||'kg',weight:row.querySelector('.weight')?.value||'',reps:row.querySelector('.reps')?.value||'',help:row.querySelector('.help')?.value||''}])):new Map();const subs=seriesMode==='normal'?['-']:seriesMode==='sub'?['Sub1','Sub2']:['Derecha','Izquierda'];const rows=[];
 for(let n=1;n<=seriesGroups;n++){const label=`Serie ${n}`;subs.forEach((sub,index)=>{const v=retained.get(label+'|'+sub)||{};const tag=label+(sub==='-'?'':' · '+sub);rows.push(`<tr class="${index===0?'group-start ':''}" data-serie="${esc(label)}" data-sub="${esc(sub)}">${index===0?`<td class="series-name" rowspan="${subs.length}">${esc(label)}</td>`:''}${seriesMode!=='normal'?`<td class="division division-col">${esc(sub)}</td>`:''}<td class="unit-cell"><select aria-label="Unidad, ${esc(tag)}"><option${v.unit==='kg'||!v.unit?' selected':''}>kg</option><option${v.unit==='lb'?' selected':''}>lb</option></select></td><td class="number-cell"><input class="entry weight" type="number" min="0" step="any" inputmode="decimal" placeholder="—" value="${esc(v.weight||'')}" aria-label="Peso, ${esc(tag)}"></td><td class="number-cell"><input class="entry reps" type="number" min="0" step="any" inputmode="decimal" placeholder="—" value="${esc(v.reps||'')}" aria-label="Repeticiones, ${esc(tag)}"></td><td class="number-cell"><input class="entry help" type="number" min="0" step="any" inputmode="decimal" placeholder="—" value="${esc(v.help||'')}" aria-label="Asistencias, ${esc(tag)}"></td></tr>`)});}
 $('seriesRows').innerHTML=rows.join('');$('seriesGroupCount').textContent=seriesGroups===1?'1 serie':`${seriesGroups} series`;$('removeSeriesGroup').disabled=seriesGroups===1;$('addSeriesGroup').disabled=seriesGroups===12;$('seriesModeLabel').textContent=seriesMode==='normal'?`${seriesGroups} series normales · sin subdivisiones`:seriesMode==='sub'?`${seriesGroups} series · Sub1 y Sub2`:`${seriesGroups} series · Derecha e Izquierda`;$('toggleSubdivisions').textContent=seriesMode==='normal'?'⊞ Adicionar subdivisiones':'⇄ Cambiar subdivisiones';
 document.querySelector('.series-panel').classList.toggle('mode-normal',seriesMode==='normal');$('resetSubdivisions').hidden=seriesMode==='normal';updateSeriesCount();}
function getEntries(){return [...$('seriesRows').querySelectorAll('tr')].map(row=>{const weight=row.querySelector('.weight').value.trim(),reps=row.querySelector('.reps').value.trim(),help=row.querySelector('.help').value.trim();return {el:row,series:row.dataset.serie,sub:row.dataset.sub,unit:row.querySelector('select').value,weight,reps,assistance:help,dirty:!!(weight||reps||help)}}).filter(x=>x.dirty)}
function validSeriesDecimal(value,limit){
 const s=String(value).trim();
 return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(s)&&Number(s)<limit;
}
function validSeriesEntry(x){
 return validSeriesDecimal(x.weight,1e10)&&validSeriesDecimal(x.reps,1e8)&&Number(x.reps)>0
  &&validSeriesDecimal(x.assistance||'0',1e8)&&['kg','lb'].includes(x.unit);
}
function updateSeriesCount(){const n=getEntries().length;$('seriesCount').textContent=n===1?'1 fila con datos':`${n} filas con datos`;$('saveSummary').textContent=n?`${n} fila${n!==1?'s':''} por validar y guardar.`:'Introduce al menos una fila con peso y repeticiones.';[...$('seriesRows').querySelectorAll('tr')].forEach(row=>row.classList.toggle('filled',[...row.querySelectorAll('input')].some(i=>i.value.trim())))}
function invalidatePendingSave(){
 window.GymSaveAttempt=(window.GymSaveAttempt||0)+1;
 const button=$('saveRecords'),feedback=$('saveFeedback');
 if(button){button.disabled=false;button.textContent='Guardar series';}
 if(feedback){feedback.hidden=true;feedback.textContent='';}
}
async function saveSeries(){
 const r=chosenRow(),date=$('fecha').value,tech=getValue('t'),entries=getEntries();
 if(!r||!tech||!date||!entries.length){toast('Completa ejercicio, fecha y al menos una serie.');return}
 if(entries.some(x=>!validSeriesEntry(x))){
  toast('Revisa peso, repeticiones y asistencias.');return;
 }
 if(!window.GymCloud?.canWrite()){toast('Inicia sesión para guardar en Supabase.');return}
 const savedDraftId=activeDraftId;
 const requestId=(window.GymSaveAttempt||0)+1;
 window.GymSaveAttempt=requestId;
 const sessionStamp=window.GymCloud.getSessionStamp?.();
 const current=()=>requestId===window.GymSaveAttempt&&
  sessionStamp===window.GymCloud.getSessionStamp?.();
 const payload={exercise:r,date,technique:tech,notes:$('observaciones').value.trim(),entries};
 const rowSignature=()=>JSON.stringify({date:$('fecha').value,tech:getValue('t'),exercise:chosenRow()?.e,
   notes:$('observaciones').value.trim(),entries:getEntries().map(({el,...entry})=>entry)});
 const submittedSignature=rowSignature();
 const btn=$('saveRecords'),feedback=$('saveFeedback');feedback.hidden=true;feedback.textContent='';btn.disabled=true;btn.textContent='Guardando en Supabase…';
 try{
  await window.GymCloud.saveWorkout(payload);
 }catch(err){
  if(!current())return;
  toast('No se guardó: '+String(err.message||err).slice(0,140));
  btn.disabled=false;btn.textContent='Guardar series';return;
 }
 if(!current())return; // No alterar la vista tras cambiar de sesión.
 // El guardado ya se confirmó: un error de lectura posterior no debe invitar a guardar de nuevo.
 setHistoryReady(false);
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
  const latest=await window.GymCloud.loadHistory();
  if(!current())return;
  model.records=latest;drawRecent();drawHistory(true);drawReports();
  setHistoryReady(true);
  toast('Series guardadas en Supabase ✓');
 }catch(err){
  if(!current())return;
  feedback.textContent='✅ Series guardadas en Supabase. No se pudo actualizar el historial: no vuelvas a guardar estas mismas series.';feedback.hidden=false;
  toast('Series GUARDADAS; no se pudo actualizar el historial. No las guardes otra vez.');
 }
 finally{if(current()){btn.disabled=false;btn.textContent='Guardar series'}}
}
function recordHtml(r){return `<div class="record-item"><div><strong>${esc(r.exercise)}</strong><p>${esc(fmtDate(r.date))} · ${esc(r.gym)} · ${esc(r.sede)}<br>${esc(r.series)}${r.subdivision!=='-'?' · '+esc(r.subdivision):''} · ${esc(r.technique)}${r.assistance!==null&&r.assistance!==undefined?' · Asist.: '+esc(r.assistance):''}</p></div><aside><strong>${esc(r.weight)} ${esc(r.unit)} × ${esc(r.reps)}</strong><small>repeticiones</small><div class="record-actions"><button type="button" data-delete="${esc(r.id)}" title="Eliminar serie">Eliminar</button><button type="button" data-progress="${esc(r.exercise)}" title="Mostrar evolución de este ejercicio">Ver progreso</button></div></aside></div>`}
function orderedRecords(){return [...model.records].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''))}
function drawRecent(){const list=orderedRecords().slice(0,3);$('recentRecords').innerHTML=list.length?list.map(recordHtml).join(''):'<div class="empty">Aún no hay registros nuevos. Completa una fila y guárdala.</div>'}
const HISTORY_FIELDS=[
 ['historyGym','gym','Gimnasios'],['historySede','sede','Sedes'],['historyZone','zone','Anotaciones'],
 ['historyEquipment','equipment','Instrumentos'],['historyExercise','exercise','Ejercicios'],
 ['historyAccessory','accessory','Agarres / implementos'],['historyTechnique','technique','Técnicas'],
 ['historySeries','series','Números de serie'],['historySubdivision','subdivision','Subdivisiones']
];
function historyFieldValue(record,key){
 if(key==='accessory'){
  const names=[record.grip,record.accessory].filter(v=>v&&v!=='No especificado'&&v!=='-');
  return uniq(names).join(' / ')||'No especificado';
 }
 if(key==='subdivision')return record.subdivision&&record.subdivision!=='-'?String(record.subdivision):'Sin subdivisiones';
 return String(record[key]??'')||'No especificado';
}
function historyColumnValue(record,key){
 if(key==='date')return fmtDate(record.date);
 if(key==='weight')return String(record.weight??'')+' '+String(record.unit||'kg');
 if(key==='reps')return String(record.reps??'');
 return historyFieldValue(record,key);
}
const HISTORY_COLUMNS=[
 ['date','Fecha'],['gym','Gimnasio'],['sede','Sede'],['zone','AnotaciónV2'],
 ['equipment','Instrumento'],['exercise','Ejercicio'],['accessory','Agarre / Implemento'],
 ['technique','Tecnica_Actualizada'],['series','Número de serie'],['subdivision','Subdivisión'],
 ['weight','Peso'],['reps','Repeticiones']
];
let historyVisible=60,expandedHistoryId=null;
function resetHistoryFilters(){
 for(const [id] of HISTORY_FIELDS)if($(id))$(id).value='';
 for(const id of ['historyDateFrom','historyDateTo'])if($(id))$(id).value='';
 historyVisible=60;expandedHistoryId=null;
}
function drawHistory(reset=false){
 if(reset){historyVisible=60;expandedHistoryId=null;}
 const ordered=orderedRecords();
 renderSeriesCatalogShortcuts();
 for(const [id,key,title] of HISTORY_FIELDS){
  const select=$(id);if(!select)continue;
  const names=uniq(ordered.map(r=>historyFieldValue(r,key)));
  const selected=select.value;
  select.replaceChildren(new Option('Todos los '+title.toLowerCase(),''));
  for(const name of names)select.add(new Option(name,name));
  select.value=names.includes(selected)?selected:'';
 }
 const filters=Object.fromEntries(HISTORY_FIELDS.map(([id,key])=>[key,$(id)?.value||'']));
 const from=$('historyDateFrom')?.value||'',to=$('historyDateTo')?.value||'';
 const invalid=Boolean(from&&to&&from>to);
 const list=invalid?[]:ordered.filter(r=>
  (!from||r.date>=from)&&(!to||r.date<=to)&&
  Object.entries(filters).every(([key,value])=>!value||historyFieldValue(r,key)===value));
 const extended=$('historyView')?.value==='extended';
 const columns=HISTORY_COLUMNS.filter(([key])=>extended?!filters[key]:['date','series','subdivision','weight','reps'].includes(key));
 const shown=list.slice(0,historyVisible);
 const heads=columns.map(([,label])=>'<th scope="col">'+esc(label)+'</th>').join('');
 const rows=shown.map(r=>{
  const cells=columns.map(([key])=>{
   const value=esc(historyColumnValue(r,key));
   return '<td>'+ (key==='date'?'<button class="history-row-open" type="button" data-history-detail="'+esc(r.id)+'" aria-label="Ver acciones de serie del '+esc(fmtDate(r.date))+'">'+value+' ⋯</button>':value)+'</td>';
  }).join('');
  const expanded=expandedHistoryId===r.id;
  const more=expanded?'<tr class="history-detail-actions"><td colspan="'+columns.length+'"><strong>'+esc(r.exercise)+'</strong> · '+esc(r.technique||'')+' <button type="button" data-delete="'+esc(r.id)+'">Eliminar</button><button type="button" data-progress="'+esc(r.exercise)+'">Ver progreso</button></td></tr>':'';
  return '<tr data-history-row="'+esc(r.id)+'">'+cells+'</tr>'+more;
 }).join('');
 const container=$('historyRecords');
 container.innerHTML=shown.length?
  '<div class="history-table-scroll" tabindex="0" role="region" aria-label="Tabla de historial desplazable"><table class="history-data-table"><thead><tr>'+heads+'</tr></thead><tbody>'+rows+'</tbody></table></div><p class="history-table-hint">Toca la fecha de una fila para eliminar esa serie o ver su progreso.</p>':
  '<div class="empty">'+(invalid?'Revisa las fechas: «Desde» no puede superar «Hasta».':'No se encontraron series con los filtros seleccionados.')+'</div>';
 $('historyPagination').hidden=list.length<=historyVisible;
 $('historyPageInfo').textContent='Mostrando '+Math.min(historyVisible,list.length).toLocaleString('es-PE')+' de '+list.length.toLocaleString('es-PE')+' series';
 const volume=list.reduce((sum,r)=>{
  const w=Number(r.weight),rep=Number(r.reps);
  return Number.isFinite(w)&&Number.isFinite(rep)?sum+w*(r.unit==='lb'?0.45359237:1)*rep:sum;
 },0);
 const n=v=>v.toLocaleString('es-PE');
 $('historyFilterSummary').textContent=invalid?'Rango de fechas incorrecto.':n(list.length)+' de '+n(ordered.length)+' series · '+n(new Set(list.map(r=>r.date)).size)+' fechas · Volumen: '+Math.round(volume).toLocaleString('es-PE')+' kg × rep.';
}

async function deleteRecord(id){
 if(!window.GymCloud?.canWrite())return;
 const stamp=window.GymCloud.getSessionStamp?.();
 const current=()=>stamp===window.GymCloud.getSessionStamp?.()&&window.GymCloud.canWrite();
 const row=model.records.find(x=>x.id===id);
 if(!row||!confirm(`¿Eliminar ${row.series} de ${row.exercise}?`)||!current())return;
 try{await window.GymCloud.deleteSeries(id)}
 catch(err){if(current())toast('No se pudo eliminar: '+String(err.message||err).slice(0,90));return}
 if(!current())return;
 setHistoryReady(false);
 model.records=model.records.filter(x=>x.id!==id);
 drawRecent();drawHistory();drawReports();
 try{
  const latest=await window.GymCloud.loadHistory();
  if(!current())return;
  model.records=latest;drawRecent();drawHistory();drawReports();
  setHistoryReady(true);
  toast('Serie eliminada de Supabase');
 }catch(err){if(current())toast('Serie ELIMINADA; no se pudo actualizar el historial.');}
}
function drawReports(){const rows=model.records,days=new Set(rows.map(r=>r.date)).size,vol=rows.reduce((v,r)=>v+r.weight*(r.unit==='lb'?0.45359237:1)*r.reps,0);$('reportStats').innerHTML=`<div class="stat"><strong>${rows.length}</strong><small>Series guardadas</small></div><div class="stat"><strong>${days}</strong><small>Días con registros</small></div><div class="stat"><strong>${Math.round(vol).toLocaleString('es-PE')}</strong><small>Volumen en kg</small></div>`;const counts={};rows.forEach(r=>counts[r.exercise]=(counts[r.exercise]||0)+1);$('frequentExercises').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,n])=>`<div class="freq"><span>${esc(name)}</span><strong>${n}</strong></div>`).join('')||'<div class="empty">Sin ejercicios todavía.</div>';drawProgressChart(rows);}

function drawProgressChart(records){
 const target=$('progressChart'),exerciseSelect=$('progressExercise'),metricSelect=$('progressMetric'),summary=$('progressSummary');
 if(!target||!exerciseSelect||!metricSelect||!summary)return;
 const frequencies=new Map();
 for(const row of records||[])if(row.exercise)frequencies.set(row.exercise,(frequencies.get(row.exercise)||0)+1);
 const names=[...frequencies.keys()].sort((a,b)=>frequencies.get(b)-frequencies.get(a)||a.localeCompare(b,'es'));
 const previous=exerciseSelect.value,chosen=names.includes(previous)?previous:(names[0]||'');
 exerciseSelect.replaceChildren(...names.map(name=>new Option(name,name)));
 exerciseSelect.value=chosen;
 exerciseSelect.disabled=!names.length;
 metricSelect.disabled=!names.length;
 if(!chosen){summary.textContent='Guarda una serie para visualizar tu progreso.';target.innerHTML='<p class="empty">No hay entrenamientos disponibles para graficar.</p>';return;}
 const metric=metricSelect.value||'weight';
 const metricLabels={weight:['Peso máximo','kg'],reps:['Repeticiones totales','rep.'],series:['Series realizadas','series'],volume:['Volumen total','kg × rep.']};
 const [label,unit]=metricLabels[metric]||metricLabels.weight;
 const days=new Map();
 for(const r of records){
  if(r.exercise!==chosen||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))continue;
  const weight=Number(r.weight),reps=Number(r.reps);
  if(!Number.isFinite(weight)||!Number.isFinite(reps)||weight<0||reps<0)continue;
  const kg=weight*(r.unit==='lb'?0.45359237:1);
  const d=days.get(r.date)||{date:r.date,weight:0,reps:0,series:0,volume:0};
  d.weight=Math.max(d.weight,kg);d.reps+=reps;d.series++;d.volume+=kg*reps;
  days.set(r.date,d);
 }
 const dates=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const rangeSelect=$('progressRange'),range=rangeSelect?.value||'all';
 const daysBack=range==='all'?0:Number(range);
 const latest=dates.at(-1)?.date;
 const cutoff=latest&&daysBack>0&&Number.isFinite(daysBack)
  ?new Date(Date.parse(latest+'T00:00:00Z')-(daysBack-1)*86400000).toISOString().slice(0,10):null;
 const inRange=cutoff?dates.filter(p=>p.date>=cutoff):dates;
 const points=inRange.slice(-10);
 if(!points.length){summary.textContent=dates.length?'Sin sesiones en el período seleccionado.':'Este ejercicio todavía no tiene fechas registradas.';target.innerHTML='<p class="empty">Sin fechas para mostrar.</p>';return;}
 const format=value=>Number(value).toLocaleString('es-PE',{maximumFractionDigits:1});
 const values=points.map(p=>p[metric]||0),maximum=Math.max(1,...values);
 const left=54,right=721,top=28,bottom=222,plotHeight=bottom-top;
 const xy=points.map((p,i)=>({
  x:points.length===1?(left+right)/2:left+i*(right-left)/(points.length-1),
  y:bottom-values[i]/maximum*plotHeight,date:p.date,value:values[i]
 }));
 const line=xy.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const area='M '+xy[0].x.toFixed(1)+' '+bottom+' L '+xy.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L ')+' L '+xy.at(-1).x.toFixed(1)+' '+bottom+' Z';
 const grids=[0,.25,.5,.75,1].map(t=>{
  const y=bottom-t*plotHeight;return '<line x1="'+left+'" y1="'+y+'" x2="'+right+'" y2="'+y+'" stroke="#31526e" stroke-dasharray="4 7" stroke-opacity=".6"/><text x="45" y="'+(y+4)+'" text-anchor="end" fill="#98b8d1" font-size="11">'+esc(format(t*maximum))+'</text>';
 }).join('');
 const marks=xy.map(p=>'<g><rect x="'+(p.x-13).toFixed(1)+'" y="'+p.y.toFixed(1)+'" width="26" height="'+(bottom-p.y).toFixed(1)+'" rx="6" fill="url(#gymBar)" opacity=".43"/><circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="5" fill="#e4fdff" stroke="#29d6ff" stroke-width="3"><title>'+esc(p.date+' · '+format(p.value)+' '+unit)+'</title></circle><text x="'+p.x.toFixed(1)+'" y="'+Math.max(13,p.y-13).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#e8faff">'+esc(format(p.value))+'</text><text x="'+p.x.toFixed(1)+'" y="247" text-anchor="middle" font-size="11" fill="#a5c1d7">'+esc(p.date.slice(8)+'/'+p.date.slice(5,7))+'</text></g>').join('');
 target.innerHTML='<svg class="progress-svg" viewBox="0 0 760 270" role="img" aria-label="'+esc(label+' de '+chosen+' durante '+points.length+' fechas')+'"><defs><linearGradient id="gymArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15d9ef" stop-opacity=".27"/><stop offset="1" stop-color="#15d9ef" stop-opacity="0"/></linearGradient><linearGradient id="gymBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5deaff"/><stop offset="1" stop-color="#25509c"/></linearGradient></defs>'+grids+'<path d="'+area+'" fill="url(#gymArea)"/><polyline points="'+line+'" fill="none" stroke="#3bdfff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+marks+'</svg>';
 summary.textContent=label+' · '+points.length+' fecha'+(points.length===1?'':'s')+' mostrada'+(points.length===1?'':'s')+' de '+inRange.length+' · Último valor: '+format(values.at(-1))+' '+unit;
}

function download(name,content,mime){const blob=new Blob([content],{type:mime}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function setHistoryReady(ready){
 historyReady=!!ready;
 for(const id of ['exportCsv','exportJson']){
  const button=$(id);
  if(button){button.disabled=!historyReady;button.setAttribute('aria-disabled',String(!historyReady));}
 }
}
function canExportHistory(){
 if(historyReady&&!!window.GymCloud?.canWrite())return true;
 toast('Primero sincroniza el historial completo de tu cuenta para exportarlo.');
 return false;
}
async function refreshHistory(){
 if(!window.GymCloud?.canWrite()){toast('Inicia sesión para actualizar el historial.');return;}
 const stamp=window.GymCloud.getSessionStamp?.();
 const current=()=>stamp===window.GymCloud?.getSessionStamp?.()&&!!window.GymCloud?.canWrite();
 const button=$('historyRefresh');button.disabled=true;
 setHistoryReady(false);
 if(typeof showHistoryLoadProgress==='function')showHistoryLoadProgress(0,null);
 try{
  const latest=await window.GymCloud.loadHistory((loaded,total)=>{
   if(current()&&typeof showHistoryLoadProgress==='function')showHistoryLoadProgress(loaded,total);
  });
  if(!current())return;
  model.records=latest;drawRecent();drawHistory(true);drawReports();
  setHistoryReady(true);
  toast('Historial actualizado desde Supabase ✓');
 }catch(error){
  if(current())toast('No se pudo actualizar el historial: '+String(error.message||error).slice(0,120));
 }finally{if(current()){button.disabled=false;if(typeof showHistoryLoadProgress==='function')showHistoryLoadProgress(null,null);}}
}
function exportCsv(){if(!canExportHistory())return;const fields=[['date','Fecha'],['gym','Gimnasio'],['sede','Sede'],['zone','Zona de entrenamiento'],['type','Tipo de equipo'],['equipment','Máquina / equipo'],['accessory','Accesorio / implemento'],['grip','Agarre'],['exercise','Ejercicio'],['technique','Técnica de ejecución'],['series','Número de serie'],['subdivision','Subdivisión'],['unit','Unidad'],['weight','Peso'],['reps','Repeticiones'],['assistance','Asistencias'],['notes','Observaciones']];const quote=s=>{const v=String(s??'');return '"'+(/^[\u0000-\u0020]*[=+@-]/.test(v)?"'":'')+v.replace(/"/g,'""')+'"'},lines=[fields.map(x=>quote(x[1])),...orderedRecords().map(r=>fields.map(([k])=>quote(r[k])))].map(x=>x.join(';'));download('Gymlytics_series_'+dateNow()+'.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');toast('CSV exportado')}
function exportJson(){if(!canExportHistory())return;download('Gymlytics_respaldo_'+dateNow()+'.json',JSON.stringify({version:2,...model},null,2),'application/json');toast('Copia de seguridad exportada')}
async function importJson(event){const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.records)||!parsed.photos||typeof parsed.photos!=='object')throw Error('Incompatible');if(!confirm(`¿Reemplazar los ${model.records.length} registros locales con ${parsed.records.length} registros del archivo?`))return;const previous=model;model={records:parsed.records,photos:parsed.photos};if(!persist()){model=previous;return}drawRecent();drawHistory();toast('Copia de seguridad restaurada')}catch(e){toast('No se pudo importar. Comprueba el JSON.')}finally{event.target.value=''}}
async function uploadPhoto(event){
 const file=event.target.files?.[0],type=event.target.dataset.upload,r=chosenRow();
 if(!r||!file)return;
 if(!file.type.startsWith('image/')){toast('Selecciona una imagen válida');return;}
 const stamp=window.GymCloud?.getSessionStamp?.();
 const current=()=>stamp===window.GymCloud?.getSessionStamp?.()&&!!window.GymCloud?.canWrite();
 const key=type==='equipo'?`${r.g}|${r.s}|${r.i}`:`${r.g}|${r.s}|${r.i}|${r.e}`;
 try{
  const canvas=await photoCanvas(file,820);
  if(!current())return;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));
  if(!blob)throw Error('No se pudo procesar la fotografía');
  const url=canvas.toDataURL('image/jpeg',.78);
  if(!current())return;
  await window.GymCloud.uploadUserPhoto({exercise:r,technique:getValue('t'),
   type:type==='equipo'?'maquina':'ejercicio',side:null,blob});
  if(!current())return;
  model.photos[type+':'+key]=url;
  detailOpenAfterUpload(type);
  toast('Fotografía guardada en Supabase ✓');
 }catch(error){if(current())toast('Error de fotografía: '+error.message.slice(0,110));}
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
function install(){$('addExerciseTab').addEventListener('click',()=>newDraft());$('exerciseTabs').addEventListener('click',event=>{const closed=event.target.closest('[data-exercise-close]'),switched=event.target.closest('[data-exercise-switch]');if(closed)closeDraft(closed.dataset.exerciseClose);else if(switched&&switched.dataset.exerciseSwitch!==activeDraftId)openDraft(switched.dataset.exerciseSwitch);});for(let i=0;i<FLOW.length;i++){const [key,id]=FLOW[i];if(key==='kind'){document.querySelectorAll('input[name="tipo"]').forEach(input=>input.addEventListener('change',()=>{cascade(i+1);refreshActiveDraftTitle();}))}else $(id).addEventListener('change',()=>{cascade(i+1);refreshActiveDraftTitle();})}document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('click',()=>showPage(x.dataset.page)));$('openDetail').addEventListener('click',detailOpen);$('closeDetail').addEventListener('click',()=>$('detailModal').close());$('closeDetailBottom').addEventListener('click',()=>$('detailModal').close());document.querySelectorAll('[data-upload]').forEach(x=>x.addEventListener('change',uploadPhoto));$('seriesRows').addEventListener('input',updateSeriesCount);document.querySelectorAll('[data-mobile-step]').forEach(b=>b.addEventListener('click',()=>setMobileStep(b.dataset.mobileStep)));$('continueToSeries').addEventListener('click',()=>setMobileStep('series'));$('backToContext').addEventListener('click',()=>setMobileStep('context'));$('resetSubdivisions').addEventListener('click',()=>changeSeriesMode('normal'));$('toggleSubdivisions').addEventListener('click',()=>{const open=$('splitOptions').hidden;$('splitOptions').hidden=!open;$('toggleSubdivisions').setAttribute('aria-expanded',String(open))});document.querySelectorAll('[data-series-mode]').forEach(b=>b.addEventListener('click',()=>changeSeriesMode(b.dataset.seriesMode)));$('addSeriesGroup').addEventListener('click',()=>resizeSeries(1));$('removeSeriesGroup').addEventListener('click',()=>resizeSeries(-1));$('saveRecords').addEventListener('click',saveSeries);$('clearSeries').addEventListener('click',()=>{renderSeries();toast('Tabla vaciada')});$('progressExercise').addEventListener('change',()=>drawProgressChart(model.records));$('progressMetric').addEventListener('change',()=>drawProgressChart(model.records));$('progressRange').addEventListener('change',()=>drawProgressChart(model.records));document.querySelectorAll('[data-history-field]').forEach(field=>field.addEventListener('change',()=>drawHistory(true)));$('historyView').addEventListener('change',()=>drawHistory(true));$('historyDateFrom').addEventListener('change',()=>drawHistory(true));$('historyDateTo').addEventListener('change',()=>drawHistory(true));$('historyClearFilters').addEventListener('click',()=>{resetHistoryFilters();drawHistory(true)});$('historyLoadMore').addEventListener('click',()=>{historyVisible+=60;drawHistory()});$('historyRefresh').addEventListener('click',refreshHistory);$('exportCsv').addEventListener('click',exportCsv);$('exportJson').addEventListener('click',exportJson);document.querySelector('#addOptionForm [name="tipo"]').addEventListener('change',renderIndependentCatalog);
document.querySelectorAll('[data-catalog-existing]').forEach(select=>select.addEventListener('change',()=>{
 const kind=select.dataset.catalogExisting;
 const item=existingCatalogItems(kind).find(x=>x.id===select.value);
 const field=$(kind+'EditName');if(field)field.value=item?.nombre||'';
}));
document.querySelectorAll('[data-catalog-modify]').forEach(button=>button.addEventListener('click',async()=>{
 const kind=button.dataset.catalogModify;
 const select=$({gym:'gymExistingSelect',site:'siteExistingSelect',machine:'machineExistingSelect',option:'optionExistingSelect',exercise:'exerciseExistingSelect'}[kind]);
 const name=$(kind+'EditName')?.value.trim()||'',feedback=$(kind==='exercise'?'exerciseEditFeedback':{gym:'gymFeedback',site:'siteFeedback',machine:'machineFeedback',option:'optionFeedback'}[kind]);
 if(!select.value||!name){feedback.textContent='Selecciona un elemento y escribe su nuevo nombre.';return;}
 if(!window.GymCloud?.canWrite()){feedback.textContent='Inicia sesión para modificar.';return;}
 const stamp=window.GymCloud.getSessionStamp?.(),current=()=>stamp===window.GymCloud.getSessionStamp?.()&&window.GymCloud.canWrite();
 button.disabled=true;
 try{await window.GymCloud.updateCatalogItem(kind,select.value,name);if(current())feedback.textContent='Nombre actualizado correctamente en Supabase.';}
 catch(error){if(current())feedback.textContent='No se pudo modificar: '+error.message;}
 finally{button.disabled=false;}
}));
document.addEventListener('click',e=>{const detail=e.target.closest('[data-history-detail]');if(detail){expandedHistoryId=expandedHistoryId===detail.dataset.historyDetail?null:detail.dataset.historyDetail;drawHistory();return;}const b=e.target.closest('[data-delete]');if(b){deleteRecord(b.dataset.delete);return;}const progress=e.target.closest('[data-progress]');if(progress){const exercise=progress.dataset.progress;showPage('dashboard');if(model.records.some(r=>r.exercise===exercise)){$('progressExercise').value=exercise;drawProgressChart(model.records);}}})}
$('fecha').value=dateNow();renderSeries();cascade(0,INITIAL);resetExerciseTabs();setupCatalogCompact();install();setHistoryReady(false);drawRecent();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});


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
 const stamp=window.GymCloud?.getSessionStamp?.();
 const current=()=>stamp===window.GymCloud?.getSessionStamp?.()&&!!window.GymCloud?.canWrite();
 try{
  const canvas=await photoCanvas(file,750);
  if(!current())return;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));
  if(!blob)throw Error('No se pudo procesar la imagen');
  if(!current())return;
  await window.GymCloud.uploadUserPhoto({exercise:r,technique:getValue('t'),type:'musculos',side,blob});
  if(!current())return;
  model.photos['anatomia:'+side+':'+r.e]=canvas.toDataURL('image/jpeg',.78);
  gymlyticsAnatomyDraw();toast('Foto anatómica guardada en Supabase ✓');
 }catch(error){if(current())toast('Error al guardar foto: '+error.message.slice(0,110));}
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
