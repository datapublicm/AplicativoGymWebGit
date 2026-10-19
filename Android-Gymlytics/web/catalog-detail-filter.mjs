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
// Los recuentos son FACETAS VIVAS, no acumulados fijos por posición.
// Con Curl martillo (8), Agrupación (7) y Máquina (3) seleccionados,
// las tres opciones elegidas deben mostrar (3), igual que el resultado final.
// Las opciones alternativas muestran cuántas variantes quedarían al elegirlas.
export function cascadeVariants(exercises,values={}){
 const all=(exercises||[]).filter(e=>e&&e.id);
 const fields=availableFields(all),current={};
 for(const field of [...fields,'Identificador'])if(values[field])current[field]=values[field];
 const order=[...fields,'Identificador'];
 let matches=filterVariants(all,current);
 // Cuando un perfil cambia o un filtro queda obsoleto, eliminar primero
 // la selección más específica, sin perder otras selecciones válidas.
 if(!matches.length&&Object.keys(current).length){
  for(const field of order.slice().reverse()){
   if(!current[field])continue;
   delete current[field];matches=filterVariants(all,current);
   if(matches.length)break;
  }
 }
 const selectors=fields.map(field=>{
  const other={...current};delete other[field];
  const population=filterVariants(all,other);
  const counts=new Map();
  for(const ex of population){
   const value=exerciseValue(ex,field);
   if(value)counts.set(value,(counts.get(value)||0)+1);
  }
  const options=[...counts].sort((a,b)=>a[0].localeCompare(b[0],'es',{numeric:true}))
   .map(([value,count])=>({value,count,label:value+' ('+count+')'}));
  return {field,options,selected:current[field]||'',matches:matches.length};
 });
 // Mantener el identificador interno para distinguir variantes idénticas,
 // pero no mostrar sus códigos técnicos a quien usa el selector.
 const idsPopulation=filterVariants(all,{...current,Identificador:undefined})
  .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 if((current['Nombre del ejercicio']||current.Identificador)&&(idsPopulation.length>1||current.Identificador)){
  selectors.push({field:'Identificador',
   options:idsPopulation.map((ex,i)=>({value:ex.id,count:1,label:'Variante '+(i+1)})),
   selected:current.Identificador||'',matches:matches.length});
 }
 return {selectors,matches,selected:current,unique:matches.length===1?matches[0]:null};
}
