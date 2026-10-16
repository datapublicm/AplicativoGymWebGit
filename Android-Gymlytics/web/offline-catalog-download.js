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
 }).filter(x=>x.g&&x.s&&x.e);
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
    if(kind==='base'&&hasEditedReference(result[index])&&
       JSON.stringify(result[index])!==JSON.stringify(item)){
     // La edición local depende del nombre de origen: conservarlo intacto
     // hasta que el usuario revise la nueva referencia compartida.
     warnings.push({kind:'reference_conflict',refId:id,sourceKey:'base:'+id,
      reason:'referencia_compartida_modificada'});
     continue;
    }
    if(!dirty.has(kind+':'+id))result[index]=structuredClone(item);
    else if(kind&&item.cloudSnapshot&&!result[index].cloudSnapshot){
     // Perfil creado antes de registrar versiones: exigir confirmación explícita.
     result[index].cloudSnapshot=structuredClone(item.cloudSnapshot);
     result[index].cloudOwnerId=item.cloudOwnerId;
     warnings.push({kind:'catalog_conflict',catalogKind:kind,localId:id,
      reason:'baseline_recuperada_requiere_revision',current:structuredClone(item.cloudSnapshot)});
    }
    continue;
   }
   if(result.some(x=>key(x)===key(item)))continue;
   result.push(structuredClone(item));
  }
  return result;
 };
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
  baseCatalog:union(local.baseCatalog,download.baseCatalog,['g','s','e','i','a','gr','z'],'base'),
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
