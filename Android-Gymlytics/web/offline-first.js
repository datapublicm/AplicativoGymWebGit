/* Gymlytics 01.06 (pruebas): datos locales separados por perfil.
 * La nube solo se consulta por acción expresa: nunca se reconcilia por estar online.
 */
import { createClient } from '@supabase/supabase-js';
import {sourceKey} from './sync-engine.js';
import {createCloudSync} from './cloud-sync.js';
import {profileMeta,validateProfileName,validateProfileBinding,verifyRestoreBackup} from './profile-policy.js';
import {prepareDownloadedCatalog} from './offline-catalog-download.js';
import {materializeReferenceCatalog,parseReferenceId,setReferenceOverride,listReferenceChoices} from './reference-overrides.js';
import {photoLocalKey,migrateLegacyPhotoJobs} from './photo-sync-engine.js';
import {GYMLYTICS_SEED_PATH,GYMLYTICS_SEED_MARKER,installGymlyticsSeed} from './gymlytics-seed-offline.mjs';
import {createGymlyticsCloudSync} from './gymlytics-cloud-v2.mjs';
const $=id=>document.getElementById(id);
const DB_NAME='gymlytics_offline_profiles_v1', EMPTY=()=>({
 records:[],photos:{},photoVersions:{},photoPayloads:{},baseCatalog:[],referenceOverrides:{},muscles:[],custom:[],library:[],readOnly:false,demo:false,
 entities:{gyms:[],sites:[],machines:[],options:[]},
 tombstones:[],pending:[],conflicts:[],cloudUserId:null,lastPull:null,syncMode:'later'
});
const uuid=()=>crypto.randomUUID();
const tidy=v=>String(v??'').trim();
let db,profiles=[],activeId=null,profileEpoch=0,latest=null,queue=Promise.resolve(),remoteSession=null,cloudAccountKind=null,syncController=null,transitioning=false,offlineInitError=null;
const config={url:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
 schema:import.meta.env.VITE_SUPABASE_SCHEMA||'sch_gymlytics'};
const newClient=()=>config.url&&config.key?createClient(config.url,config.key,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,
  storageKey:'gymlytics-profile-memory-'+crypto.randomUUID()}
}):null;
let client=newClient(),remote=client?.schema(config.schema);
function rotateCloudClient(){client=newClient();remote=client?.schema(config.schema);remoteSession=null;cloudAccountKind=null;}
const remoteGateway={
 from:(...args)=>{if(!remote)throw Error('Supabase no está configurado');return remote.from(...args)},
 rpc:(...args)=>{if(!remote)throw Error('Supabase no está configurado');return remote.rpc(...args)},
 storage:{from:(...args)=>{if(!client)throw Error('Supabase no está configurado');return client.storage.from(...args)}}
};
function openDB(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{
   const store=request.result.createObjectStore('profiles',{keyPath:'id'});
   store.createIndex('modifiedAt','modifiedAt');
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
function requestFrom(store,mode,action){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('profiles',mode),req=action(tx.objectStore('profiles'));
  let result;req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}
const get=id=>requestFrom('profiles','readonly',s=>s.get(id));
const all=()=>requestFrom('profiles','readonly',s=>s.getAll());
const put=p=>requestFrom('profiles','readwrite',s=>s.put(p));
const current=()=>profiles.find(p=>p.id===activeId);
const stamp=()=>activeId+':'+profileEpoch;
const snapshot=()=>structuredClone(latest?.data||EMPTY());
const flush=(update)=>{
 if(transitioning)return Promise.reject(Error('Espera a que termine el cambio de perfil.'));
 const captured=activeId,epoch=profileEpoch;
 const task=queue.then(async()=>{
  if(!captured||captured!==activeId||epoch!==profileEpoch)throw Error('Cambiaste de perfil durante la operación.');
  const profile=await get(captured);
  if(!profile||epoch!==profileEpoch)throw Error('El perfil dejó de estar disponible.');
  const data=structuredClone(profile.data||EMPTY());
  const result=await update(data);
  if(epoch!==profileEpoch||captured!==activeId)throw Error('Cambiaste de perfil durante la operación.');
  profile.data=data;profile.modifiedAt=new Date().toISOString();
  await put(profile);latest=profile;
  profiles=profiles.map(p=>p.id===profile.id?profileMeta(profile):p);
  renderSyncStatus();
  return result;
 });
 queue=task.catch(()=>{});
 return task;
};
function status(message){$('authStatus').textContent=message;}
function renderSyncStatus(){
 if(!latest)return;
 const data=latest.data,counts=(data.pending||[]).length,deleted=(data.tombstones||[]).length;
 const oldPhotos=(data.pending||[]).filter(x=>x.kind==='photo'&&!x.photoKey).length;
 $('offlinePending').textContent=counts+' operaciones pendientes · '+deleted+' eliminaciones conservadas'+
  (oldPhotos?' · '+oldPhotos+' fotos antiguas necesitan volver a seleccionarse':'');
 $('offlineProfileInfo').textContent=(data.demo?'PRUEBA · EDICIÓN LOCAL · ':'Perfil offline · ')+latest.name+' · '+data.records.length+' series visibles'+(data.importInfo?.weightUnit?' · peso histórico: unidad sin especificar':'');
 $('offlineConflictSummary').textContent=(data.conflicts||[]).length+' conflictos por revisar';
 $('offlineSyncState').textContent=data.demo&&!data.cloudUserId?'Cuenta de prueba descargada: puedes agregar, modificar y eliminar datos offline.':
  data.cloudUserId?'Cuenta personal asociada · '+(data.syncMode==='instant'?'sincronización automática':'actualización manual')+'.':
  'No vinculado · todos los cambios se guardan en este dispositivo.';
}
function catalogInit(){
 const source=Array.isArray(latest?.data?.baseCatalog)?latest.data.baseCatalog:[];
 const map=latest?.data?.referenceOverrides||{};
 window.GymReferenceCatalog=structuredClone(source);
 window.GymReferenceOverrides=structuredClone(map);
 window.GymReferenceChoices=(kind,ctx)=>listReferenceChoices(
  latest?.data?.baseCatalog||[],latest?.data?.referenceOverrides||{},kind,ctx);
 return materializeReferenceCatalog(source,map).map(x=>({
  ...x,t:[...(x.t||[])],n:0,last:null
 }));
}
function personalCatalogInit(){
 const entities=latest?.data?.entities||EMPTY().entities;
 const gyms=new Map(entities.gyms.map(x=>[String(x.id),x.nombre]));
 const sites=new Map(entities.sites.map(x=>[String(x.id),x.nombre]));
 return (latest?.data?.custom||[]).map(x=>({
  ...x,g:gyms.get(String(x.gimnasio_id))||x.g,
  s:sites.get(String(x.sede_id))||x.s,
  e:x.nombre||x.e
 }));
}
async function activate(id,initial=false){
 if(transitioning)throw Error('Hay un cambio de perfil en curso.');
 if(syncController?.isBusy())throw Error('Termina la sincronización antes de cambiar de perfil.');
 if(!profiles.some(p=>p.id===id))throw Error('Perfil inexistente');
 transitioning=true;
 const previous=activeId;
 $('offlineProfiles').disabled=true;
 try{
  // Finalizar escrituras pendientes de A antes de invalidar su sello de sesión.
  await queue;
  const epoch=++profileEpoch;
  if(typeof invalidatePendingSave==='function')invalidatePendingSave();
  if(typeof showHistoryLoadProgress==='function')showHistoryLoadProgress(null,null);
  if(typeof setHistoryReady==='function')setHistoryReady(false);
  rotateCloudClient();
  activeId=null;latest=null;
  model.records=[];model.photos={};
  window.GymBaseCatalog=[];window.GymReferenceCatalog=[];window.GymReferenceOverrides={};window.GymReferenceChoices=()=>[];window.GymCustomCatalog=[];window.GymExerciseLibrary=[];
  window.GymEntities={gyms:[],sites:[],machines:[],options:[]};
  drawRecent();drawHistory();drawReports();
  const p=await get(id);
  if(!p||epoch!==profileEpoch)throw Error('No se pudo abrir el nuevo perfil.');
  // Migración segura: la restricción de la cuenta de prueba solo afecta a Supabase.
  const wasReadOnly=!!p.data?.readOnly;
  if(wasReadOnly){p.data.demo=true;p.data.readOnly=false;p.data.cloudUserId=null;}
  // Convertir fotografías JPEG pendientes de la versión anterior sin perder archivos.
  // Las anatómicas antiguas sin vista identificable quedan intactas y requieren
  // que se seleccione nuevamente la vista: nunca adivinar frontal/posterior.
  const legacyPhotos=migrateLegacyPhotoJobs(p.data);
  if(legacyPhotos.converted||legacyPhotos.removed||wasReadOnly)await put(p);
  activeId=id;latest=p;profiles=(await all()).map(profileMeta);
  $('offlineProfiles').replaceChildren(...profiles.map(x=>new Option(x.demo?'◌ '+x.name+' · prueba':x.name,x.id)));
  $('offlineProfiles').value=id;
  window.GymBaseCatalog=catalogInit();
  window.GymEntities=structuredClone(p.data.entities||EMPTY().entities);
  window.GymExerciseLibrary=structuredClone(p.data.library||[]);
  window.GymCustomCatalog=personalCatalogInit();
  model.records=structuredClone(p.data.records||[]);
  model.photos=structuredClone(p.data.photos||{});
  if(typeof resetHistoryFilters==='function')resetHistoryFilters();
  if(typeof resetExerciseTabs==='function')resetExerciseTabs();
  if(typeof renderOwnCatalog==='function')renderOwnCatalog();
  if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
  catalogUpdate();
  if(typeof cascade==='function')cascade(0);
  drawRecent();drawHistory();drawReports();
  if(typeof setHistoryReady==='function')setHistoryReady(true);
  $('historyRefresh').disabled=false;$('catalogRefresh').disabled=false;
  $('offlineCloudPanel').hidden=true;$('offlineRemoteUser').textContent='';
  localStorage.setItem('gymlytics-active-profile',id);
  renderSyncStatus();renderProfileControls();
  status('Perfil local editable · '+p.name+' · funciona sin conexión');
  document.body.classList.remove('auth-locked');
  document.querySelectorAll('[data-page]').forEach(x=>{x.disabled=false;x.setAttribute('aria-disabled','false');});
  renderConflictButtons();refreshCloudControls();
  if(initial)showPage('sesion');
 }catch(error){
  $('offlineProfiles').value=previous||'';
  status('No se completó el cambio de perfil: '+error.message);
  throw error;
 }finally{transitioning=false;$('offlineProfiles').disabled=false;}
}
async function createProfile(){
 if(transitioning||syncController?.isBusy())throw Error('Termina la operación actual.');
 const name=validateProfileName($('offlineNewName').value,profiles);
 const p={id:uuid(),name,modifiedAt:new Date().toISOString(),data:EMPTY()};
 await put(p);profiles.push(profileMeta(p));$('offlineNewName').value='';
 await activate(p.id);
 status('Perfil local creado. Los registros de los demás perfiles se mantienen separados.');
}
function renderProfileControls(){
 const control=$('offlineRenameName');if(control)control.value=latest?.name||'';
 const count=$('offlineProfileCount');
 if(count)count.textContent=profiles.length+' perfiles locales independientes';
 const del=document.querySelector('[data-profile-action="delete"]');if(del)del.disabled=profiles.length<2;
 const hint=$('offlineReadOnlyWarning');if(hint)hint.hidden=true;
 document.querySelectorAll('#page-catalogos [data-catalog-quick],#page-catalogos .catalog-compact-toggle,#page-catalogos [data-catalog-modify],#page-catalogos .catalog-form button[type=submit],#page-registro #saveRecords,#page-registro #clearSeries,#page-registro #addSeriesGroup,#page-registro #removeSeriesGroup').forEach(b=>{b.disabled=false;b.title='';});
}
async function renameProfile(){
 if(transitioning||syncController?.isBusy())throw Error('Termina la operación actual.');
 const id=activeId,epoch=profileEpoch,name=validateProfileName($('offlineRenameName').value,profiles,activeId);
 if(!id)throw Error('Selecciona un perfil.');
 await queue;
 if(id!==activeId||epoch!==profileEpoch||transitioning)throw Error('El perfil cambió antes de renombrar.');
 const profile=await get(id);if(!profile)throw Error('Perfil inexistente.');
 if(id!==activeId||epoch!==profileEpoch||transitioning)throw Error('El perfil cambió durante el renombrado.');
 profile.name=name;profile.modifiedAt=new Date().toISOString();
 await put(profile);
 if(id!==activeId||epoch!==profileEpoch||transitioning)return;
 latest=profile;profiles=profiles.map(x=>x.id===profile.id?profileMeta(profile):x);
 const item=[...$('offlineProfiles').options].find(x=>x.value===profile.id);
 if(item)item.textContent=latest?.data?.demo?'◌ '+name+' · prueba':name;
 renderSyncStatus();renderProfileControls();
 status('Perfil renombrado sin modificar registros ni vínculos de nube.');
}

async function deleteActiveProfile(){
 if(transitioning||syncController?.isBusy())throw Error('Termina la operación actual.');
 if(profiles.length<2)throw Error('No se puede eliminar el único perfil local.');
 const deleting=activeId,profile=await get(deleting),replacement=profiles.find(x=>x.id!==deleting);
 if(!profile||!replacement)throw Error('No hay otro perfil disponible.');
 if(!confirm('¿Eliminar definitivamente el perfil local «'+profile.name+'» y todos sus datos guardados en este dispositivo? Esta acción no elimina datos de Supabase. Se recomienda respaldarlo antes.'))return false;
 if(deleting!==activeId||transitioning||syncController?.isBusy())throw Error('El perfil cambió; no se eliminó nada.');
 // Activar primero el destino: se terminan guardados pendientes y se invalida
 // la sesión de nube antes de borrar el perfil saliente.
 await activate(replacement.id);
 await requestFrom('profiles','readwrite',store=>store.delete(deleting));
 profiles=(await all()).map(profileMeta);
 const select=$('offlineProfiles');
 select.replaceChildren(...profiles.map(x=>new Option(x.name,x.id)));
 select.value=replacement.id;
 renderProfileControls();
 status('Perfil eliminado únicamente de este dispositivo. La cuenta en Supabase, si existe, no ha cambiado.');
 return true;
}
function catalogUpdate(){
 window.GymBaseCatalog=catalogInit();
 window.GymEntities=structuredClone(latest.data.entities);
 window.GymExerciseLibrary=structuredClone(latest.data.library);
 window.GymCustomCatalog=personalCatalogInit();
 if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
 if(typeof renderOwnCatalog==='function')renderOwnCatalog();
 if(typeof cascade==='function')cascade(0);
 if(typeof catalogUpdateCounters==='function')catalogUpdateCounters();
 const muscle=$('muscleExistingSelect'),count=$('muscleCount');
 if(muscle){muscle.replaceChildren(new Option('Selecciona un músculo…',''));
  for(const row of latest.data.muscles||[])muscle.add(new Option(row.nombre,row.id));}
 if(count)count.textContent=String((latest.data.muscles||[]).length);
}
function normalizarDetallesEjercicio(values){
 const keys=[['agrupacion','Agrupación'],['anotacion','Anotación'],['instrumento','Instrumento'],
  ['agarre_implemento','Agarre / Implemento'],['tecnica','Técnica']];
 const result=keys.map(([key,campo])=>({campo,valor:tidy(values[key]).slice(0,500)})).filter(x=>x.valor);
 let extras=[];
 try{extras=typeof values.detalles_extra==='string'?JSON.parse(values.detalles_extra):values.detalles_extra||[]}
 catch{throw Error('Los detalles adicionales no tienen formato válido');}
 if(!Array.isArray(extras)||extras.length>30)throw Error('Máximo 30 detalles adicionales por ejercicio');
 for(const x of extras){
  const campo=tidy(x.campo).slice(0,120),valor=tidy(x.valor).slice(0,500);
  if(campo&&valor)result.push({campo,valor});
 }
 return result;
}
const groups={gym:'gyms',site:'sites',machine:'machines',option:'options',exercise:'library'};
function presentCatalog(kind){
 return kind==='exercise'?[...latest.data.library,...latest.data.custom.map(x=>({id:x.cloud_id,nombre:x.e}))]:
  latest.data.entities[groups[kind]];
}
const writeStatus=()=>{
 if(transitioning)return {code:'switching',message:'Se está cambiando de perfil. Espera a que finalice antes de guardar.'};
 if(offlineInitError&&!latest)return {code:'error',message:'El almacenamiento local no pudo iniciarse: '+offlineInitError+'. Ve a Perfil para revisar el estado. No borres los datos de la aplicación.'};
 if(!activeId||!latest)return {code:'loading',message:'El perfil local aún no termina de cargarse. Ve a Perfil y comprueba que diga «Perfil local editable».'};
 return {code:'ready',message:'Perfil «'+latest.name+'» listo para guardar offline.'};
};
const assertEditable=()=>{
 const state=writeStatus();
 if(state.code!=='ready')throw Error(state.message);
};
const api={
 canWrite:()=>!!activeId&&!!latest&&!transitioning,
 getWriteStatus:writeStatus,
 canRead:()=>!!activeId&&!!latest,
 getSessionStamp:stamp,
 async refreshCatalog(){window.GymBaseCatalog=catalogInit();if(typeof cascade==='function')cascade(0);return window.GymBaseCatalog.length},
 async loadInitialCatalog(){return catalogInit()},
 async loadOwnCatalog(){return structuredClone(latest.data.custom)},
 async loadIndependentCatalog(){catalogUpdate();return structuredClone(latest.data.entities)},
 async loadHistory(){return structuredClone(latest.data.records)},
 async loadCatalogStats(){catalogUpdate()},
 async saveWorkout({exercise,date,technique,notes,entries}){
  assertEditable();
  if(syncController?.isBusy())throw Error('Sincronización en curso; espera antes de editar o registrar series');
  if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Array.isArray(entries)||!entries.length)
   throw Error('Fecha o series inválidas');
  const records=entries.map(entry=>{
   const weight=Number(entry.weight),reps=Number(entry.reps),assistance=Number(entry.assistance||0);
   if(!Number.isFinite(weight)||weight<0||!Number.isFinite(reps)||reps<=0||!Number.isFinite(assistance)||assistance<0||!['kg','lb'].includes(entry.unit))
    throw Error('Peso, repeticiones o asistencias inválidos');
   return {id:uuid(),origin:'offline',date,gym:exercise.g,sede:exercise.s,
    exerciseId:exercise.exerciseId||null,
    zone:exercise.z,type:exercise.kind,equipment:exercise.i,accessory:exercise.a,
    grip:exercise.gr,exercise:exercise.e,technique,notes,series:entry.series,
    subdivision:entry.sub||'-',weight,reps,assistance,unit:entry.unit,
    createdAt:new Date().toISOString(),remoteId:null};
  });
  await flush(data=>{
   data.records.push(...records);
   data.pending.push(...records.map(r=>({id:uuid(),kind:'create_series',localId:r.id,createdAt:r.createdAt})));
  });
  return records.length;
 },
 async deleteSeries(id){
  assertEditable();
  if(syncController?.isBusy())throw Error('Sincronización en curso; espera antes de editar o registrar series');
  await flush(data=>{
   const index=data.records.findIndex(x=>String(x.id)===String(id));
   if(index<0)throw Error('La serie no pertenece al perfil');
   const [row]=data.records.splice(index,1),key=sourceKey(row),version=Number(row.cloudVersion||0);
   // Nunca olvidar un alta enviada si se perdió su ACK. El servidor
   // puede haberla recibido; primero reintentar la creación inmutable y
   // después enviar una eliminación versionada.
   const inFlight=data.pending.some(x=>x.localId===row.id&&x.submittedRequest);
   data.pending=data.pending.filter(x=>x.localId!==row.id||x.submittedRequest);
   data.tombstones.push({localId:row.id,remoteId:row.remoteId||null,syncKey:key,
    at:new Date().toISOString(),cloudVersion:version});
   if(inFlight||version||row.origin==='cloud')
    data.pending.push({id:uuid(),kind:'delete_series',localId:row.id,remoteId:row.remoteId||null,
     syncKey:key,expectedVersion:version});
  });return id;
 },
 async updateSeries(id,patch){
  assertEditable();
  if(syncController?.isBusy())throw Error('Sincronización en curso; espera antes de editar o registrar series');
  await flush(data=>{
   const row=data.records.find(x=>x.id===id);
   if(!row)throw Error('Serie no encontrada');
   for(const field of ['weight','reps','assistance','unit','notes']){
    if(!(field in patch))continue;
    const value=field==='unit'||field==='notes'?String(patch[field]):Number(patch[field]);
    if(field==='unit'&&!['kg','lb'].includes(value))throw Error('Unidad incorrecta');
    if(['weight','reps','assistance'].includes(field)&&(!Number.isFinite(value)||value<0||field==='reps'&&value<=0))
     throw Error('Valor inválido');
    row[field]=value;
   }
   // Las operaciones ya enviadas no se reescriben; si hubo corte de
   // red, la modificación posterior recibe un UUID nuevo y espera el ACK.
   const pending=data.pending.filter(x=>x.localId===id);
   const queued=pending.find(x=>!x.submittedRequest&&
    (x.kind==='create_series'||x.kind==='update_series'));
   if(!queued){
    data.pending.push({id:uuid(),kind:'update_series',localId:id,syncKey:sourceKey(row),
     expectedVersion:Number(row.cloudVersion||0)});
   }
  });return id;
 },
 async addIndependentItem(kind,values){
  assertEditable();
  const group=groups[kind];if(!group||kind==='exercise')throw Error('Tipo no válido');
  const nombre=tidy(values.nombre);
  if(!nombre||nombre.length>180)throw Error('Escribe un nombre válido');
  return flush(data=>{
   const target=data.entities[group];
   // Si el gimnasio seleccionado es una referencia del catálogo base, crear
   // su copia local antes de añadir la sede, conservando una relación por ID.
   if(kind==='site'&&String(values.gimnasio_id||'').startsWith('base:')){
    const ref=parseReferenceId(String(values.gimnasio_id));
    if(!ref||ref.kind!=='gym')throw Error('Referencia de gimnasio inválida');
    const visible=listReferenceChoices(data.baseCatalog,data.referenceOverrides||{},'gym').find(x=>x.id===values.gimnasio_id);
    if(!visible)throw Error('El gimnasio fue eliminado del catálogo local');
    const gymName=visible.name;
    let gym=data.entities.gyms.find(row=>tidy(row.nombre).toLocaleLowerCase('es')===gymName.toLocaleLowerCase('es'));
    if(!gym){gym={id:uuid(),nombre:gymName};data.entities.gyms.push(gym);
     data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'gym',localId:gym.id});}
    values={...values,gimnasio_id:gym.id};
   }
   if(target.some(x=>x.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es')&&
    (kind!=='site'||x.gimnasio_id===values.gimnasio_id)&&
    (kind!=='option'||x.tipo===values.tipo)))throw Error('Ya existe ese elemento');
   if(kind==='site'&&!data.entities.gyms.some(x=>x.id===values.gimnasio_id))throw Error('Selecciona un gimnasio existente');
   const item={id:uuid(),nombre,...kind==='site'?{gimnasio_id:values.gimnasio_id}:{},
    ...kind==='machine'?{tipo_equipo:values.tipo_equipo||'Otro'}:{},
    ...kind==='option'?{tipo:values.tipo||'zona'}:{}};
   target.push(item);data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:kind,localId:item.id});
   // Cada nuevo gimnasio comienza con una sede «Única», renombrable.
   if(kind==='gym'){
    const site={id:uuid(),nombre:'Única',gimnasio_id:item.id,latitud:null,longitud:null};
    data.entities.sites.push(site);
    data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'site',localId:site.id});
   }
   return item.id;
  }).then(result=>{catalogUpdate();return result;});
 },
 async updateSiteGPS(id,latitude,longitude){
  assertEditable();
  // No requiere conexión ni permisos de Supabase.
  const lat=latitude===''||latitude==null?null:Number(latitude);
  const lon=longitude===''||longitude==null?null:Number(longitude);
  if((lat===null)!==(lon===null)||lat!==null&&(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lon)||lon < -180||lon > 180))
   throw Error('Las coordenadas deben incluir latitud (-90 a 90) y longitud (-180 a 180).');
  const savedId=await flush(data=>{
   let site=data.entities.sites.find(x=>String(x.id)===String(id));
   if(!site&&String(id).startsWith('base:')){
    const ref=parseReferenceId(String(id));
    if(!ref||ref.kind!=='site')throw Error('La referencia seleccionada no es una sede.');
    const references=data.baseCatalog,overrides=data.referenceOverrides||{};
    const visibleSite=listReferenceChoices(references,overrides,'site').find(x=>x.id===id);
    const visibleGym=listReferenceChoices(references,overrides,'gym').find(x=>x.sourceName===ref.gym);
    if(!visibleSite||!visibleGym)throw Error('La sede descargada ya no existe.');
    let gym=data.entities.gyms.find(x=>tidy(x.nombre).toLocaleLowerCase('es')===tidy(visibleGym.name).toLocaleLowerCase('es'));
    if(!gym){
     gym={id:uuid(),nombre:visibleGym.name};data.entities.gyms.push(gym);
     data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'gym',localId:gym.id});
    }
    site=data.entities.sites.find(x=>x.gimnasio_id===gym.id&&tidy(x.nombre).toLocaleLowerCase('es')===tidy(visibleSite.name).toLocaleLowerCase('es'));
    if(!site){
     site={id:uuid(),nombre:visibleSite.name,gimnasio_id:gym.id};
     data.entities.sites.push(site);
     data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'site',localId:site.id});
    }
   }
   if(!site)throw Error('Selecciona primero una sede disponible.');
   site.latitud=lat;site.longitud=lon;site.modificado_en=new Date().toISOString();
   data.pending.push({id:uuid(),kind:'update_catalog',catalogKind:'site',localId:site.id});
   return site.id;
  });
  catalogUpdate();return savedId;
 },
 async updateExerciseDetails(id,values){
  assertEditable();
  await flush(data=>{
   const row=data.library.find(x=>String(x.id)===String(id));
   if(!row)throw Error('Selecciona un ejercicio de tu perfil local.');
   row.detalles=normalizarDetallesEjercicio(values);
   row.zona_entrenamiento=tidy(values.anotacion||values.z)||'Sin clasificar';
   row.tecnica_actualizada=tidy(values.tecnica)||'Ejecución base';
   data.pending.push({id:uuid(),kind:'update_catalog',catalogKind:'exercise',localId:id});
  });
  catalogUpdate();return id;
 },
 async saveCustomExercise(values){
  assertEditable();
  const nombre=tidy(values.e);
  if(!nombre)throw Error('Escribe un nombre de ejercicio');
  await flush(data=>{
   // Los ejercicios pueden compartir nombre: cada variante conserva su UUID.
   const id=uuid(),detalles=normalizarDetallesEjercicio(values);
   data.library.push({id,nombre,origen:'usuario',zona_entrenamiento:tidy(values.anotacion||values.z)||'Sin clasificar',
    tecnica_actualizada:tidy(values.tecnica)||'Ejecución base',detalles});
   data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'exercise',localId:id});
  });catalogUpdate();return structuredClone(latest.data.custom);
 },
 async updateCatalogItem(kind,id,name){
  assertEditable();
  name=tidy(name);if(!name)throw Error('Introduce el nombre nuevo');
  if(String(id).startsWith('base:')){
   await flush(data=>{
    const ref=parseReferenceId(id);
    if(!ref||!['gym','site','machine','exercise','zone','grip','technique'].includes(ref.kind))
     throw Error('Referencia inválida');
    if(kind!==ref.kind&&!(kind==='option'&&['zone','grip','technique'].includes(ref.kind)))
     throw Error('Tipo de referencia incorrecto');
    data.referenceOverrides=setReferenceOverride(data.baseCatalog,data.referenceOverrides||{},id,{name});
   });
   catalogUpdate();return id;
  }
  await flush(data=>{
   const list=kind==='exercise'
    ?(data.library.some(x=>String(x.id)===String(id))?data.library:data.custom)
    :data.entities[groups[kind]];
   if(!list)throw Error('Categoría inválida');
   const item=list.find(x=>String(x.id||x.cloud_id)===String(id));
   if(!item)throw Error('No se encontró el elemento personal');
   if(kind!=='exercise'&&list.some(x=>x.id!==id&&tidy(x.nombre).toLocaleLowerCase('es')===name.toLocaleLowerCase('es')&&
     (kind!=='site'||x.gimnasio_id===item.gimnasio_id)&&
     (kind!=='option'||x.tipo===item.tipo)))throw Error('Ya existe otro elemento con ese nombre');
   item.nombre=name;
   if(kind==='exercise'&&item.cloud_id)item.e=name;
   // Un intento con conflicto NO quedó confirmado: la nueva edición habilita
   // reintento con UUID nuevo sin reutilizar la solicitud anterior.
   const conflicted=data.conflicts?.some(x=>x.kind==='catalog_conflict'&&x.catalogKind===kind&&x.localId===id);
   if(conflicted){
    data.conflicts=data.conflicts.filter(x=>!(x.kind==='catalog_conflict'&&x.catalogKind===kind&&x.localId===id));
    for(const op of data.pending.filter(x=>x.catalogKind===kind&&x.localId===id)){
     delete op.submittedRequest;delete op.attemptedAt;
    }
   }
   data.pending.push({id:uuid(),kind:'update_catalog',catalogKind:kind,localId:id});
  });catalogUpdate();return id;
 },
 async deleteCatalogItem(kind,id){
  assertEditable();
  if(String(id).startsWith('base:')){
   await flush(data=>{
    const ref=parseReferenceId(id);
    if(!ref||!(kind===ref.kind||kind==='option'&&['zone','grip','technique'].includes(ref.kind)))
     throw Error('Tipo de referencia incorrecto');
    data.referenceOverrides=setReferenceOverride(data.baseCatalog,data.referenceOverrides||{},id,{deleted:true});
   });
   catalogUpdate();return id;
  }
  await flush(data=>{
   const list=kind==='exercise'
    ?(data.library.some(x=>String(x.id)===String(id))?data.library:data.custom)
    :data.entities[groups[kind]];
   if(!list)throw Error('Categoría inválida');
   const idx=list.findIndex(x=>String(x.id||x.cloud_id)===String(id));
   if(idx<0)throw Error('No se encontró el elemento personal');
   const removed=structuredClone(list[idx]);
   if(kind==='gym'&&data.entities.sites.some(x=>x.gimnasio_id===id))
    throw Error('Este gimnasio contiene sedes');
   list.splice(idx,1);
   data.pending=data.pending.filter(x=>x.localId!==id||x.kind!=='add_catalog');
   data.pending.push({id:uuid(),kind:'delete_catalog',catalogKind:kind,localId:id});
   data.tombstones.push({catalogKind:kind,localId:id,at:new Date().toISOString(),
    cloudSnapshot:removed.cloudSnapshot||null,cloudOwnerId:removed.cloudOwnerId||null});
  });catalogUpdate();return id;
 },
 async loadAnatomy(exercise){
  const photos={};
  for(const [type,view] of [['maquina',null],['ejercicio',null],
   ...['frontal','posterior','lateral_izquierda','lateral_derecha'].map(v=>['musculos',v])]){
   const key=photoLocalKey(exercise,type,view);
   if(latest.data.photos?.[key])photos[(type==='maquina'?'maquina':type)+':'+(view||'general')]=latest.data.photos[key];
  }
  return {id:null,primary:[],secondary:[],images:{},zones3d:[],photos};
 },
 async uploadUserPhoto({exercise,type,side,blob}){
  assertEditable();
  const ownerStamp=stamp();
  if(!blob||blob.type!=='image/jpeg'||blob.size>3*1024*1024||blob.size<1)
   throw Error('Fotografía JPEG inválida o demasiado grande (máximo 3 MB)');
  const key=photoLocalKey(exercise,type,side);
  const dataUrl=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(reader.error||Error('No se pudo leer fotografía'));
   reader.readAsDataURL(blob);
  });
  if(ownerStamp!==stamp())throw Error('Cambiaste de perfil antes de guardar la fotografía');
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=\s]+$/.test(dataUrl))
   throw Error('La fotografía no pudo codificarse de forma segura');
  await flush(data=>{
   data.photoPayloads??={};data.photoVersions??={};data.photos??={};
   // Una nueva foto escogida por el usuario permite copiarla al perfil personal
   // sin heredar la revisión de la cuenta de prueba descargada.
   if(data.cloudUserId&&data.photoVersions[key]?.ownerId&&
      data.photoVersions[key].ownerId!==data.cloudUserId)delete data.photoVersions[key];
   // Los envíos ya intentados conservan su archivo inmutable.
   for(const job of [...data.pending]){
    if(job.kind==='photo'&&job.photoKey===key&&!job.submittedRequest){
     data.pending=data.pending.filter(x=>x.id!==job.id);
     delete data.photoPayloads[job.id];
    }
   }
   const id=uuid();
   data.photoPayloads[id]=dataUrl;
   data.photos[key]=dataUrl;
   data.pending.push({id,kind:'photo',photoKey:key,photoType:type,side:side||null,
    createdAt:new Date().toISOString()});
  });
  return key;
 }
};
function refreshCloudControls(){
 const linked=!!remoteSession?.user&&!transitioning;
 $('offlineRemoteUser').textContent=linked?'Conectado: '+(remoteSession.user.email||remoteSession.user.id):'Sin sesión de nube';
 const demo=cloudAccountKind==='demo';
 $('offlineLinkAccount').hidden=!linked||latest?.data?.cloudUserId===remoteSession?.user?.id;
 $('authLogout').hidden=!linked;
 $('offlineLinkAccount').disabled=!linked||demo||!!syncController?.isBusy()||!!latest?.data?.cloudUserId;
 $('offlineLinkAccount').textContent=demo?'🔒 La cuenta de prueba no puede vincularse':latest?.data?.cloudUserId?'Perfil ya vinculado a esta cuenta':'Vincular este perfil con esta cuenta';
 const personal=linked&&!demo&&latest?.data?.cloudUserId===remoteSession.user.id;
 $('offlineCloudDownload').disabled=!linked||!!syncController?.isBusy();
 $('offlineCloudDownload').textContent='↓ Descargar datos';
 $('offlineCloudUpload').hidden=false;$('offlineCloudUpload').disabled=!personal||!!syncController?.isBusy();
 $('offlineDemoDownload').hidden=true;$('offlineDemoDownload').disabled=true;
 const state=$('offlineLinkStatus');if(state)state.textContent=personal?'✅ Vinculado':latest?.data?.cloudUserId?'✅ Vinculado · inicia sesión para actualizar':'No vinculado';
 const mode=$('offlineSyncMode');if(mode){mode.closest('.offline-sync-mode').hidden=!personal;mode.value=latest?.data?.syncMode==='instant'?'instant':'later';}
}
let autoUploadTimer=null;
function scheduleAutoUpload(){
 if(autoUploadTimer)clearTimeout(autoUploadTimer);
 if(!navigator.onLine||!remoteSession?.user||cloudAccountKind!=='personal'||
    latest?.data?.cloudUserId!==remoteSession.user.id||latest?.data?.syncMode!=='instant')return;
 if(!latest?.data?.pending?.some(op=>['create_series','update_series','delete_series','add_catalog','update_catalog','delete_catalog','photo'].includes(op.kind)))return;
 autoUploadTimer=setTimeout(async()=>{
  autoUploadTimer=null;
  if(syncController?.isBusy()){scheduleAutoUpload();return;}
  try{await remoteAction('upload',{automatic:true})}
  catch(error){status('Los cambios siguen offline. Error de actualización: '+error.message)}
 },1100);
}
for(const name of ['saveWorkout','deleteSeries','updateSeries','addIndependentItem','saveCustomExercise','updateCatalogItem','deleteCatalogItem','uploadUserPhoto']){
 const action=api[name].bind(api);
 api[name]=async(...args)=>{const result=await action(...args);scheduleAutoUpload();return result;};
}
window.addEventListener('online',()=>scheduleAutoUpload());
function requireCloudIdentity(uid,ownerStamp,ownerClient=client){
 if(ownerStamp!==stamp()||ownerClient!==client||!uid||transitioning)
  throw Error('Cambiaste de perfil durante la autenticación.');
 validateProfileBinding(profiles,activeId,uid);
}
async function linkAccount(){
 const user=remoteSession?.user;
 if(!user)throw Error('Inicia sesión en la nube primero.');
 if(cloudAccountKind==='demo')throw Error('La cuenta de prueba no puede vincularse como una cuenta personal.');
 requireCloudIdentity(user.id,stamp());
 if(latest?.data?.cloudUserId===user.id)return status('Perfil ya vinculado a esta cuenta.');
 await flush(data=>{
  validateProfileBinding(profiles,activeId,user.id);
  data.cloudUserId=user.id;
  data.demo=false; // Una vinculación personal deja de mostrar el perfil como prueba.
 });
 renderSyncStatus();refreshCloudControls();
 status('Vinculado. Tus cambios se guardan localmente; elige cuándo actualizar Supabase.');
}
async function completeCloudLogin(session,ownerStamp,ownerClient){
 requireCloudIdentity(session?.user?.id,ownerStamp,ownerClient);
 try{
  // El esquema nuevo no utiliza asegurar_perfil_gymlytics ni la tabla antigua.
  await syncController.ensureUser(session.user.id,ownerStamp);
  requireCloudIdentity(session.user.id,ownerStamp,ownerClient);
  cloudAccountKind='personal';
 }catch(error){
  if(ownerStamp===stamp()&&ownerClient===client)rotateCloudClient();
  throw error;
 }
 remoteSession=session;
 await linkAccount(); // Solo marca vinculación; jamás sube datos sin permiso.
 refreshCloudControls();renderSyncStatus();
 status('✅ Vinculado con sch_gymlytics. Elige «Actualizar» para subir el perfil local.');
}
async function cloudLogin(email,password,register=false){
 if(transitioning)throw Error('Espera a que termine el cambio de perfil.');
 rotateCloudClient();
 const ownerStamp=stamp(),ownerClient=client;
 if(!client)throw Error('No hay conexión de Supabase configurada');
 if(!navigator.onLine)throw Error('Sin conexión a Internet. Tus registros locales siguen disponibles');
 if(!email.includes('@'))throw Error('Ingresa el correo electrónico de tu cuenta personal.');
 if(register&&(!email.includes('@')||password.length<6))throw Error('Para registrarte, introduce un correo válido y contraseña de al menos 6 caracteres.');
 const result=register?await ownerClient.auth.signUp({email,password}):await ownerClient.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 if(register&&!result.data.session){
  status('Revisa tu correo para confirmar la cuenta. Tu perfil local no se modificó.');
  return;
 }
 await completeCloudLogin(result.data.session,ownerStamp,ownerClient);
}
function renderConflictButtons(){
 const holder=$('offlineConflicts');if(!holder)return;
 holder.replaceChildren();
 for(const c of latest?.data?.conflicts||[]){
  const box=document.createElement('div');box.className='offline-conflict';
  if(c.kind==='photo_conflict'){
   const info=document.createElement('p');
   info.textContent='Conflicto de fotografía. La imagen guardada en este dispositivo se conserva; Supabase no ha sido sobrescrito.';
   const keep=document.createElement('button');keep.type='button';
   keep.textContent='Conservar mi fotografía offline';
   keep.addEventListener('click',async()=>{
    const uid=remoteSession?.user?.id;
    const personal=cloudAccountKind==='personal'&&latest?.data?.cloudUserId===uid;
    if(personal&&!confirm('La fotografía remota es diferente. ¿Preparar tu versión local para reemplazarla en la próxima actualización de Supabase?'))return;
    try{
     await flush(data=>{
      if(personal){
       if(c.currentRevision)data.photoVersions[c.photoKey]={revision:c.currentRevision,ownerId:uid};
       else delete data.photoVersions[c.photoKey];
       for(const op of data.pending.filter(x=>x.kind==='photo'&&x.photoKey===c.photoKey)){
        delete op.submittedRequest;delete op.attemptedAt;
       }
       // Si el conflicto provino de una descarga sin modificaciones en cola,
       // no se subirá nada hasta que la persona vuelva a guardar la foto.
      }
      data.conflicts=data.conflicts.filter(x=>!(x.kind==='photo_conflict'&&x.photoKey===c.photoKey));
     });
     renderConflictButtons();
     status(personal?'Fotografía local conservada. Podrás sincronizarla tras volver a guardar o mediante Actualizar si ya estaba pendiente.':'Fotografía local conservada. Cuenta de prueba: la nube permanece intacta.');
    }catch(error){status('No se pudo revisar la fotografía: '+error.message);}
   });box.append(info,keep);holder.append(box);continue;
  }
  if(c.kind==='reference_conflict'){
   const info=document.createElement('p');
   info.textContent='La referencia compartida cambió en la nube ('+c.refId+'). Se conservó tu versión offline para no reemplazarla sin autorización.';
   const keep=document.createElement('button');keep.type='button';
   keep.textContent='Entendido, conservar datos locales';
   keep.addEventListener('click',async()=>{
    try{
     await flush(data=>{data.conflicts=data.conflicts.filter(x=>!(x.kind==='reference_conflict'&&x.refId===c.refId));});
     renderConflictButtons();
    }catch(error){status('No se pudo confirmar el aviso: '+error.message);}
   });box.append(info,keep);holder.append(box);continue;
  }
  if(c.kind==='catalog_conflict'){
   const info=document.createElement('p');
   info.textContent='Conflicto de catálogo ('+c.catalogKind+') · '+c.reason+
    '. Tus modificaciones siguen offline y la nube no se sobrescribió.';
   box.append(info);
   if(c.current?.activo===true){
    const keep=document.createElement('button');keep.type='button';
    keep.textContent='Conservar mi cambio local';
    keep.addEventListener('click',async()=>{
     if(!confirm('El registro cambió en Supabase. ¿Intentar aplicar tu versión sobre la versión remota actual? No se enviará nada hasta pulsar Actualizar o activar la sincronización automática.'))return;
     try{
      await flush(data=>{
       const group={gym:'gyms',site:'sites',machine:'machines',option:'options',exercise:'library'}[c.catalogKind];
       const row=c.catalogKind==='exercise'
        ?data.library.find(x=>x.id===c.localId)||data.custom.find(x=>String(x.id||x.cloud_id)===c.localId)
        :data.entities[group]?.find(x=>x.id===c.localId);
       const tomb=data.tombstones.find(x=>x.catalogKind===c.catalogKind&&x.localId===c.localId);
       if(!row&&!tomb)throw Error('El elemento local ya no existe');
       const owner=row||tomb;owner.cloudSnapshot=structuredClone(c.current);
       owner.cloudOwnerId=remoteSession?.user?.id;
       for(const op of data.pending.filter(x=>x.catalogKind===c.catalogKind&&x.localId===c.localId)){
        delete op.submittedRequest;delete op.attemptedAt;
       }
       data.conflicts=data.conflicts.filter(x=>x!==c&&!(x.kind==='catalog_conflict'&&x.catalogKind===c.catalogKind&&x.localId===c.localId));
      });
      renderConflictButtons();status('Conflicto de catálogo revisado. Puedes volver a Actualizar.');
     }catch(error){status('No se pudo revisar el conflicto: '+error.message);}
    });box.append(keep);
   }else{
    const hint=document.createElement('p');
    hint.textContent='Revisa o cambia el nombre local. Si falta el elemento remoto, no se aplicará una actualización automáticamente.';
    box.append(hint);
   }
   holder.append(box);continue;
  }
  const title=document.createElement('p');title.textContent=(c.kind==='legacy_unversioned'?'Alerta de cliente antiguo · ':'Conflicto de versiones · ')+c.sourceKey;
  const local=document.createElement('button');local.type='button';local.textContent='Conservar este dispositivo';
  const cloud=document.createElement('button');cloud.type='button';cloud.textContent='Usar datos de la nube';
  const action=async choice=>{
   try{await syncController.resolve(remoteSession?.user?.id,stamp(),c.sourceKey,choice);}
   catch(e){status('Error de conflicto: '+e.message)}
  };
  if(c.kind==='legacy_unversioned'){
   const warning=document.createElement('p');
   warning.textContent=c.message||'Este cambio se realizó con una versión antigua. No se sobrescribirán datos.';
   local.disabled=true;cloud.disabled=true;
   box.append(title,warning);holder.append(box);continue;
  }
  local.addEventListener('click',()=>action('local'));
  cloud.addEventListener('click',()=>action('cloud'));
  box.append(title,local,cloud);holder.append(box);
 }
}
function updateFromProfile(){
 window.GymBaseCatalog=catalogInit();
 catalogUpdate();
 model.records=structuredClone(latest.data.records||[]);
 model.photos=structuredClone(latest.data.photos||{});
 drawRecent();drawHistory(true);drawReports();
 renderSyncStatus();renderConflictButtons();refreshCloudControls();
}
async function remoteAction(action,options={}){
 if(!remoteSession?.user||!cloudAccountKind)throw Error('Inicia sesión o crea tu cuenta de nube primero');
 if(!syncController)throw Error('La sincronización no está disponible');
 if(action==='upload'&&(cloudAccountKind!=='personal'||latest?.data?.cloudUserId!==remoteSession.user.id))
  throw Error('Actualizar requiere una cuenta personal vinculada; la cuenta de prueba solo permite descarga.');
 if(action==='download'){
  options.readOnly=cloudAccountKind==='demo';
 }
 await syncController[action](remoteSession.user.id,stamp(),options);
}

function downloadLocal(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function saveProfileBackup(){
 if(transitioning||syncController?.isBusy())throw Error('Espera a que termine la operación actual.');
 const id=activeId,epoch=profileEpoch;
 await queue;
 if(id!==activeId||epoch!==profileEpoch||transitioning)throw Error('El perfil cambió antes de crear el respaldo.');
 if(!latest)return;
 downloadLocal('Gymlytics_respaldo_'+latest.name.replace(/[^a-z0-9-_]/gi,'_')+'_'+new Date().toISOString().slice(0,10)+'.txt',
  {format:'gymlytics-profile-backup',version:1,name:latest.name,data:latest.data,
   exportedAt:new Date().toISOString()});
 status('Respaldo completo guardado en archivo de texto estructurado (JSON), con cambios pendientes y relaciones.');
}
async function importProfileBackup(event){
 const file=event.target.files?.[0];event.target.value='';
 if(transitioning||syncController?.isBusy())return status('Espera a que termine la operación actual.');
 if(!file)return;
 if(file.size>50*1024*1024)return status('Respaldo excesivamente grande.');
 try{
  const backup=JSON.parse(await file.text());
  verifyRestoreBackup(backup,profiles);
  if(!confirm('Se restaurará como un perfil NUEVO, sin reemplazar ningún perfil existente. ¿Continuar?'))return;
  let name='Restaurado - '+String(backup.name||'Gymlytics').slice(0,38),suffix=2;
  while(profiles.some(p=>p.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))
   name='Restaurado ('+(suffix++)+') - '+String(backup.name||'Gymlytics').slice(0,32);
  const profile={id:uuid(),name,modifiedAt:new Date().toISOString(),data:structuredClone(backup.data)};
  await put(profile);profiles.push(profileMeta(profile));
  await activate(profile.id);
  status('Copia restaurada en un perfil independiente; no se reemplazó ningún registro.');
 }catch(error){status('No se pudo restaurar: '+error.message)}
}

// Leer todas las categorías y comprobar recuentos ANTES de escribir en IndexedDB.
async function downloadAllCatalogs(uid,ownerStamp){
 const fetchTable=async(table,{shared=false}={})=>{
  const scope=q=>shared?q.eq('activo',true):q.eq('user_id',uid);
  const count=await scope(remote.from(table).select('id',{count:'exact',head:true}));
  if(count.error||!Number.isSafeInteger(count.count)||count.count<0)
   throw Error('No se pudo comprobar el total de '+table);
  const result=[],seen=new Set();
  for(let offset=0;offset<count.count;offset+=500){
   if(ownerStamp!==stamp()||remoteSession?.user?.id!==uid)throw Error('El perfil o la cuenta cambió durante la descarga.');
   const q=scope(remote.from(table).select('*')).order('id',{ascending:true}).range(offset,offset+499);
   const {data,error}=await q;
   if(error||!Array.isArray(data)||data.length!==Math.min(500,count.count-offset))
    throw Error('Descarga incompleta de '+table+'; no se guardó nada.');
   for(const row of data){
    if(!row?.id||seen.has(row.id)||!shared&&row.user_id!==uid)throw Error('Se recibió una fila repetida o ajena de '+table);
    seen.add(row.id);result.push(row);
   }
  }
  return result;
 };
 const [base,exercises,gyms,sites,machines,options,muscles]=await Promise.all([
  fetchTable('tbl_catalogo_predeterminado',{shared:true}),fetchTable('tbl_ejercicios'),
  fetchTable('tbl_gimnasios'),fetchTable('tbl_sedes'),fetchTable('tbl_maquinas'),
  fetchTable('tbl_opciones_personales'),fetchTable('tbl_musculos',{shared:true})
 ]);
 if(ownerStamp!==stamp()||remoteSession?.user?.id!==uid)throw Error('Se cambió de cuenta durante la descarga.');
 return prepareDownloadedCatalog({base,exercises,gyms,sites,machines,muscles,options:options.filter(x=>x.activo!==false)});
}

async function init(){
 db=await openDB();
 // Importar solo una vez a un perfil autónomo de prueba: jamás mezclar con otro usuario.
 // Si el usuario eliminó el perfil importado, no recrearlo en cada arranque.
 let seedWarning='';
 if(localStorage.getItem(GYMLYTICS_SEED_MARKER)!=='done'){
  try{
   const existing=await get('090ea9af-0c09-5a12-88bf-7bf1b9ade9f2');
   if(existing)localStorage.setItem(GYMLYTICS_SEED_MARKER,'done');
   else{
    const response=await fetch(GYMLYTICS_SEED_PATH,{cache:'no-store'});
    if(!response.ok)throw Error('No se encontró el archivo HojaMatriz incluido en la aplicación.');
    const seed=await response.json();
    await installGymlyticsSeed(seed,{get,put,emptyFactory:EMPTY,
     alreadyImported:()=>localStorage.getItem(GYMLYTICS_SEED_MARKER)==='done',
     mark:()=>localStorage.setItem(GYMLYTICS_SEED_MARKER,'done')});
   }
  }catch(error){seedWarning=String(error.message||error);}
 }
 profiles=(await all()).map(profileMeta);
 syncController=createGymlyticsCloudSync({
  remote:remoteGateway,getState:()=>({data:latest?.data||EMPTY(),profileName:latest?.name||'Perfil',profileId:activeId}),
  mutate:update=>flush(update),refresh:updateFromProfile,
  isCurrent:(uid,token)=>stamp()===token&&remoteSession?.user?.id===uid,
  isLinkedElsewhere:uid=>profiles.some(p=>p.id!==activeId&&p.cloudUserId===uid),
  confirmAction:message=>confirm(message),notify:status
 });
 if(!profiles.length){
  const profile={id:uuid(),name:'Mi perfil',modifiedAt:new Date().toISOString(),data:EMPTY()};
  await put(profile);profiles=[profileMeta(profile)];
 }
 const last=localStorage.getItem('gymlytics-active-profile');
 const selected=profiles.find(x=>x.id===last)?.id||profiles[0].id;
 window.GymCloud=api;
 await activate(selected,true);
 if(seedWarning)status('No se cargó el historial HojaMatriz offline: '+seedWarning+'. Los perfiles anteriores se conservan.');
 $('offlineProfileMenuToggle')?.addEventListener('click',()=>{$('offlineProfileMenu').hidden=!$('offlineProfileMenu').hidden;});
 document.querySelectorAll('[data-profile-action]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.profileAction;
  if(action==='delete'){
   $('offlineProfileMenu').hidden=true;
   deleteActiveProfile().catch(error=>status('No se pudo eliminar el perfil: '+error.message));
   return;
  }
  $('offlineNewProfileFields').hidden=action!=='add';$('offlineRenameProfileFields').hidden=action!=='rename';
  $('offlineProfileMenu').hidden=true;(action==='add'?$('offlineNewName'):$('offlineRenameName')).focus();
 }));
 $('offlineSyncMode')?.addEventListener('change',async event=>{
  const mode=event.target.value;
  try{if(cloudAccountKind!=='personal'||!remoteSession?.user||latest?.data?.cloudUserId!==remoteSession.user.id)throw Error('Primero vincula una cuenta personal.');
   await flush(data=>{data.syncMode=mode==='instant'?'instant':'later'});
   renderSyncStatus();refreshCloudControls();if(mode==='instant')scheduleAutoUpload();
   status(mode==='instant'?'Actualizar al momento activado.':'Actualizar después: guardado local hasta pulsar Actualizar.');
  }catch(error){refreshCloudControls();status(error.message)}
 });
 $('offlineProfiles').addEventListener('change',async event=>{
  const chosen=event.target.value,previous=activeId;
  try{await activate(chosen)}
  catch(error){event.target.value=previous||'';status('No se pudo cambiar: '+error.message)}
 });
 $('offlineRename').addEventListener('click',async()=>{
  try{await renameProfile()}catch(error){status('No se pudo renombrar: '+error.message)}
 });
 $('offlineCreate').addEventListener('click',async()=>{try{await createProfile()}catch(e){status(e.message)}});
 $('offlineBackup').addEventListener('click',()=>saveProfileBackup().catch(error=>status('Respaldo no realizado: '+error.message)));
 $('offlineImport').addEventListener('change',importProfileBackup);
 $('offlineCloudToggle').addEventListener('click',()=>{
  $('offlineCloudPanel').hidden=!$('offlineCloudPanel').hidden;
 });
 $('authForm').addEventListener('submit',async e=>{
  e.preventDefault();$('authSubmit').disabled=true;
  try{await cloudLogin(tidy($('authEmail').value),$('authPassword').value)}
  catch(error){status('No se pudo conectar: '+error.message)}
  finally{$('authSubmit').disabled=false;$('authPassword').value=''}
 });
 $('authRegister').addEventListener('click',async()=>{
  try{await cloudLogin(tidy($('authEmail').value),$('authPassword').value,true)}
  catch(error){status('No se pudo registrar: '+error.message)}
  finally{$('authPassword').value=''}
 });
 $('offlineLinkAccount').addEventListener('click',async()=>{
  try{await linkAccount()}catch(error){status('No se pudo vincular: '+error.message)}
 });
 $('offlineCloudUpload').addEventListener('click',async()=>{
  const button=$('offlineCloudUpload');button.disabled=true;
  try{await remoteAction('upload')}catch(e){status('Subida no completada: '+e.message+'. Los registros siguen locales.')}
  finally{refreshCloudControls()}
 });
 $('offlineCloudDownload').addEventListener('click',async()=>{
  const button=$('offlineCloudDownload');button.disabled=true;
  try{await remoteAction('download')}catch(error){status('Descarga cancelada: '+error.message)}
  finally{button.disabled=false;refreshCloudControls()}
 });
 $('offlineDemoDownload').addEventListener('click',async()=>{
  const button=$('offlineDemoDownload');button.disabled=true;
  try{await remoteAction('download',{readOnly:true})}
  catch(error){status('Cuenta de prueba: '+error.message)}
  finally{button.disabled=false;refreshCloudControls()}
 });
 $('authLogout').addEventListener('click',async()=>{
  rotateCloudClient();refreshCloudControls();
  status('Sesión de nube cerrada. Todos los registros locales siguen disponibles.');
 });
 // Las credenciales nunca se conservan al alternar perfiles.
 refreshCloudControls();
 $('catalogRefresh').addEventListener('click',async()=>{
  const count=await api.refreshCatalog();$('catalogStatus').textContent=count+' ejercicios disponibles sin conexión.';
 });
 for(const [formId,kind,feedbackId] of [
  ['addGymForm','gym','gymFeedback'],['addSiteForm','site','siteFeedback'],
  ['addMachineForm','machine','machineFeedback'],['addOptionForm','option','optionFeedback']
 ]){
  $(formId)?.addEventListener('submit',async event=>{
   event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
   try{await api.addIndependentItem(kind,Object.fromEntries(new FormData(form).entries()));
    form.reset();$(feedbackId).textContent='Guardado en el perfil local.';}
   catch(error){$(feedbackId).textContent=error.message}finally{button.disabled=false}
  });
 }
 $('catalogForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());
  const button=$('catalogSubmit');button.disabled=true;
  try{await api.saveCustomExercise(values);event.currentTarget.reset();
   $('catalogFeedback').textContent='Ejercicio guardado en el perfil local.';}
  catch(e){$('catalogFeedback').textContent=e.message}finally{button.disabled=false}
 });
 $('authRecovery').addEventListener('click',()=>status('La recuperación de contraseña se habilitará cuando se configure una URL HTTPS segura. El perfil offline no se ve afectado.'));
}
init().catch(error=>{
 offlineInitError=String(error.message||error);
 // Un fallo posterior a la activación (por ejemplo, un control opcional ausente)
 // no debe anular el perfil IndexedDB que ya está listo ni bloquear Guardar.
 if(activeId&&latest&&!transitioning){
  window.GymCloud=api;
  status('Perfil local «'+latest.name+'» activo. Una función adicional falló al iniciarse: '+offlineInitError+'. Tus registros locales siguen protegidos.');
 }else{
  window.GymCloud={
   canWrite:()=>false,
   canRead:()=>false,
   getWriteStatus:()=>({code:'error',message:'No se pudo abrir el almacenamiento local: '+offlineInitError+'. Revisa Perfil. No borres los datos de la aplicación.'})
  };
  status('No se pudo abrir el almacenamiento local: '+offlineInitError+'. No se guardarán entrenamientos.');
 }
});
