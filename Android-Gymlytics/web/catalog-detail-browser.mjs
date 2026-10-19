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
  // Sincronizar el recuento del ejercicio de la fila superior con los filtros.
  const main=by('exerciseExistingSelect');
  if(main){
   for(const option of main.options){
    if(!option.dataset.originalLabel)option.dataset.originalLabel=option.textContent;
    option.textContent=option.dataset.originalLabel;
   }
   const group=typeof catalogChoices==='function'?catalogChoices('exercise').find(g=>g.rawName===selected['Nombre del ejercicio']):null;
   const selectedOption=[...main.options].find(o=>o.value===group?.id);
   if(selectedOption&&main.value===group.id)
    selectedOption.textContent=group.rawName+' ('+result.matches.length+')';
  }
  filters.replaceChildren();
  for(let i=0;i<result.selectors.length;i++){
   const group=result.selectors[i],label=document.createElement('label');
   label.className='catalog-detail-filter';
   label.textContent=group.field==='Identificador'?'Variante exacta':group.field;
   const select=document.createElement('select');
   select.dataset.detailField=group.field;
   select.setAttribute('aria-label','Filtrar por '+group.field);
   const prompt=group.field==='Nombre del ejercicio'?'Selecciona un ejercicio…':'Cualquier valor';
   select.add(new Option((group.options.length?prompt:'Sin valores')+' ('+result.matches.length+')', ''));
   for(const option of group.options)select.add(new Option(option.label,option.value));
   select.value=group.selected;
   select.disabled=!group.options.length;
   select.addEventListener('change',()=>{
    const previousFields=result.selectors.map(x=>x.field);
    selected[group.field]=select.value;
    if(group.field==='Nombre del ejercicio'){
     const main=by('exerciseExistingSelect');
     const groupOption=typeof catalogChoices==='function'?catalogChoices('exercise').find(g=>g.rawName===select.value):null;
     if(main&&groupOption&&main.value!==groupOption.id){main.value=groupOption.id;main.dispatchEvent(new Event('change',{bubbles:true}));}
     selected={'Nombre del ejercicio':select.value};
    }
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
   result.matches.length+' variantes coincidentes. Filtra otro campo para continuar.';
  const nameCount=new Map();
  for(const e of result.matches)nameCount.set(e.nombre,(nameCount.get(e.nombre)||0)+1);
  list.replaceChildren();
  for(const ex of result.matches.slice(0,80)){
   const li=document.createElement('li');
   const summary=availableFields([ex]).filter(x=>x!=='Nombre del ejercicio').slice(0,6)
    .map(f=>f+': '+exerciseValue(ex,f)).join(' · ');
   li.textContent=ex.nombre+' ('+nameCount.get(ex.nombre)+')'+(summary?' — '+summary:'');
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
  const matching=typeof catalogChoices==='function'?catalogChoices('exercise').find(g=>g.variantIds?.includes(id)):null;
  if(!matching){count.textContent='La variante ya no existe en el perfil.';return;}
  if(typeof catalogSelectExerciseVariant==='function')catalogSelectExerciseVariant(id);
  else{picker.value=id;picker.dispatchEvent(new Event('change',{bubbles:true}));}
  if(typeof catalogOpenCard==='function')catalogOpenCard('exercise','edit');
  // Selección por UUID: únicamente la variante elegida es editable.
  panel.open=false;
  count.textContent='Variante seleccionada: '+target.nombre+'.';
  by('catalogDetailexercise')?.scrollIntoView?.({block:'start'});
 });
 window.GymCatalogDetailSelectName=name=>{
  const desired=String(name||'').trim();
  if(selected['Nombre del ejercicio']===desired)return;
  selected=desired?{'Nombre del ejercicio':desired}:{};
  render();
 };
 window.GymCatalogDetailRefresh=render;
 panel.addEventListener('toggle',()=>{if(panel.open)render();});
 render();
}
