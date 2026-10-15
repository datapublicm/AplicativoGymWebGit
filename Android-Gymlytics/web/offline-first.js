/* Gymlytics 01.06 (pruebas): datos locales separados por perfil.
 * La nube solo se consulta por acción expresa: nunca se reconcilia por estar online.
 */
import { createClient } from '@supabase/supabase-js';
import {sourceKey} from './sync-engine.js';
import {createCloudSync} from './cloud-sync.js';
import {profileMeta,validateProfileName,validateProfileBinding,verifyRestoreBackup} from './profile-policy.js';
import {prepareDownloadedCatalog} from './offline-catalog-download.js';
const $=id=>document.getElementById(id);
const DB_NAME='gymlytics_offline_profiles_v1', EMPTY=()=>({
 records:[],photos:{},baseCatalog:[],muscles:[],custom:[],library:[],readOnly:false,demo:false,
 entities:{gyms:[],sites:[],machines:[],options:[]},
 tombstones:[],pending:[],conflicts:[],cloudUserId:null,lastPull:null
});
const uuid=()=>crypto.randomUUID();
const tidy=v=>String(v??'').trim();
let db,profiles=[],activeId=null,profileEpoch=0,latest=null,queue=Promise.resolve(),remoteSession=null,cloudAccountKind=null,syncController=null,transitioning=false;
const config={url:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
 schema:import.meta.env.VITE_SUPABASE_SCHEMA||'sch_android_gymlytics'};
const newClient=()=>config.url&&config.key?createClient(config.url,config.key,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,
  storageKey:'gymlytics-profile-memory-'+crypto.randomUUID()}
}):null;
let client=newClient(),remote=client?.schema(config.schema);
function rotateCloudClient(){client=newClient();remote=client?.schema(config.schema);remoteSession=null;cloudAccountKind=null;}
const remoteGateway={
 from:(...args)=>{if(!remote)throw Error('Supabase no está configurado');return remote.from(...args)},
 rpc:(...args)=>{if(!remote)throw Error('Supabase no está configurado');return remote.rpc(...args)}
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
 $('offlinePending').textContent=counts+' operaciones pendientes · '+deleted+' eliminaciones conservadas';
 $('offlineProfileInfo').textContent=(data.readOnly?'🔒 PRUEBA · SOLO CONSULTA · ':'Perfil personal offline · ')+latest.name+' · '+data.records.length+' series visibles';
 $('offlineConflictSummary').textContent=(data.conflicts||[]).length+' conflictos por revisar';
 $('offlineSyncState').textContent=data.readOnly?'Cuenta de prueba descargada: datos visibles offline. Edición y eliminación BLOQUEADAS.':
  data.cloudUserId?'Cuenta vinculada: '+data.cloudUserId.slice(0,8)+'… · Los cambios permanecen solamente en este dispositivo.':
  'Solo en este dispositivo. Puedes crear una cuenta más adelante sin perder tus registros.';
}
function catalogInit(){
 // Nunca precargar datos de otro usuario: los perfiles nuevos empiezan vacíos.
 const source=Array.isArray(latest?.data?.baseCatalog)?latest.data.baseCatalog:[];
 return source.map(x=>({
  g:x.g,s:x.s,z:x.z,kind:x.kind,i:x.i,a:x.a,gr:x.gr,e:x.e,
  t:[...(x.t||[])],m:x.m,ms:x.ms,n:0,last:null
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
  window.GymBaseCatalog=[];window.GymCustomCatalog=[];window.GymExerciseLibrary=[];
  window.GymEntities={gyms:[],sites:[],machines:[],options:[]};
  drawRecent();drawHistory();drawReports();
  const p=await get(id);
  if(!p||epoch!==profileEpoch)throw Error('No se pudo abrir el nuevo perfil.');
  activeId=id;latest=p;profiles=(await all()).map(profileMeta);
  $('offlineProfiles').replaceChildren(...profiles.map(x=>new Option(x.readOnly?'🔒 '+x.name+' · prueba':x.name,x.id)));
  $('offlineProfiles').value=id;
  window.GymBaseCatalog=catalogInit();
  window.GymEntities=structuredClone(p.data.entities||EMPTY().entities);
  window.GymExerciseLibrary=structuredClone(p.data.library||[]);
  window.GymCustomCatalog=structuredClone(p.data.custom||[]);
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
  status((p.data?.readOnly?'Perfil de PRUEBA solo lectura':'Perfil local editable')+' · '+p.name+' · funciona sin conexión');
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
 const locked=!!latest?.data?.readOnly;
 document.querySelectorAll('#page-catalogos [data-catalog-quick],#page-catalogos .catalog-compact-toggle,#page-catalogos [data-catalog-modify],#page-catalogos .catalog-form button[type=submit],#page-registro #saveRecords,#page-registro #clearSeries,#page-registro #addSeriesGroup,#page-registro #removeSeriesGroup').forEach(b=>{
  b.disabled=locked;b.title=locked?'Cuenta de prueba: edición bloqueada':'';
 });
 const hint=$('offlineReadOnlyWarning');if(hint)hint.hidden=!locked;
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
 if(item)item.textContent=latest?.data?.readOnly?'🔒 '+name+' · prueba':name;
 renderSyncStatus();renderProfileControls();
 status('Perfil renombrado sin modificar registros ni vínculos de nube.');
}

function catalogUpdate(){
 window.GymEntities=structuredClone(latest.data.entities);
 window.GymExerciseLibrary=structuredClone(latest.data.library);
 window.GymCustomCatalog=structuredClone(latest.data.custom);
 if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
 if(typeof renderOwnCatalog==='function')renderOwnCatalog();
 if(typeof cascade==='function')cascade(0);
 if(typeof catalogUpdateCounters==='function')catalogUpdateCounters();
 const muscle=$('muscleExistingSelect'),count=$('muscleCount');
 if(muscle){muscle.replaceChildren(new Option('Selecciona un músculo…',''));
  for(const row of latest.data.muscles||[])muscle.add(new Option(row.nombre,row.id));}
 if(count)count.textContent=String((latest.data.muscles||[]).length);
}
const groups={gym:'gyms',site:'sites',machine:'machines',option:'options',exercise:'library'};
function presentCatalog(kind){
 return kind==='exercise'?[...latest.data.library,...latest.data.custom.map(x=>({id:x.cloud_id,nombre:x.e}))]:
  latest.data.entities[groups[kind]];
}
const assertEditable=()=>{if(!latest||latest.data?.readOnly)throw Error('Cuenta de prueba: solo lectura. Crea un perfil personal para editar.');};
const api={
 canWrite:()=>!!activeId&&!latest?.data?.readOnly,
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
   if(target.some(x=>x.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es')&&
    (kind!=='site'||x.gimnasio_id===values.gimnasio_id)&&
    (kind!=='option'||x.tipo===values.tipo)))throw Error('Ya existe ese elemento');
   if(kind==='site'&&!data.entities.gyms.some(x=>x.id===values.gimnasio_id))throw Error('Selecciona un gimnasio existente');
   const item={id:uuid(),nombre,...kind==='site'?{gimnasio_id:values.gimnasio_id}:{},
    ...kind==='machine'?{tipo_equipo:values.tipo_equipo||'Otro'}:{},
    ...kind==='option'?{tipo:values.tipo||'zona'}:{}};
   target.push(item);data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:kind,localId:item.id});
   return item.id;
  }).then(result=>{catalogUpdate();return result;});
 },
 async saveCustomExercise(values){
  assertEditable();
  const nombre=tidy(values.e);
  if(!nombre)throw Error('Escribe un nombre de ejercicio');
  await flush(data=>{
   if(data.library.some(x=>x.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es')))
    throw Error('El ejercicio ya existe en este perfil');
   const id=uuid();
   data.library.push({id,nombre,origen:'usuario',zona_entrenamiento:tidy(values.z)||'Sin clasificar',
    tecnica_actualizada:tidy(values.tecnica)||'Ejecución base'});
   data.pending.push({id:uuid(),kind:'add_catalog',catalogKind:'exercise',localId:id});
  });catalogUpdate();return structuredClone(latest.data.custom);
 },
 async updateCatalogItem(kind,id,name){
  assertEditable();
  name=tidy(name);if(!name)throw Error('Introduce el nombre nuevo');
  await flush(data=>{
   const list=kind==='exercise'?data.library:data.entities[groups[kind]];
   if(!list)throw Error('Categoría inválida');
   const item=list.find(x=>x.id===id);
   if(!item)throw Error('No se encontró el elemento personal');
   item.nombre=name;
   data.pending.push({id:uuid(),kind:'update_catalog',catalogKind:kind,localId:id});
  });catalogUpdate();return id;
 },
 async deleteCatalogItem(kind,id){
  assertEditable();
  await flush(data=>{
   const list=kind==='exercise'?data.library:data.entities[groups[kind]];
   if(!list)throw Error('Categoría inválida');
   const idx=list.findIndex(x=>String(x.id)===String(id));
   if(idx<0)throw Error('No se encontró el elemento personal');
   if(kind==='gym'&&data.entities.sites.some(x=>x.gimnasio_id===id))
    throw Error('Este gimnasio contiene sedes');
   list.splice(idx,1);
   data.pending=data.pending.filter(x=>x.localId!==id||x.kind!=='add_catalog');
   data.pending.push({id:uuid(),kind:'delete_catalog',catalogKind:kind,localId:id});
   data.tombstones.push({catalogKind:kind,localId:id,at:new Date().toISOString()});
  });catalogUpdate();return id;
 },
 async loadAnatomy(exercise){
  const photos={};
  const keys=[['maquina','equipo'],['ejercicio','ejercicio'],['musculos','anatomia']];
  for(const [type,prefix] of keys){
   const key=type==='maquina'?`${exercise.g}|${exercise.s}|${exercise.i}`:`${exercise.g}|${exercise.s}|${exercise.i}|${exercise.e}`;
   if(latest.data.photos[prefix+':'+key])photos[type+':general']=latest.data.photos[prefix+':'+key];
  }
  return {id:null,primary:[],secondary:[],images:{},zones3d:[],photos};
 },
 async uploadUserPhoto({exercise,type,side,blob}){
  assertEditable();
  const ownerStamp=stamp();
  if(!blob||blob.size>3*1024*1024)throw Error('Fotografía demasiado grande (máximo 3 MB)');
  const key=type==='maquina'?`${exercise.g}|${exercise.s}|${exercise.i}`:`${exercise.g}|${exercise.s}|${exercise.i}|${exercise.e}`;
  const base64=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  if(ownerStamp!==stamp())throw Error('Cambiaste de perfil antes de guardar la fotografía.');
  await flush(data=>{data.photos[(type==='maquina'?'equipo':type==='ejercicio'?'ejercicio':'anatomia')+':'+key]=base64;
   data.pending.push({id:uuid(),kind:'photo',key,at:new Date().toISOString()});
  });
  return 'local:'+key;
 }
};
function refreshCloudControls(){
 const linked=!!remoteSession?.user&&!transitioning;
 $('offlineRemoteUser').textContent=linked?'Conectado: '+(remoteSession.user.email||remoteSession.user.id):'Sin sesión de nube';
 const demo=cloudAccountKind==='demo';
 $('offlineLinkAccount').disabled=!linked||demo||!!syncController?.isBusy()||!!latest?.data?.cloudUserId||!!latest?.data?.readOnly;
 $('offlineLinkAccount').textContent=demo?'🔒 La cuenta de prueba no puede vincularse':latest?.data?.cloudUserId?'Perfil ya vinculado a esta cuenta':'Vincular este perfil con esta cuenta';
 $('offlineCloudDownload').disabled=!linked||demo||!!latest?.data?.readOnly||!!syncController?.isBusy();
 // No publicar modificaciones: todo el trabajo de esta versión se queda offline.
 $('offlineCloudUpload').hidden=true;$('offlineCloudUpload').disabled=true;
 $('offlineDemoDownload').disabled=!linked||!demo||!!syncController?.isBusy();
 $('authLogout').hidden=!linked;
}
function requireCloudIdentity(uid,ownerStamp,ownerClient=client){
 if(ownerStamp!==stamp()||ownerClient!==client||!uid||transitioning)
  throw Error('Cambiaste de perfil durante la autenticación.');
 validateProfileBinding(profiles,activeId,uid);
}
async function linkAccount(){
 const user=remoteSession?.user;
 if(!user)throw Error('Inicia sesión en la nube primero.');
 if(cloudAccountKind==='demo')throw Error('La cuenta de prueba no puede vincularse como una cuenta personal.');
 if(latest?.data?.readOnly)throw Error('Una cuenta de prueba no puede vincularse como personal.');
 requireCloudIdentity(user.id,stamp());
 if(latest?.data?.cloudUserId===user.id)return status('Perfil ya vinculado a esta cuenta.');
 if(!confirm('¿Vincular '+latest.name+' con esta cuenta? No se subirán ni descargarán datos automáticamente. La asociación permanecerá en este perfil.'))return;
 await flush(data=>{
  validateProfileBinding(profiles,activeId,user.id);
  data.cloudUserId=user.id;
 });
 renderSyncStatus();refreshCloudControls();
 status('Cuenta vinculada. Las series permanecen locales hasta que solicites sincronización.');
}
async function provisionGymlyticsAccount(ownerStamp){
 if(!remote)throw Error('No está configurada la base de datos');
 const {data,error}=await remote.rpc('asegurar_perfil_gymlytics');
 if(ownerStamp!==stamp())throw Error('El perfil cambió durante el registro de la cuenta');
 if(error)throw Error('No se pudo habilitar la cuenta: '+error.message);
 if(!data?.activo)throw Error('La cuenta Gymlytics está desactivada; no se reactivó automáticamente.');
}
async function completeCloudLogin(session,ownerStamp,ownerClient,register=false){
 requireCloudIdentity(session?.user?.id,ownerStamp,ownerClient);
 try{
  if(register)await provisionGymlyticsAccount(ownerStamp);
  // Consultar la identidad autorizada por el servidor: NUNCA inferir la cuenta
  // de prueba del nombre de perfil ni del botón que pulsó el usuario.
  const {data,error}=await remote.from('tbl_usuarios')
   .select('id,usuario,activo').eq('id',session.user.id).maybeSingle();
  if(error||!data?.activo)throw Error('La cuenta todavía no está habilitada en Gymlytics.');
  const kind=String(data.usuario||'').trim().toLocaleLowerCase('es')==='prueba'?'demo':'personal';
  requireCloudIdentity(session.user.id,ownerStamp,ownerClient);
  if(kind==='demo'&&latest?.data?.cloudUserId&&latest.data.cloudUserId!==session.user.id)
   throw Error('Esta cuenta de prueba no puede abrirse sobre un perfil vinculado a otra cuenta.');
  cloudAccountKind=kind;
 }catch(error){
  if(ownerStamp===stamp()&&ownerClient===client)rotateCloudClient();
  throw error;
 }
 remoteSession=session;
 refreshCloudControls();renderSyncStatus();
 status(cloudAccountKind==='demo'?
  'Cuenta de prueba verificada: solo descarga de consulta. Ningún dato se modificará.':
  'Cuenta personal autenticada: puedes vincular o descargar datos, sin subir cambios locales.');
}
async function cloudLogin(email,password,register=false){
 if(transitioning)throw Error('Espera a que termine el cambio de perfil.');
 rotateCloudClient();
 const ownerStamp=stamp(),ownerClient=client;
 if(!client)throw Error('No hay conexión de Supabase configurada');
 if(!navigator.onLine)throw Error('Sin conexión a Internet. Tus registros locales siguen disponibles');
 if(!register&&!email.includes('@')){
  const {data,error}=await ownerClient.functions.invoke('gymlytics-login-usuario',{body:{username:email,password}});
  if(error)throw error;
  if(!data?.access_token||!data?.refresh_token)throw Error(data?.error||'Nombre de usuario o contraseña inválidos');
  const set=await ownerClient.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
  if(set.error)throw set.error;
  await completeCloudLogin(set.data.session,ownerStamp,ownerClient);
  return;
 }
 if(register&&(!email.includes('@')||password.length<6))throw Error('Para registrarte, introduce un correo válido y contraseña de al menos 6 caracteres.');
 const result=register?await ownerClient.auth.signUp({email,password}):await ownerClient.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 if(register&&!result.data.session){
  status('Revisa tu correo para confirmar la cuenta. Tu perfil local no se modificó.');
  return;
 }
 await completeCloudLogin(result.data.session,ownerStamp,ownerClient,register);
}
function renderConflictButtons(){
 const holder=$('offlineConflicts');if(!holder)return;
 holder.replaceChildren();
 for(const c of latest?.data?.conflicts||[]){
  const box=document.createElement('div');box.className='offline-conflict';
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
 drawRecent();drawHistory(true);drawReports();
 renderSyncStatus();renderConflictButtons();refreshCloudControls();
}
async function remoteAction(action,options={}){
 if(!remoteSession?.user||!cloudAccountKind)throw Error('Inicia sesión o crea tu cuenta de nube primero');
 if(!syncController)throw Error('La sincronización no está disponible');
 if(action==='upload')throw Error('Los cambios de esta versión se conservan únicamente offline; subida deshabilitada.');
 if(action==='download'){
  if(cloudAccountKind==='demo'&&!options.readOnly)
   throw Error('La cuenta de prueba únicamente puede descargarse en modo solo lectura.');
  if(cloudAccountKind!=='demo'&&options.readOnly)
   throw Error('La opción de prueba requiere iniciar sesión en la cuenta «prueba».');
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
 downloadLocal('Gymlytics_perfil_'+latest.name.replace(/[^a-z0-9-_]/gi,'_')+'_'+new Date().toISOString().slice(0,10)+'.json',
  {format:'gymlytics-profile-backup',version:1,name:latest.name,data:latest.data,
   exportedAt:new Date().toISOString()});
 status('Respaldo completo del perfil descargado, incluyendo eliminaciones y cambios pendientes.');
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
 db=await openDB();profiles=(await all()).map(profileMeta);
 syncController=createCloudSync({
  remote:remoteGateway,getState:()=>({data:latest?.data||EMPTY(),profileName:latest?.name||'Perfil'}),
  catalogFetch:downloadAllCatalogs,
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
 window.GymCloud={canWrite:()=>false};
 status('No se pudo abrir el almacenamiento local: '+error.message+'. No se guardarán entrenamientos.');
});
