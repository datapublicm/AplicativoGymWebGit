import {cascadeVariants,availableFields,exerciseValue,BASE_FIELDS} from './catalog-detail-filter.mjs';
const by=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=by('catalogCompactRows'),exerciseCard=root?.querySelector('[data-catalog-kind="exercise"]');
let selected={},stamp=null;
if(root&&exerciseCard){
 const box=document.createElement('section');
 box.className='catalog-detail-disambiguator';
 box.innerHTML='<details id="catalogDetailBrowser"><summary>🔎 Detalle de ejercicio <span class="catalog-detail-hint">Buscar variantes</span></summary>'+
 '<p class="catalog-detail-info">Selecciona nombre y características. Si hay varias variantes, continúa filtrando hasta identificar una sola.</p>'+
 '<div id="catalogDetailFilters" class="catalog-detail-filters"></div>'+
 '<div id="catalogDetailMatches" role="status" class="catalog-detail-results"></div>'+
 '<details id="catalogDetailCandidates" hidden><summary>Ver coincidencias</summary><ul id="catalogDetailCandidatesList"></ul></details>'+
 '<button id="catalogDetailView" class="primary-btn" type="button" disabled>Ver</button></details>';
 exerciseCard.after(box);
 const panel=by('catalogDetailBrowser'),filters=by('catalogDetailFilters'),count=by('catalogDetailMatches');
 const view=by('catalogDetailView'),candidates=by('catalogDetailCandidates'),list=by('catalogDetailCandidatesList');
 function currentLibrary(){return (window.GymExerciseLibrary||[]).filter(ex=>ex&&ex.id&&ex.nombre);}
 function render(){
  const library=currentLibrary();
  const token=window.GymCloud?.getSessionStamp?.()||null;
  if(stamp!==token){selected={};stamp=token;}
  const result=cascadeVariants(library,selected);
  selected=result.selected;
  filters.replaceChildren();
  for(let i=0;i<result.selectors.length;i++){
   const group=result.selectors[i],label=document.createElement('label');
   label.className='catalog-detail-filter';
   label.textContent=group.field==='Identificador'?'Variante exacta':group.field;
   const select=document.createElement('select');
   select.dataset.detailField=group.field;
   select.setAttribute('aria-label','Filtrar por '+group.field);
   const prompt=group.field==='Nombre del ejercicio'?'Selecciona un ejercicio…':'Cualquier valor';
   select.add(new Option(group.options.length?prompt:'Sin valores', ''));
   for(const option of group.options)select.add(new Option(option.label,option.value));
   select.value=group.selected;
   select.disabled=!group.options.length;
   select.addEventListener('change',()=>{
    const previousFields=result.selectors.map(x=>x.field);
    selected[group.field]=select.value;
    // Al cambiar un campo, limpiar las decisiones posteriores y evitar
    // combinaciones incoherentes de diferentes variantes.
    for(const f of previousFields.slice(i+1))delete selected[f];
    render();
   });
   label.append(select);filters.append(label);
  }
  view.disabled=!result.unique;
  count.textContent=library.length===0?'Aún no hay ejercicios. Agrega uno en la sección Ejercicio.':
   result.matches.length===1?'1 variante identificada; puedes pulsar «Ver».':
   result.matches.length+' variantes coincidentes de '+library.length+'. Filtra otro campo para continuar.';
  const nameCount=new Map();
  for(const e of result.matches)nameCount.set(e.nombre,(nameCount.get(e.nombre)||0)+1);
  list.replaceChildren();
  for(const ex of result.matches.slice(0,80)){
   const li=document.createElement('li');
   const summary=availableFields([ex]).filter(x=>x!=='Nombre del ejercicio').slice(0,6)
    .map(f=>f+': '+exerciseValue(ex,f)).join(' · ');
   li.textContent=ex.nombre+' ('+nameCount.get(ex.nombre)+')'+(summary?' — '+summary:'')+' · '+ex.id.slice(-8);
   list.append(li);
  }
  if(result.matches.length>80){const li=document.createElement('li');li.textContent='…y '+(result.matches.length-80)+' variantes adicionales';list.append(li);}
  candidates.hidden=result.matches.length<=1;
  if(!candidates.hidden)candidates.querySelector('summary').textContent='Mostrar coincidencias ('+result.matches.length+')';
  view.dataset.exerciseId=result.unique?.id||'';
 }
 view.addEventListener('click',()=>{
  const id=view.dataset.exerciseId;
  const target=currentLibrary().find(x=>x.id===id);
  if(!target||view.disabled)return;
  const picker=by('exerciseExistingSelect');
  if(![...picker.options].some(x=>x.value===id)){count.textContent='Actualiza el catálogo antes de consultar esta variante.';return;}
  picker.value=id;
  picker.dispatchEvent(new Event('change',{bubbles:true}));
  if(typeof catalogOpenCard==='function')catalogOpenCard('exercise','edit');
  // Selección por UUID: únicamente la variante elegida es editable.
  panel.open=false;
  count.textContent='Variante seleccionada: '+target.nombre+'.';
  by('catalogDetailexercise')?.scrollIntoView?.({block:'start'});
 });
 window.GymCatalogDetailRefresh=render;
 panel.addEventListener('toggle',()=>{if(panel.open)render();});
 render();
}
