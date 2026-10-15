/* Gymlytics 01.06 (pruebas): datos locales separados por perfil.
 * La nube solo se consulta por acción expresa: nunca se reconcilia por estar online.
 */
import { createClient } from '@supabase/supabase-js';
const $=id=>document.getElementById(id);
const DB_NAME='gymlytics_offline_profiles_v1', EMPTY=()=>({
 records:[],photos:{},custom:[],library:[],entities:{gyms:[],sites:[],machines:[],options:[]},
 tombstones:[],pending:[],cloudUserId:null,lastPull:null
});
const uuid=()=>crypto.randomUUID();
const tidy=v=>String(v??'').trim();
let db,profiles=[],activeId=null,profileEpoch=0,latest=null,queue=Promise.resolve(),remoteSession=null;
const config={url:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
 schema:import.meta.env.VITE_SUPABASE_SCHEMA||'sch_android_gymlytics'};
const client=config.url&&config.key?createClient(config.url,config.key,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'gymlytics-manual-transfer'}
}):null;
const remote=client?.schema(config.schema);
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
  profiles=profiles.map(p=>p.id===profile.id?profile:p);
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
 $('offlineProfileInfo').textContent='Datos locales de '+latest.name+' · '+data.records.length+' series visibles';
 $('offlineSyncState').textContent=data.cloudUserId
  ?'Cuenta vinculada: '+data.cloudUserId.slice(0,8)+'… · Ningún cambio se sube ni descarga automáticamente.'
  :'Solo en este dispositivo. Puedes crear una cuenta más adelante sin perder tus registros.';
}
function catalogInit(){
 const source=window.GymBundledCatalog||[];
 return source.map(x=>({
  g:x.g,s:x.s,z:x.z,kind:x.kind,i:x.i,a:x.a,gr:x.gr,e:x.e,
  t:[...(x.t||[])],m:x.m,ms:x.ms,n:0,last:null
 }));
}
async function activate(id,initial=false){
 const epoch=++profileEpoch;
 if(typeof invalidatePendingSave==='function')invalidatePendingSave();
 if(typeof showHistoryLoadProgress==='function')showHistoryLoadProgress(null,null);
 if(typeof setHistoryReady==='function')setHistoryReady(false);
 remoteSession=null; // Desvincular la nube en pantalla; cambiar perfiles no depende de la red.
 const p=await get(id);
 if(epoch!==profileEpoch||!p) return;
 activeId=id;latest=p;profiles=await all();
 $('offlineProfiles').replaceChildren(...profiles.map(x=>new Option(x.name,x.id)));
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
 if(typeof cascade==='function')cascade(0);
 drawRecent();drawHistory();drawReports();
 if(typeof setHistoryReady==='function')setHistoryReady(true);
 $('historyRefresh').disabled=false;$('catalogRefresh').disabled=false;
 $('offlineCloudPanel').hidden=true;
 $('offlineRemoteUser').textContent='';
 renderSyncStatus();
 status('Perfil local activo · '+p.name+' · funciona sin conexión');
 document.body.classList.remove('auth-locked');
 document.querySelectorAll('[data-page]').forEach(x=>{x.disabled=false;x.setAttribute('aria-disabled','false');});
 if(initial)showPage('registro');
}
async function createProfile(){
 const name=tidy($('offlineNewName').value);
 if(!name||name.length>60) return status('Escribe un nombre de perfil entre 1 y 60 caracteres.');
 if(profiles.some(x=>x.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))return status('Ya existe un perfil con ese nombre.');
 const profile={id:uuid(),name,modifiedAt:new Date().toISOString(),data:EMPTY()};
 await put(profile);profiles.push(profile);$('offlineNewName').value='';
 await activate(profile.id);
 status('Perfil local creado. Los registros de otros perfiles permanecen separados.');
}
function catalogUpdate(){
 window.GymEntities=structuredClone(latest.data.entities);
 window.GymExerciseLibrary=structuredClone(latest.data.library);
 window.GymCustomCatalog=structuredClone(latest.data.custom);
 if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
 if(typeof renderOwnCatalog==='function')renderOwnCatalog();
 if(typeof cascade==='function')cascade(0);
 if(typeof catalogUpdateCounters==='function')catalogUpdateCounters();
}
const groups={gym:'gyms',site:'sites',machine:'machines',option:'options',exercise:'library'};
function presentCatalog(kind){
 return kind==='exercise'?[...latest.data.library,...latest.data.custom.map(x=>({id:x.cloud_id,nombre:x.e}))]:
  latest.data.entities[groups[kind]];
}
const api={
 canWrite:()=>!!activeId,
 getSessionStamp:stamp,
 async refreshCatalog(){window.GymBaseCatalog=catalogInit();if(typeof cascade==='function')cascade(0);return window.GymBaseCatalog.length},
 async loadInitialCatalog(){return catalogInit()},
 async loadOwnCatalog(){return structuredClone(latest.data.custom)},
 async loadIndependentCatalog(){catalogUpdate();return structuredClone(latest.data.entities)},
 async loadHistory(){return structuredClone(latest.data.records)},
 async loadCatalogStats(){catalogUpdate()},
 async saveWorkout({exercise,date,technique,notes,entries}){
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
  await flush(data=>{
   const index=data.records.findIndex(x=>String(x.id)===String(id));
   if(index===-1)throw Error('La serie no pertenece al perfil activo');
   const [row]=data.records.splice(index,1);
   data.pending=data.pending.filter(x=>x.localId!==row.id||x.kind!=='create_series');
   // La lápida protege contra reapariciones al descargar copias antiguas.
   data.tombstones.push({localId:row.id,remoteId:row.remoteId||row.origin==='cloud'&&row.id||null,
    at:new Date().toISOString()});
   if(row.remoteId||row.origin==='cloud')data.pending.push({id:uuid(),kind:'delete_series',
    localId:row.id,remoteId:row.remoteId||row.id});
  });
  return id;
 },
 async addIndependentItem(kind,values){
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
  if(!blob||blob.size>3*1024*1024)throw Error('Fotografía demasiado grande (máximo 3 MB)');
  const key=type==='maquina'?`${exercise.g}|${exercise.s}|${exercise.i}`:`${exercise.g}|${exercise.s}|${exercise.i}|${exercise.e}`;
  const base64=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  await flush(data=>{data.photos[(type==='maquina'?'equipo':type==='ejercicio'?'ejercicio':'anatomia')+':'+key]=base64;
   data.pending.push({id:uuid(),kind:'photo',key,at:new Date().toISOString()});
  });
  return 'local:'+key;
 }
};
function refreshCloudControls(){
 const linked=!!remoteSession?.user;
 $('offlineRemoteUser').textContent=linked?'Conectado: '+(remoteSession.user.email||remoteSession.user.id):'Sin sesión de nube';
 $('offlineCloudDownload').disabled=!linked;
 $('authLogout').hidden=!linked;
}
async function cloudLogin(email,password,register=false){
 if(!client)throw Error('No hay conexión de Supabase configurada');
 if(!navigator.onLine)throw Error('Sin conexión a Internet. Tus registros locales siguen disponibles');
 if(!register&&!email.includes('@')){
  const {data,error}=await client.functions.invoke('gymlytics-login-usuario',{body:{username:email,password}});
  if(error)throw error;
  if(!data?.access_token||!data?.refresh_token)throw Error(data?.error||'Nombre de usuario o contraseña inválidos');
  const set=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
  if(set.error)throw set.error;
  remoteSession=set.data.session;
  refreshCloudControls();
  status('Cuenta autenticada. Para descargar debes confirmar la operación.');
  return;
 }
 if(register&&(!email.includes('@')||password.length<6))throw Error('Para registrarte, introduce un correo válido y contraseña de al menos 6 caracteres.');
 const result=register?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 if(register&&!result.data.session){
  status('Revisa tu correo para confirmar la cuenta. Tu perfil local no se modificó.');
  return;
 }
 remoteSession=result.data.session;
 if(!remoteSession?.user)throw Error('No se obtuvo la sesión de la nube');
 refreshCloudControls();
 status('Cuenta autenticada. Para descargar datos debes confirmar la operación.');
}
async function cloudDownload(){
 if(!remoteSession?.user||!remote)throw Error('Inicia sesión en la nube primero');
 if(!navigator.onLine)throw Error('Necesitas conexión para descargar');
 const uid=remoteSession.user.id,epoch=profileEpoch;
 if(latest.data.cloudUserId&&latest.data.cloudUserId!==uid)
  throw Error('Este perfil ya está asociado a otra cuenta. No se mezclarán cuentas distintas.');
 if(!confirm('¿Descargar y unir los datos de tu cuenta con ESTE perfil? No se borrarán los registros locales ni se reactivarán las series eliminadas. La subida sigue pendiente hasta disponer de sincronización segura.'))return;
 // La descarga se completa antes de modificar IndexedDB; un fallo no toca el perfil.
 const access=await remote.from('tbl_usuarios').select('id,activo').eq('id',uid).maybeSingle();
 if(access.error||!access.data?.activo)throw Error('La cuenta aún no tiene acceso habilitado a Gymlytics.');
 const pageSize=500,rows=[],ids=new Set();
 const countResponse=await remote.from('vw_historial_series').select('id',{head:true,count:'exact'}).eq('user_id',uid);
 if(countResponse.error)throw countResponse.error;
 const total=countResponse.count;
 if(!Number.isSafeInteger(total)||total<0)throw Error('No se pudo comprobar el total remoto');
 for(let offset=0;offset<total;offset+=pageSize){
  const response=await remote.from('vw_historial_series').select('*').eq('user_id',uid)
   .order('date',{ascending:false}).order('id',{ascending:true}).range(offset,offset+pageSize-1);
  if(response.error)throw response.error;
  if(response.data.length!==Math.min(pageSize,total-offset))throw Error('Descarga incompleta. No se guardó ningún cambio.');
  for(const x of response.data){
   if(!x.id||x.user_id!==uid||ids.has(String(x.id)))throw Error('La descarga contiene filas repetidas o ajenas.');
   ids.add(String(x.id));rows.push(x);
  }
 }
 if(epoch!==profileEpoch||!remoteSession||remoteSession.user.id!==uid)throw Error('El perfil o la cuenta cambió');
 let added=0;
 await flush(data=>{
  if(data.cloudUserId&&data.cloudUserId!==uid)throw Error('La cuenta ya no coincide');
  const locallyKnown=new Set(data.records.map(x=>String(x.remoteId||x.origin==='cloud'&&x.id||'')));
  const removed=new Set(data.tombstones.map(x=>String(x.remoteId||'')));
  for(const r of rows){
   const id=String(r.id);
   if(locallyKnown.has(id)||removed.has(id))continue;
   data.records.push({...r,id:'cloud:'+id,remoteId:id,origin:'cloud',
    weight:Number(r.weight||0),reps:Number(r.reps||0),assistance:Number(r.assistance||0)});
   added++;
  }
  data.cloudUserId=uid;data.lastPull=new Date().toISOString();
 });
 model.records=structuredClone(latest.data.records);drawRecent();drawHistory(true);drawReports();renderSyncStatus();
 status('Descarga completa: '+added+' series nuevas, sin sobrescribir registros ni eliminaciones locales.');
}

function downloadLocal(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function saveProfileBackup(){
 if(!latest)return;
 downloadLocal('Gymlytics_perfil_'+latest.name.replace(/[^a-z0-9-_]/gi,'_')+'_'+new Date().toISOString().slice(0,10)+'.json',
  {format:'gymlytics-profile-backup',version:1,name:latest.name,data:latest.data,
   exportedAt:new Date().toISOString()});
 status('Respaldo completo del perfil descargado, incluyendo eliminaciones y cambios pendientes.');
}
async function importProfileBackup(event){
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 if(file.size>50*1024*1024)return status('Respaldo excesivamente grande.');
 try{
  const backup=JSON.parse(await file.text());
  if(backup.format!=='gymlytics-profile-backup'||backup.version!==1||
     !backup.data||!Array.isArray(backup.data.records)||!Array.isArray(backup.data.tombstones)||
     !Array.isArray(backup.data.pending)||!backup.data.entities||
     !Array.isArray(backup.data.library)||!Array.isArray(backup.data.custom))
    throw Error('No es una copia compatible y completa');
  if(!confirm('Se restaurará como un perfil NUEVO, sin reemplazar ningún perfil existente. ¿Continuar?'))return;
  const name='Restaurado - '+String(backup.name||'Gymlytics').slice(0,42);
  const profile={id:uuid(),name,modifiedAt:new Date().toISOString(),data:backup.data};
  await put(profile);
  await activate(profile.id);
  localStorage.setItem('gymlytics-active-profile',profile.id);
  status('Copia restaurada en un perfil independiente; no se reemplazó ningún registro.');
 }catch(error){status('No se pudo restaurar: '+error.message)}
}

async function init(){
 db=await openDB();profiles=await all();
 if(!profiles.length){
  const profile={id:uuid(),name:'Mi perfil',modifiedAt:new Date().toISOString(),data:EMPTY()};
  await put(profile);profiles=[profile];
 }
 const last=localStorage.getItem('gymlytics-active-profile');
 const selected=profiles.find(x=>x.id===last)?.id||profiles[0].id;
 window.GymCloud=api;
 await activate(selected,true);
 $('offlineProfiles').addEventListener('change',async event=>{
  localStorage.setItem('gymlytics-active-profile',event.target.value);
  await activate(event.target.value);
 });
 $('offlineCreate').addEventListener('click',async()=>{try{await createProfile();localStorage.setItem('gymlytics-active-profile',activeId)}catch(e){status(e.message)}});
 $('offlineBackup').addEventListener('click',saveProfileBackup);
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
 $('offlineCloudDownload').addEventListener('click',async()=>{
  const button=$('offlineCloudDownload');button.disabled=true;
  try{await cloudDownload()}catch(error){status('Descarga cancelada: '+error.message)}
  finally{button.disabled=false;refreshCloudControls()}
 });
 $('authLogout').addEventListener('click',async()=>{
  if(client)await client.auth.signOut();remoteSession=null;refreshCloudControls();
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
