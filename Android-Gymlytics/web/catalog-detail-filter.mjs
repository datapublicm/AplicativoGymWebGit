// GymLytics 01.11: filtro puro de variantes por campos dinámicos y UUID.
// Sin lectura de nube; funciona con biblioteca local IndexedDB.
export const BASE_FIELDS=['Nombre del ejercicio','Agrupación','Anotación','Máquina','Agarre / Implemento','Técnica'];
export const canonicalField=name=>name==='Instrumento'?'Máquina':String(name??'').trim();
export function exerciseValue(ex,field){
 if(field==='Nombre del ejercicio')return String(ex.nombre||ex.e||'').trim();
 const item=(ex.detalles||[]).find(d=>canonicalField(d.campo)===field&&String(d.valor||'').trim());
 if(item)return String(item.valor).trim();
 if(field==='Anotación')return String(ex.zona_entrenamiento||'').trim();
 if(field==='Técnica')return String(ex.tecnica_actualizada||'').trim();
 return '';
}
export function availableFields(exercises){
 const all=new Set();
 for(const ex of exercises||[])for(const d of ex.detalles||[])if(String(d.campo||'').trim()&&String(d.valor||'').trim())
  all.add(canonicalField(d.campo));
 for(const f of BASE_FIELDS)if(f==='Nombre del ejercicio'||(exercises||[]).some(ex=>exerciseValue(ex,f)))all.add(f);
 const fields=[...BASE_FIELDS.filter(x=>all.has(x)),...[...all].filter(x=>!BASE_FIELDS.includes(x)).sort((a,b)=>a.localeCompare(b,'es'))];
 return fields;
}
export function filterVariants(exercises,filters={}){
 return (exercises||[]).filter(ex=>Object.entries(filters).every(([field,val])=>
  !val||(field==='Identificador'?ex.id===val:exerciseValue(ex,field)===val)));
}
export function cascadeVariants(exercises,values={}){
 const fields=availableFields(exercises),current={...values},selectors=[];
 let matches=(exercises||[]).slice();
 for(const field of fields){
  const counts=new Map();
  for(const ex of matches){const value=exerciseValue(ex,field);if(value)counts.set(value,(counts.get(value)||0)+1);}
  const options=[...counts].sort((a,b)=>a[0].localeCompare(b[0],'es',{numeric:true}))
   .map(([value,count])=>({value,count,label:value+' ('+count+')'}));
  if(current[field]&&!counts.has(current[field]))delete current[field];
  selectors.push({field,options,selected:current[field]||''});
  if(current[field])matches=matches.filter(ex=>exerciseValue(ex,field)===current[field]);
 }
 const ids=matches.map(ex=>({value:ex.id,count:1,label:(ex.nombre||'Ejercicio')+' · '+ex.id.slice(-8)}));
 if(current.Identificador&&!ids.some(x=>x.value===current.Identificador))delete current.Identificador;
 if(current.Identificador)matches=matches.filter(x=>x.id===current.Identificador);
 // UUID permite distinguir incluso variantes con todos los detalles iguales.
 if((current['Nombre del ejercicio']||current.Identificador)&& (matches.length>1||current.Identificador))selectors.push({field:'Identificador',options:ids,selected:current.Identificador||''});
 return {selectors,matches,selected:current,unique:matches.length===1?matches[0]:null};
}
