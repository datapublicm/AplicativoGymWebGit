import {sourceKey,payloadOf,remoteToRow,planUpload,mergeDownload,acknowledge} from './sync-engine.js';
import {legacyAlerts,normalizeLegacySnapshot} from './legacy-compat.js';
import {mergeDownloadedCatalog} from './offline-catalog-download.js';
import {planCatalogUpload,acknowledgeCatalog} from './catalog-sync-engine.js';
import {photoJobPlan,acknowledgePhoto,decidePhotoDownload,applyDownloadedPhoto} from './photo-sync-engine.js';

// Adaptador de red local-first: toda escritura ocurre primero en IndexedDB.
// El usuario puede elegir sincronizar manualmente o tras cada cambio.
export function createCloudSync({remote,getState,mutate,refresh,isCurrent,isLinkedElsewhere,confirmAction,notify,catalogFetch}){
 let busy=false;
 const isBusy=()=>busy;
 const PHOTO_BUCKET='gymlog-usuarios',PHOTO_LIMIT=3*1024*1024;
 function photoBlob(dataUrl){
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=\s]+$/.test(dataUrl))throw Error('Imagen local no válida');
  const bytes=atob(dataUrl.split(',')[1]);
  if(!bytes.length||bytes.length>PHOTO_LIMIT)throw Error('Imagen de más de 3 MB');
  const buf=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)buf[i]=bytes.charCodeAt(i);
  return new Blob([buf],{type:'image/jpeg'});
 }
 const toDataUrl=blob=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(reader.error||Error('Foto descargada ilegible'));
  reader.readAsDataURL(blob);
 });
 async function photoRows(uid,stamp){
  const rows=await pages('tbl_fotos_offline',uid);
  validate(uid,stamp);
  for(const row of rows)
   if(!row.storage_path?.startsWith(uid+'/gymlytics/')||!row.storage_path.endsWith('.jpg'))
    throw Error('Ruta remota de fotografía inválida');
  return rows;
 }
 async function fetchPhotos(uid,stamp,rows){
  const received=[];
  for(const item of rows){
   validate(uid,stamp);
   const decision=decidePhotoDownload(getState().data,item,uid);
   if(decision!=='download'){received.push({item,decision});continue;}
   const {data:blob,error}=await remote.storage.from(PHOTO_BUCKET).download(item.storage_path);
   if(error||!blob)throw Error('Foto incompleta: '+(error?.message||item.photo_key));
   if(blob.type!=='image/jpeg'||!blob.size||blob.size>PHOTO_LIMIT)throw Error('JPEG remoto inválido');
   validate(uid,stamp);
   received.push({item,decision,dataUrl:await toDataUrl(blob)});
  }
  return received;
 }
 function validate(uid,stamp){
  if(!uid||!isCurrent(uid,stamp))throw Error('Cambió la cuenta o el perfil');
  const {data}=getState();
  if(isLinkedElsewhere?.(uid))throw Error('Esta cuenta ya pertenece a otro perfil local del dispositivo.');
  if(data.cloudUserId&&data.cloudUserId!==uid)
   throw Error('Este perfil está vinculado a otra cuenta. No se mezclará información.');
 }
 async function authorized(uid,stamp){
  validate(uid,stamp);
  if(!navigator.onLine)throw Error('No hay conexión. Los cambios locales siguen seguros.');
  const {data,error}=await remote.from('tbl_usuarios').select('id,activo').eq('id',uid).maybeSingle();
  validate(uid,stamp);
  if(error||!data?.activo)throw Error('La cuenta todavía no está habilitada en Gymlytics.');
 }
 async function pages(table,uid){
  const column=table==='tbl_sync_series'?'source_key':table==='tbl_fotos_offline'?'photo_key':'id';
  const count=await remote.from(table).select(column,{count:'exact',head:true}).eq('user_id',uid);
  if(count.error||!Number.isSafeInteger(count.count)||count.count<0)
   throw Error('No se pudo comprobar el total remoto de '+table);
  const result=[],seen=new Set(),size=500;
  for(let start=0;start<count.count;start+=size){
   const sort=table==='tbl_sync_series'?'source_key':table==='tbl_fotos_offline'?'photo_key':'date';
   let q=remote.from(table).select('*').eq('user_id',uid).order(sort,{ascending:sort!=='date'});
   if(sort==='date')q=q.order('id',{ascending:true});
   const {data,error}=await q.range(start,start+size-1);
   if(error||!Array.isArray(data)||data.length!==Math.min(size,count.count-start))
    throw Error('La descarga de '+table+' está incompleta; no se aplicó');
   for(const row of data){
    if(!row?.[column]||seen.has(row[column])||row.user_id!==uid)
     throw Error('Respuesta remota repetida o ajena');
    seen.add(row[column]);result.push(row);
   }
  }
  return result;
 }
 async function upload(uid,stamp,{automatic=false}={}){
  if(busy)throw Error('Hay otra sincronización activa');
  await authorized(uid,stamp);
  validate(uid,stamp);
  const initial=getState(),series=planUpload(initial.data),catalog=planCatalogUpload(initial.data,uid),photos=photoJobPlan(initial.data,uid);
  const expected=series.ops.length+catalog.ops.length+photos.ops.length;
  if(!expected&&!catalog.noops.length){
   notify('No hay cambios compatibles para subir. '+(catalog.blocked.length+series.blocked.length+photos.blocked.length)+' pendientes requieren revisión.');
   return {done:0,blocked:catalog.blocked.length+series.blocked.length};
  }
  if(!automatic&&!confirmAction('¿Actualizar Supabase con '+expected+' operaciones pendientes de «'+initial.profileName+'»? Las modificaciones se comprobarán antes de aplicar y nunca se mezclan cuentas.'))return null;
  busy=true;refresh();
  let done=0,duplicates=0,conflicts=0,iterations=0,localOnly=0;
  try{
   while(true){
    validate(uid,stamp);
    const plan=planCatalogUpload(getState().data,uid);
    if(plan.noops.length){
     await mutate(data=>{
      const ids=new Set(plan.noops);
      data.pending=data.pending.filter(x=>!ids.has(x.id));
      // Altas locales eliminadas antes de su primera subida jamás existieron en la nube.
      const keys=new Set(plan.noops.map(id=>{const p=getState().data.pending.find(x=>x.id===id);return p?.catalogKind+':'+p?.localId;}));
      data.tombstones=data.tombstones.filter(x=>!keys.has(x.catalogKind+':'+x.localId));
     });
     localOnly+=plan.noops.length;
     continue;
    }
    if(!plan.ops.length)break;
    if(++iterations>5000)throw Error('Se detuvo una cola de catálogo demasiado extensa');
    const selected=plan.ops[0],op=selected.request;
    await mutate(data=>{
     validate(uid,stamp);
     const item=data.pending.find(x=>x.id===op.op_id);
     if(!item)throw Error('La operación de catálogo cambió antes del envío');
     if(item.submittedRequest&&JSON.stringify(item.submittedRequest)!==JSON.stringify(op))
      throw Error('Una operación de catálogo enviada no puede alterarse');
     if(!item.submittedRequest){item.submittedRequest=structuredClone(op);item.attemptedAt=new Date().toISOString();}
    });
    const {data:response,error}=await remote.rpc('aplicar_cambio_catalogo',{p_change:op});
    if(error)throw Error('Error de catálogo: '+error.message);
    validate(uid,stamp);
    await mutate(data=>{
     validate(uid,stamp);
     if(acknowledgeCatalog(data,selected,response,uid)) {
      done++;if(response.status==='duplicate')duplicates++;
     }else conflicts++;
    });
   }
   const seriesPlan=planUpload(getState().data);
   for(let i=0;i<seriesPlan.ops.length;i+=50){
    validate(uid,stamp);
    const chunk=seriesPlan.ops.slice(i,i+50);
    await mutate(local=>{
     validate(uid,stamp);
     for(const op of chunk){
      const item=local.pending.find(p=>p.id===op.op_id);
      if(!item)throw Error('La operación pendiente cambió antes de enviarse.');
      if(item.submittedRequest&&JSON.stringify(item.submittedRequest)!==JSON.stringify(op))
       throw Error('No se puede alterar una operación de nube ya enviada.');
      if(!item.submittedRequest){item.submittedRequest=structuredClone(op);item.attemptedAt=new Date().toISOString();}
     }
    });
    const response=await remote.rpc('aplicar_cambios_offline',{p_changes:chunk});
    if(response.error)throw response.error;
    if(!Array.isArray(response.data))throw Error('El servidor devolvió una respuesta inválida');
    validate(uid,stamp);
    await mutate(local=>{
     validate(uid,stamp);
     const result=acknowledge(local,chunk,response.data);
     local.cloudUserId=uid;done+=result.done;duplicates+=result.duplicate;conflicts+=result.conflicts;
    });
   }
   // Subir imagen versionada y confirmar su relación sin sobrescribir silenciosamente.
   let photoAttempts=0;
   while(true){
    validate(uid,stamp);
    const pending=photoJobPlan(getState().data,uid).ops[0];
    if(!pending)break;
    if(++photoAttempts>5000)throw Error('Cola de fotografías demasiado extensa');
    const request=pending.request;
    await mutate(local=>{
     validate(uid,stamp);
     const job=local.pending.find(p=>p.id===pending.jobId);
     if(!job)throw Error('La fotografía cambió antes de subirse');
     if(job.submittedRequest&&JSON.stringify(job.submittedRequest)!==JSON.stringify(request))
      throw Error('No se puede alterar una solicitud fotográfica enviada');
     if(!job.submittedRequest){job.submittedRequest=structuredClone(request);job.attemptedAt=new Date().toISOString();}
    });
    const blob=photoBlob(pending.payload);
    const {error:uploadError}=await remote.storage.from(PHOTO_BUCKET).upload(
     request.storage_path,blob,{contentType:'image/jpeg',upsert:true});
    if(uploadError)throw Error('No se pudo subir la foto: '+uploadError.message);
    validate(uid,stamp);
    const response=await remote.rpc('confirmar_foto_offline',{p_photo:request});
    if(response.error)throw Error('No se pudo confirmar la foto: '+response.error.message);
    validate(uid,stamp);
    await mutate(local=>{
     validate(uid,stamp);
     if(acknowledgePhoto(local,pending,response.data,uid)){
      done++;if(response.data.status==='duplicate')duplicates++;
     }else conflicts++;
    });
   }
   const last=getState().data,remaining=(last.pending||[]).length;
   notify('Actualización: '+done+' confirmadas · '+duplicates+' reintentos · '+conflicts+' conflictos · '+
    localOnly+' cancelaciones locales · '+remaining+' operaciones pendientes.');
   return {done,duplicates,conflicts,remaining,blocked:planCatalogUpload(last,uid).blocked.length+photoJobPlan(last,uid).blocked.length};
  }finally{busy=false;refresh();}
 }
 async function download(uid,stamp,{readOnly=false}={}){
  if(busy)throw Error('Hay otra sincronización activa');
  await authorized(uid,stamp);
  const {profileName,data}=getState();
  // Las modificaciones del catálogo se conservan primero en el dispositivo:
  // la descarga añadirá referencias sin sobrescribir ni borrar dichos cambios.
  const mode=readOnly?'CUENTA DE PRUEBA: escritura local permitida, subida bloqueada':'CUENTA PERSONAL: edición offline';
  if(!confirmAction('¿Descargar el historial completo, gimnasios, sedes, instrumentos, ejercicios y técnicas a «'+profileName+'»? '+mode+'. Se conservarán las ediciones locales y no se sobrescribirán datos sin autorización.'))return null;
  busy=true;refresh();
  try{
   // Cargar ambos orígenes por completo ANTES de modificar IndexedDB.
   const [legacy,mirror,catalog,remotePhotos]=await Promise.all([
    pages('vw_historial_series',uid),pages('tbl_sync_series',uid),catalogFetch(uid,stamp),photoRows(uid,stamp)
   ]);
   validate(uid,stamp);
   if(!catalog||!Array.isArray(catalog.baseCatalog)||!Array.isArray(catalog.muscles)||!catalog.entities||!Array.isArray(catalog.library)||!Array.isArray(catalog.custom))
    throw Error('Descarga de catálogo incompleta; se conservó el perfil local');
   const photos=await fetchPhotos(uid,stamp,remotePhotos);
   let summary;
   await mutate(local=>{
    validate(uid,stamp);
    const snap=mergeDownloadedCatalog(local,catalog);
    local.baseCatalog=snap.baseCatalog;
    local.muscles=snap.muscles;
    local.entities=snap.entities;
    local.library=snap.library;
    local.custom=snap.custom;
    local.conflicts??=[];
    for(const photo of photos){
     if(photo.decision==='download'){
      if(!applyDownloadedPhoto(local,photo.item,photo.dataUrl,uid)&&
       !local.conflicts.some(x=>x.kind==='photo_conflict'&&x.photoKey===photo.item.photo_key))
       local.conflicts.push({kind:'photo_conflict',photoKey:photo.item.photo_key,currentRevision:photo.item.revision});
     }else if(photo.decision==='conflict'&&
      !local.conflicts.some(x=>x.kind==='photo_conflict'&&x.photoKey===photo.item.photo_key))
      local.conflicts.push({kind:'photo_conflict',photoKey:photo.item.photo_key,currentRevision:photo.item.revision});
    }
    for(const item of snap.catalogWarnings||[]){
     if(!local.conflicts.some(x=>x.kind===item.kind&&(
       item.kind==='catalog_conflict'&&x.catalogKind===item.catalogKind&&x.localId===item.localId||
       item.kind==='reference_conflict'&&x.refId===item.refId
     )))local.conflicts.push(item);
    }
    local.readOnly=false; // La restricción de prueba nunca se aplica al perfil offline.
    local.demo=!!readOnly;
    const alert=legacyAlerts(local,legacy,mirror);
    const known=new Set(local.records.map(sourceKey));
    const removed=new Set(local.tombstones.map(t=>t.syncKey||t.remoteId&&'legacy:'+t.remoteId||t.localId&&'local:'+t.localId));
    const modified=new Set(local.pending.map(x=>x.syncKey||x.remoteId&&'legacy:'+x.remoteId||x.localId&&'local:'+x.localId));
    const overlaid=new Set(mirror.map(x=>x.source_key));
    let oldAdded=0;
    for(const r of legacy){
     const key='legacy:'+r.id;
     if(known.has(key)||removed.has(key)||modified.has(key)||overlaid.has(key))continue;
     local.records.push({...r,id:'cloud:'+r.id,origin:'cloud',remoteId:r.id,syncKey:key,
      lastLegacyPayload:normalizeLegacySnapshot(r),
      cloudVersion:0,weight:Number(r.weight||0),reps:Number(r.reps||0),assistance:Number(r.assistance||0)});
     known.add(key);oldAdded++;
    }
    summary=mergeDownload(local,mirror);
    // Una serie heredada recibida por primera vez desde el espejo conserva
    // también el estado original de la vista vieja como punto de referencia.
    const legacyMap=new Map(legacy.map(item=>['legacy:'+item.id,item]));
    for(const item of local.records){
     const key=sourceKey(item);
     if(!known.has(key)&&key.startsWith('legacy:')&&!item.lastLegacyPayload&&legacyMap.has(key))
      item.lastLegacyPayload=normalizeLegacySnapshot(legacyMap.get(key));
    }
    summary.added+=oldAdded;
    summary.legacyAlerts=alert.changed+alert.missing;
    local.cloudUserId=readOnly?null:uid;local.lastPull=new Date().toISOString();
   });
   refresh();
   notify('Descarga COMPLETA ('+(readOnly?'prueba: edición local':'cuenta personal: edición offline')+'): '+
    catalog.baseCatalog.length+' entradas de catálogo base, '+catalog.muscles.length+' músculos, '+
    catalog.library.length+' ejercicios propios sin sede, '+
    catalog.custom.length+' ejercicios propios con sede, '+photos.filter(x=>x.decision==='download').length+' fotos recibidas y '+
    (summary.added+summary.updated)+' series nuevas/actualizadas. '+
    summary.conflicts+' conflictos; '+summary.legacyAlerts+' alertas de clientes antiguos.');
   return summary;
  }finally{busy=false;refresh();}
 }
 async function resolve(uid,stamp,key,choice){
  if(busy)throw Error('Hay otra sincronización activa');
  validate(uid,stamp);
  const {data}=getState(),c=(data.conflicts||[]).find(x=>x.sourceKey===key);
  if(!c)throw Error('El conflicto ya no existe');
  const message=choice==='local'
   ?'¿Conservar los cambios del dispositivo? Quedarán pendientes de una nueva subida manual con la versión actual del servidor.'
   :'¿Descartar tus cambios locales y aceptar la copia remota? Es recomendable guardar antes una copia de seguridad.';
  if(c.kind==='legacy_unversioned')throw Error('Se detectó una modificación hecha desde una versión antigua sin control de versiones. No es seguro resolverla aquí: guarda un respaldo y actualiza los clientes antes de reconciliarla.');
  if(!confirmAction(message))return;
  await mutate(local=>{
   const item=local.conflicts.find(x=>x.sourceKey===key);
   if(!item)throw Error('El conflicto ya se resolvió');
   const index=local.records.findIndex(x=>sourceKey(x)===key);
   const remoteRecord=item.server;
   const pendingKey=p=>p.syncKey||p.remoteId&&'legacy:'+p.remoteId||p.localId&&'local:'+p.localId;
   local.pending=local.pending.filter(p=>pendingKey(p)!==key);
   local.tombstones=local.tombstones.filter(t=>(t.syncKey||t.remoteId&&'legacy:'+t.remoteId||t.localId&&'local:'+t.localId)!==key);
   if(choice==='cloud'){
    if(index>=0)local.records.splice(index,1);
    if(remoteRecord?.deleted)local.tombstones.push({syncKey:key,at:new Date().toISOString(),
     cloudVersion:remoteRecord.version});
    else if(remoteRecord)local.records.push(remoteToRow(remoteRecord));
   }else if(choice==='local'){
    const row=index>=0?local.records[index]:null;
    if(row){row.cloudVersion=Number(remoteRecord?.version||0);row.syncKey=key;}
    const localId=row?.id||(key.startsWith('legacy:')?'cloud:'+key.slice(7):key.slice(6));
    local.pending.push({id:crypto.randomUUID(),kind:row?'update_series':'delete_series',
     localId:row?.id||localId,syncKey:key,expectedVersion:Number(remoteRecord?.version||0)});
    if(!row)local.tombstones.push({syncKey:key,localId,at:new Date().toISOString(),
     cloudVersion:Number(remoteRecord?.version||0)});
   }else throw Error('Opción de conflicto desconocida');
   local.conflicts=local.conflicts.filter(x=>x.sourceKey!==key);
  });
  refresh();notify('Conflicto resuelto en el perfil local. La subida sigue siendo manual.');
 }
 return {upload,download,resolve,isBusy};
}
