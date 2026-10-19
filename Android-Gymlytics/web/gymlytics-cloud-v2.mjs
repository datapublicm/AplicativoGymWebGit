/* GymLytics 01.09: sincronización directa de las 8 tablas del esquema aprobado.
 * No usa RPC antiguas, tablas auxiliares ni servicios de fondo.
 * Sincroniza el perfil activo únicamente después de vincular y por acción expresa
 * (o con la opción "Actualizar al momento"). Nunca elimina la copia local.
 */
export const CLOUD_SCHEMA='sch_gymlytics';
export const CLOUD_TABLES=['tbl_usuarios','tbl_perfiles','tbl_gimnasios','tbl_sedes',
 'tbl_ejercicios','tbl_ejercicio_detalles','tbl_sesiones','tbl_series'];
export const MODEL_VERSION=1;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=x=>String(x??'').trim(), arr=x=>Array.isArray(x)?x:[], plain=o=>JSON.stringify(o);
const requireUuid=(id,name)=>{if(!UUID.test(String(id)))throw Error('UUID inválido en '+name);return id;};
const byId=rows=>new Map(rows.map(row=>[row.id,row]));
const dateTime=d=>{const str=clean(d).replace('T',' ');return /^\d{4}-\d\d-\d\d \d\d:\d\d/.test(str)?str.slice(0,16):str.slice(0,10)+' 12:00';};
const normalized=(key,v)=>key==='fecha_hora'?dateTime(v):['peso','latitud','longitud'].includes(key)&&v!==null&&v!==undefined?Number(v):v??null;
const equalRow=(server,local)=>!!server&&Object.keys(local).every(k=>plain(normalized(k,server[k]))===plain(normalized(k,local[k])));
const equalsSnapshot=(server,snapshot)=>{
 if(!snapshot)return false;
 const expected=JSON.parse(snapshot);return equalRow(server,expected);
};
export async function deterministicUuid(...parts){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parts.map(clean).join('|'))));
 bytes[6]=bytes[6]&15|80;bytes[8]=bytes[8]&63|128;
 const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export async function prepareGymlyticsTables(data,profileId,profileName,userId){
 requireUuid(profileId,'perfil');requireUuid(userId,'cuenta');
 const entities=data.entities||{}, profile={id:profileId,usuario_id:userId,nombre:clean(profileName)||'Mi perfil',
  modo_sync:data.syncMode==='instant'?'al_momento':'despues'};
 const gyms=new Map(arr(entities.gyms).filter(x=>UUID.test(x.id)).map(g=>[g.id,{id:g.id,perfil_id:profileId,nombre:clean(g.nombre)}]));
 const sites=new Map(arr(entities.sites).filter(x=>UUID.test(x.id)&&gyms.has(x.gimnasio_id)).map(s=>[s.id,{
  id:s.id,gimnasio_id:s.gimnasio_id,nombre:clean(s.nombre)||'Única',
  latitud:s.latitud==null?null:Number(s.latitud),longitud:s.longitud==null?null:Number(s.longitud)}]));
 const exercises=new Map(arr(data.library).filter(x=>UUID.test(x.id)).map(e=>[e.id,{id:e.id,perfil_id:profileId,nombre:clean(e.nombre||e.e)||'Ejercicio'}]));
 const details=new Map();
 for(const e of arr(data.library)){
  if(!exercises.has(e.id))continue;
  for(let i=0;i<arr(e.detalles).length;i++){
   const d=e.detalles[i];if(!clean(d.campo)||!clean(d.valor))continue;
   const id=UUID.test(d.id)?d.id:await deterministicUuid('detalle',e.id,i,d.campo,d.valor);
   details.set(id,{id,ejercicio_id:e.id,campo:clean(d.campo),valor:clean(d.valor),orden:Number.isInteger(d.orden)&&d.orden>=0?d.orden:i});
  }
 }
 const sessions=new Map(arr(data.sessions).filter(s=>UUID.test(s.id)).map(s=>[s.id,{
  id:s.id,perfil_id:profileId,sede_id:sites.has(s.sede_id)?s.sede_id:null,
  fecha_hora:dateTime(s.fecha_hora||s.date),notas:clean(s.notas)||null}]));
 const series=new Map();
 for(const record of arr(data.records)){
  const id=requireUuid(record.id,'serie');
  let site=sites.get(record.siteId);
  if(!site){
   const gymName=clean(record.gym)||'Gimnasio';
   let gym=[...gyms.values()].find(g=>g.nombre===gymName);
   if(!gym){const gymId=await deterministicUuid('gym',profileId,gymName);
    gym={id:gymId,perfil_id:profileId,nombre:gymName};gyms.set(gymId,gym);}
   const name=clean(record.sede)||'Única';
   site=[...sites.values()].find(s=>s.gimnasio_id===gym.id&&s.nombre===name);
   if(!site){const siteId=await deterministicUuid('sede',gym.id,name);
    site={id:siteId,gimnasio_id:gym.id,nombre:name,latitud:null,longitud:null};sites.set(siteId,site);}
  }
  let exercise=exercises.get(record.exerciseId);
  if(!exercise){
   const key=[clean(record.exercise)||'Ejercicio',clean(record.zone),clean(record.equipment),
    clean(record.accessory),clean(record.technique)].join('|');
   const eid=UUID.test(record.exerciseId)?record.exerciseId:await deterministicUuid('exercise',profileId,key);
   exercise=exercises.get(eid);
   if(!exercise){
    exercise={id:eid,perfil_id:profileId,nombre:clean(record.exercise)||'Ejercicio'};
    exercises.set(eid,exercise);
    const values=[['Anotación',record.zone],['Máquina',record.equipment],
     ['Agarre / Implemento',record.accessory],['Técnica',record.technique]];
    for(let i=0;i<values.length;i++){
     const [campo,valor]=values[i];if(!clean(valor)||clean(valor)==='No especificado')continue;
     const did=await deterministicUuid('detalle',eid,i,campo,valor);
     details.set(did,{id:did,ejercicio_id:eid,campo,valor:clean(valor),orden:i});
    }
   }
  }
  let session=sessions.get(record.sessionId);
  if(!session){
   const sid=UUID.test(record.sessionId)?record.sessionId:await deterministicUuid('session',profileId,id);
   session=sessions.get(sid);
   if(!session){session={id:sid,perfil_id:profileId,sede_id:site.id,
    fecha_hora:dateTime(record.createdAt||record.date),notas:clean(record.sessionNotes)||null};
    sessions.set(sid,session);}
  }
  const n=Number(clean(record.series).match(/\d+/)?.[0]||1),reps=Number(record.reps);
  if(!Number.isInteger(n)||n<1||!Number.isInteger(reps)||reps<=0)throw Error('Serie o repeticiones inválidas: '+id);
  const weight=record.weight===null||record.weight===undefined||record.weight===''?null:Number(record.weight);
  if(weight!==null&&(!Number.isFinite(weight)||weight<0))throw Error('Peso inválido en '+id);
  const unit=['kg','lb'].includes(record.unit)?record.unit:null;
  series.set(id,{id,sesion_id:session.id,ejercicio_id:exercise.id,numero_serie:n,
   subdivision:clean(record.subdivision)&&record.subdivision!=='-'?clean(record.subdivision):null,
   peso:weight,unidad:unit,repeticiones:reps,
   asistencia_pausa:record.assistance===undefined||record.assistance===null?null:String(record.assistance),
   otros_detalles:clean(record.notes)||null});
 }
 // También persistir ejercicios elegidos mediante catálogo antiguo con identidad UUID.
 const rows={
  tbl_usuarios:[{id:userId,auth_id:userId,tipo_cuenta:'personal'}],
  tbl_perfiles:[profile],tbl_gimnasios:[...gyms.values()],tbl_sedes:[...sites.values()],
  tbl_ejercicios:[...exercises.values()],tbl_ejercicio_detalles:[...details.values()],
  tbl_sesiones:[...sessions.values()],tbl_series:[...series.values()]
 };
 for(const [table,list] of Object.entries(rows)){
  if(new Set(list.map(x=>x.id)).size!==list.length)throw Error('ID repetido en '+table);
 }
 return rows;
}
export function detectCloudConflicts(local,remote,baseline={}){
 const old=baseline||{},conflicts=[],changed={};let deletions=0;
 for(const table of CLOUD_TABLES.slice(1)){
  const l=byId(local[table]||[]),r=byId(remote[table]||[]),snap=old[table]||{};
  const put=[];
  for(const row of l.values()){
   const other=r.get(row.id),prior=snap[row.id];
   if(other&&!equalRow(other,row)&&(!prior||!equalsSnapshot(other,prior)))
    conflicts.push(table+': '+row.id);
   else if(!other||!equalRow(other,row))put.push(row);
  }
  const del=[];
  for(const id of Object.keys(snap)){
   if(!l.has(id)&&r.has(id)){
    if(!equalsSnapshot(r.get(id),snap[id]))conflicts.push(table+': eliminación remota modificada '+id);
    else{del.push(id);deletions++;}
   }
  }
  changed[table]={put,del};
 }
 return {conflicts,changed,deletions};
}
export function createGymlyticsCloudSync({remote,getState,mutate,refresh,isCurrent,isLinkedElsewhere,confirmAction,notify}){
 let busy=false;
 const isBusy=()=>busy;
 const check=(uid,stamp)=>{
  if(!uid||!isCurrent(uid,stamp))throw Error('La cuenta o el perfil cambió durante la sincronización.');
  if(isLinkedElsewhere?.(uid))throw Error('La cuenta está vinculada a otro perfil local.');
  const d=getState().data;
  if(d.cloudUserId&&d.cloudUserId!==uid)throw Error('El perfil pertenece a otra cuenta.');
  if(!navigator.onLine)throw Error('Sin conexión. Los cambios siguen guardados en el dispositivo.');
 };
 const remoteQuery=async(promise,title)=>{
  const result=await promise;if(result.error)throw Error(title+': '+result.error.message);return result;
 };
 async function ensureUser(uid,stamp){
  check(uid,stamp);
  let result=await remoteQuery(remote.from('tbl_usuarios').select('id,auth_id,tipo_cuenta').eq('auth_id',uid).maybeSingle(),'Verificar cuenta');
  if(!result.data){
   const inserted=await remote.from('tbl_usuarios').insert({id:uid,auth_id:uid,tipo_cuenta:'personal'});
   if(inserted.error&&inserted.error.code!=='23505')throw Error('Registrar cuenta: '+inserted.error.message);
   result=await remoteQuery(remote.from('tbl_usuarios').select('id,auth_id,tipo_cuenta').eq('auth_id',uid).maybeSingle(),'Verificar registro');
  }
  if(!result.data||result.data.auth_id!==uid||result.data.tipo_cuenta!=='personal')throw Error('La cuenta remota no es personal.');
  check(uid,stamp);return result.data.id;
 }
 async function readAll(table,stamp,uid){
  const count=await remoteQuery(remote.from(table).select('id',{count:'exact',head:true}),'Conteo '+table);
  if(!Number.isSafeInteger(count.count)||count.count<0)throw Error('Conteo remoto inválido: '+table);
  const result=[],seen=new Set();
  for(let i=0;i<count.count;i+=400){
   check(uid,stamp);
   const part=await remoteQuery(remote.from(table).select('*').order('id',{ascending:true}).range(i,i+399),'Leer '+table);
   if(!Array.isArray(part.data)||part.data.length!==Math.min(400,count.count-i))throw Error('Descarga incompleta: '+table);
   for(const row of part.data){if(!UUID.test(row.id)||seen.has(row.id))throw Error('Registro repetido o inválido en '+table);
    seen.add(row.id);result.push(row);}
  }
  return result;
 }
 async function readTables(uid,stamp,profileId){
  // El usuario puede tener varios perfiles REMOTOS; descargar solo el activo.
  const all={};for(const name of CLOUD_TABLES.slice(1))all[name]=await readAll(name,stamp,uid);
  const one=(table,filter)=>all[table].filter(filter);
  const ret={tbl_perfiles:one('tbl_perfiles',x=>x.id===profileId)};
  const ids=rows=>new Set(rows.map(x=>x.id));
  const gymIds=ids(ret.tbl_gimnasios=one('tbl_gimnasios',x=>x.perfil_id===profileId));
  const siteIds=ids(ret.tbl_sedes=one('tbl_sedes',x=>gymIds.has(x.gimnasio_id)));
  const exerciseIds=ids(ret.tbl_ejercicios=one('tbl_ejercicios',x=>x.perfil_id===profileId));
  ret.tbl_ejercicio_detalles=one('tbl_ejercicio_detalles',x=>exerciseIds.has(x.ejercicio_id));
  const sessionIds=ids(ret.tbl_sesiones=one('tbl_sesiones',x=>x.perfil_id===profileId));
  ret.tbl_series=one('tbl_series',x=>sessionIds.has(x.sesion_id));
  // Validar que ninguna fila importada remita a un objeto ajeno.
  for(const s of ret.tbl_sesiones)if(s.sede_id&&!siteIds.has(s.sede_id))throw Error('Sesión vinculada a otra sede');
  for(const r of ret.tbl_series)if(!exerciseIds.has(r.ejercicio_id))throw Error('Serie vinculada a otro ejercicio');
  return ret;
 }
 async function upload(uid,stamp,{automatic=false}={}){
  if(busy)throw Error('Hay otra sincronización activa.');
  check(uid,stamp);
  const state=getState(),profileId=state.profileId;
  const local=await prepareGymlyticsTables(state.data,profileId,state.profileName,uid);
  if(!automatic&&!confirmAction('¿Sincronizar el perfil «'+state.profileName+'» con sch_gymlytics? Se conservarán los UUID y no se sobrescribirán cambios remotos conflictivos.'))return null;
  busy=true;refresh();
  try{
   await ensureUser(uid,stamp);
   const remoteRows=await readTables(uid,stamp,profileId);
   check(uid,stamp);
   const snapshot=state.data.cloudV2?.baseline||{};
   const diff=detectCloudConflicts(local,remoteRows,snapshot);
   if(diff.conflicts.length)throw Error('Hay '+diff.conflicts.length+' registros con versiones distintas. Descarga y revisa primero. Ejemplo: '+diff.conflicts[0]);
   let done=0;
   for(const table of CLOUD_TABLES.slice(1)){
    for(let i=0;i<diff.changed[table].put.length;i+=160){
     check(uid,stamp);
     const chunk=diff.changed[table].put.slice(i,i+160);
     await remoteQuery(remote.from(table).upsert(chunk,{onConflict:'id'}),'Subir '+table);
     done+=chunk.length;
     if(done%800<160)notify('Sincronizando: '+done+' registros confirmados en sch_gymlytics…');
    }
   }
   for(const table of [...CLOUD_TABLES.slice(1)].reverse()){
    for(let i=0;i<diff.changed[table].del.length;i+=150){
     check(uid,stamp);
     await remoteQuery(remote.from(table).delete().in('id',diff.changed[table].del.slice(i,i+150)),'Eliminar '+table);
    }
   }
   check(uid,stamp);
   await mutate(data=>{
    const base={};for(const table of CLOUD_TABLES.slice(1))
     base[table]=Object.fromEntries(local[table].map(row=>[row.id,plain(row)]));
    data.cloudV2={version:MODEL_VERSION,userId:uid,baseline:base,lastPush:new Date().toISOString()};
    data.pending=arr(data.pending).filter(p=>!['create_series','delete_series','update_series','add_catalog','update_catalog','delete_catalog'].includes(p.kind));
    data.tombstones=arr(data.tombstones).filter(t=>t.photoKey);
    data.cloudUserId=uid;data.demo=false;
   });
   refresh();notify('✅ Datos sincronizados con sch_gymlytics: '+done+' registros actualizados, '+diff.deletions+' eliminaciones. Perfil local conservado.');
   return {done,deleted:diff.deletions};
  }finally{busy=false;refresh();}
 }
 async function download(uid,stamp){
  if(busy)throw Error('Hay otra sincronización activa.');
  check(uid,stamp);
  const {profileName}=getState();
  if(!confirmAction('¿Descargar datos de sch_gymlytics a «'+profileName+'»? Los registros locales se conservarán; no se sustituirán elementos con cambios diferentes.'))return null;
  busy=true;refresh();
  try{
   await ensureUser(uid,stamp);
   const profileId=getState().profileId;
   const tables=await readTables(uid,stamp,profileId);check(uid,stamp);
   const state=getState(),local=await prepareGymlyticsTables(state.data,state.profileId,state.profileName,uid);
   const conflicts=detectCloudConflicts(local,tables,state.data.cloudV2?.baseline).conflicts;
   if(conflicts.length)throw Error('Descarga detenida: '+conflicts.length+' identificadores tienen cambios distintos. Ejemplo: '+conflicts[0]);
   // Construir TODO antes de una única escritura IndexedDB (sin reemplazar filas locales).
   const gs=byId(tables.tbl_gimnasios),ss=byId(tables.tbl_sedes),es=byId(tables.tbl_ejercicios),se=byId(tables.tbl_sesiones);
   const detailMap=new Map();
   for(const d of tables.tbl_ejercicio_detalles){if(!detailMap.has(d.ejercicio_id))detailMap.set(d.ejercicio_id,[]);
    detailMap.get(d.ejercicio_id).push(d);}
   const remoteRecords=tables.tbl_series.map(r=>{
    const ses=se.get(r.sesion_id),sit=ss.get(ses?.sede_id),gym=gs.get(sit?.gimnasio_id),ex=es.get(r.ejercicio_id);
    if(!ses||!ex)throw Error('La nube contiene una serie sin sesión o ejercicio: '+r.id);
    const ds=detailMap.get(ex.id)||[],get=k=>ds.find(x=>x.campo===k)?.valor||'No especificado';
    return {id:r.id,origin:'cloud-v2',date:ses.fecha_hora.slice(0,10),createdAt:dateTime(ses.fecha_hora).replace(' ','T')+':00',
     gym:gym?.nombre||'Sin gimnasio',sede:sit?.nombre||'Única',gymId:gym?.id||null,siteId:sit?.id||null,
     exerciseId:ex.id,sessionId:ses.id,exercise:ex.nombre,zone:get('Anotación'),equipment:get('Máquina')||get('Instrumento'),
     accessory:get('Agarre / Implemento'),technique:get('Técnica'),type:'Otro',grip:'No especificado',
     series:'Serie '+r.numero_serie,subdivision:r.subdivision||'-',weight:r.peso===null?null:Number(r.peso),
     unit:r.unidad,reps:Number(r.repeticiones),assistance:r.asistencia_pausa??null,notes:r.otros_detalles||''};
   });
   check(uid,stamp);
   let added=0;
   await mutate(data=>{
    data.entities??={gyms:[],sites:[],machines:[],options:[]};
    const merge=(target,received)=>{const used=new Set(target.map(x=>x.id));
     for(const x of received)if(!used.has(x.id)){target.push(x);used.add(x.id);}};
    merge(data.entities.gyms,tables.tbl_gimnasios.map(x=>({id:x.id,nombre:x.nombre})));
    merge(data.entities.sites,tables.tbl_sedes.map(x=>({id:x.id,gimnasio_id:x.gimnasio_id,nombre:x.nombre,latitud:x.latitud,longitud:x.longitud})));
    merge(data.library??=[],tables.tbl_ejercicios.map(x=>({id:x.id,nombre:x.nombre,
     detalles:(detailMap.get(x.id)||[]).map(d=>({id:d.id,campo:d.campo,valor:d.valor,orden:d.orden})),
     origen:'nube'})));
    merge(data.sessions??=[],tables.tbl_sesiones.map(x=>({id:x.id,sede_id:x.sede_id,fecha_hora:x.fecha_hora,notas:x.notas})));
    const existing=new Set(arr(data.records).map(x=>x.id));
    data.records??=[];
    for(const x of remoteRecords)if(!existing.has(x.id)){data.records.push(x);existing.add(x.id);added++;}
    data.cloudUserId=uid;data.demo=false;data.lastPull=new Date().toISOString();
    // No registrar baseline para datos que aún NO se han enviado; de lo contrario
    // la siguiente subida podría interpretar registros locales nuevos como eliminaciones.
    const base=data.cloudV2?.baseline||{};
    for(const table of CLOUD_TABLES.slice(1)){
     base[table]??={};
     for(const row of tables[table])base[table][row.id]=plain(row);
    }
    data.cloudV2={version:MODEL_VERSION,userId:uid,baseline:base,lastPull:data.lastPull};
   });
   refresh();notify('✅ Descarga completa: '+added+' series incorporadas a «'+profileName+'», sin borrar datos locales.');
   return {added};
  }finally{busy=false;refresh();}
 }
 async function resolve(){throw Error('La nueva estructura no sobrescribe conflictos automáticamente. Revisa el perfil local y remoto.');}
 return {upload,download,resolve,isBusy,ensureUser};
}