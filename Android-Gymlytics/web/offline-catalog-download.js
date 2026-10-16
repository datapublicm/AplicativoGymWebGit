import {catalogSnapshot} from './catalog-sync-engine.js';
import {referenceKey} from './reference-overrides.js';
// Transformación pura de tablas Supabase a catálogos offline. Sin escritura remota.
export const emptyCatalogue=()=>({baseCatalog:[],muscles:[],custom:[],library:[],
 entities:{gyms:[],sites:[],machines:[],options:[]}});
const name=v=>String(v??'').trim();
export function prepareDownloadedCatalog({base=[],exercises=[],gyms=[],sites=[],machines=[],options=[],muscles=[]}={}){
 const byGym=new Map(gyms.map(x=>[x.id,name(x.nombre)]));
 const bySite=new Map(sites.map(x=>[x.id,name(x.nombre)]));
 const personal=(kind,x,values)=>({...values,cloudOwnerId:x.user_id,cloudSnapshot:catalogSnapshot(kind,x)});
 const entities={gyms:gyms.filter(x=>x.activo!==false).map(x=>personal('gym',x,{id:x.id,nombre:x.nombre})),
  sites:sites.filter(x=>x.activo!==false).map(x=>personal('site',x,{id:x.id,nombre:x.nombre,gimnasio_id:x.gimnasio_id})),
  machines:machines.filter(x=>x.activo!==false).map(x=>personal('machine',x,{id:x.id,nombre:x.nombre,tipo_equipo:x.tipo_equipo})),
  options:options.filter(x=>x.activo!==false).map(x=>personal('option',x,{id:x.id,nombre:x.nombre,tipo:x.tipo}))};
 const baseCatalog=base.filter(x=>x.activo!==false).map(x=>{
  const equipment=name(x.instrumento);
  const kind=/máquina|maquina|freemotion|estación|polea|hack|peck deck/i.test(equipment)?'Máquina':
   /mancuerna|barra|disco|banca/i.test(equipment)?'Implemento libre':'Otro';
  return {cloud_base_id:x.id,g:name(x.gimnasio),s:name(x.sede),
   z:name(x.zona_entrenamiento||x.anotacion)||'Sin clasificar',kind,i:equipment,
   e:name(x.ejercicio),a:name(x.accesorio_implemento)||'No especificado',
   gr:'No especificado',t:[name(x.tecnica_actualizada)||'01 - Ejecución base'],
   m:name(x.musculos_principales)||'No especificado',
   ms:name(x.musculos_secundarios)||'No especificado',n:0,last:null};
 }).filter(x=>x.g&&x.s&&x.e&&x.e!=='-');
 const active=exercises.filter(x=>x.activo!==false);
 const library=active.filter(x=>!x.gimnasio_id||!x.sede_id).map(x=>({
  id:x.id,nombre:x.nombre,origen:x.origen,zona_entrenamiento:x.zona_entrenamiento,
  tecnica_actualizada:x.tecnica_actualizada,cloudOwnerId:x.user_id,cloudSnapshot:catalogSnapshot('exercise',x)
 }));
 const custom=active.filter(x=>x.gimnasio_id&&x.sede_id).map(x=>({
  id:x.id,cloud_id:x.id,nombre:x.nombre,gimnasio_id:x.gimnasio_id,sede_id:x.sede_id,
  origen:x.origen,cloudOwnerId:x.user_id,cloudSnapshot:catalogSnapshot('exercise',x),
  zona_entrenamiento:x.zona_entrenamiento,tecnica_actualizada:x.tecnica_actualizada,
  g:byGym.get(x.gimnasio_id)||'',s:bySite.get(x.sede_id)||'',
  z:name(x.zona_entrenamiento)||'Sin clasificar',kind:name(x.tipo_equipo)||'Otro',
  i:name(x.instrumento)||'Sin equipo',a:name(x.accesorio||x.implemento)||'No especificado',
  gr:name(x.agarre)||'No especificado',e:name(x.nombre),
  t:[name(x.tecnica_actualizada)||'Ejecución base'],
  m:'No especificado',ms:'No especificado',n:0,last:null
 }));
 return {baseCatalog,entities,library,custom,muscles:muscles.filter(x=>x.activo!==false).map(x=>({id:x.id,nombre:x.nombre,codigo:x.codigo,grupo_muscular:x.grupo_muscular}))};
}

// Fusiona catálogos sin eliminar ni sobrescribir ediciones locales.
// Si una misma entidad existe localmente, prevalece su valor local;
// las nuevas referencias de la nube se incorporan después.
export function mergeDownloadedCatalog(local,download){
 const removed=new Set((local.tombstones||[]).filter(x=>x.catalogKind).map(x=>x.catalogKind+':'+x.localId));
 const dirty=new Set((local.pending||[]).filter(x=>x.catalogKind).map(x=>x.catalogKind+':'+x.localId));
 const warnings=[];
 const hasEditedReference=row=>{
  const edits=local.referenceOverrides||{};
  return [
   referenceKey('gym',row.g),referenceKey('site',row.s,row.g),
   referenceKey('machine',row.i),referenceKey('exercise',row.e),
   referenceKey('zone',row.z),referenceKey('grip',row.gr),referenceKey('grip',row.a),
   ...(row.t||[]).map(v=>referenceKey('technique',v))
  ].some(key=>Object.prototype.hasOwnProperty.call(edits,key));
 };
 const union=(existing=[],incoming=[],keys=[],kind='')=>{
  const result=structuredClone(existing);
  const key=row=>keys.map(k=>name(row[k]).toLocaleLowerCase('es')).join('|');
  for(const item of incoming){
   const id=String(item.id||item.cloud_id||item.cloud_base_id||'');
   if(kind&&removed.has(kind+':'+id))continue;
   const index=result.findIndex(x=>id&&String(x.id||x.cloud_id||x.cloud_base_id||'')===id);
   if(index>=0){
    const before=result[index],changed=JSON.stringify(before)!==JSON.stringify(item),
     original=before.cloudSnapshot,remoteSnapshot=item.cloudSnapshot;
    if(kind==='base'&&changed){
     // Los cambios realizados por el usuario se guardan como overrides.
     // La edición directa heredada de g/s/i/e/a/t tampoco se descarta.
     const identityFields=['g','s','i','e','a','gr','kind','t'];
     const legacyChanged=identityFields.some(field=>
      JSON.stringify(before[field]??null)!==JSON.stringify(item[field]??null));
     if(hasEditedReference(before)||legacyChanged){
      warnings.push({kind:'reference_conflict',refId:id,sourceKey:'base:'+id,
       reason:'referencia_compartida_modificada'});
      continue;
     }
     // Se actualiza zona/anotación de la fuente sin cambiar IDs ni los
     // músculos que ya estaban en el perfil.
     result[index]={...structuredClone(item),m:before.m??item.m,ms:before.ms??item.ms};
     continue;
    }
    if(kind!=='base'&&changed&&!dirty.has(kind+':'+id)){
     const fields=kind==='exercise'?['nombre','zona_entrenamiento','tecnica_actualizada']:
      kind==='site'?['nombre','gimnasio_id']:kind==='machine'?['nombre','tipo_equipo']:
      kind==='option'?['nombre','tipo']:['nombre'];
     const localChanged=original?
      fields.some(field=>JSON.stringify(before[field]??null)!==JSON.stringify(original[field]??null)):
      true;
     const otherOwner=!!before.cloudOwnerId&&!!item.cloudOwnerId&&before.cloudOwnerId!==item.cloudOwnerId;
     if(localChanged||otherOwner){
      warnings.push({kind:'catalog_conflict',catalogKind:kind,localId:id,
       reason:otherOwner?'cuenta_ajena':'cambio_local_sin_confirmar',
       current:remoteSnapshot||null});
      continue;
     }
    }
    if(!dirty.has(kind+':'+id))result[index]=structuredClone(item);
    else if(kind&&remoteSnapshot&&!before.cloudSnapshot){
     // No adivinar la versión previa de una modificación heredada.
     before.cloudSnapshot=structuredClone(remoteSnapshot);
     before.cloudOwnerId=item.cloudOwnerId;
     warnings.push({kind:'catalog_conflict',catalogKind:kind,localId:id,
      reason:'baseline_recuperada_requiere_revision',current:structuredClone(remoteSnapshot)});
    }
    continue;
   }
   if(kind!=='base'&&result.some(x=>key(x)===key(item)))continue;
   result.push(structuredClone(item));
  }
  return result;
 };
 const remoteIds=new Set((download.baseCatalog||[]).map(x=>String(x.cloud_base_id)).filter(Boolean));
 const retainedBase=(local.baseCatalog||[]).filter(row=>{
  const id=String(row.cloud_base_id||'');
  if(!id||remoteIds.has(id))return true;
  if(hasEditedReference(row)){
   warnings.push({kind:'reference_conflict',refId:id,sourceKey:'base:'+id,
    reason:'referencia_retirada_con_modificacion_local'});
   return true;
  }
  // La plantilla retirada ya no se propone en los selectores, pero
  // los registros históricos y cambios personales no se eliminan.
  return false;
 });
 const current=local.entities||emptyCatalogue().entities;
 const fetched=download.entities;
 const gyms=union(current.gyms,fetched.gyms,['nombre'],'gym');
 // Un gimnasio existente puede tener otro UUID local. Reasociar las sedes
 // descargadas evita referencias huérfanas y conserva la estructura offline.
 const remap=new Map(fetched.gyms.map(g=>{
  const present=gyms.find(x=>name(x.nombre).toLocaleLowerCase('es')===name(g.nombre).toLocaleLowerCase('es'));
  return [g.id,present?.id||g.id];
 }));
 const remoteSites=fetched.sites.map(x=>({...x,gimnasio_id:remap.get(x.gimnasio_id)||x.gimnasio_id}));
 return {
  baseCatalog:union(retainedBase,download.baseCatalog,['g','s','e','i','a','gr','z'],'base'),
  muscles:union(local.muscles,download.muscles,['nombre'],'muscle'),
  custom:union(local.custom,download.custom,['g','s','i','e','a','gr'],'custom'),
  library:union(local.library,download.library,['nombre'],'exercise'),
  catalogWarnings:warnings,
  entities:{
   gyms,
   sites:union(current.sites,remoteSites,['nombre','gimnasio_id'],'site'),
   machines:union(current.machines,fetched.machines,['nombre','tipo_equipo'],'machine'),
   options:union(current.options,fetched.options,['tipo','nombre'],'option')
  }
 };
}
