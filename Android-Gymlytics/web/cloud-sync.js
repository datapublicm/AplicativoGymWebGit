import {sourceKey,remoteToRow,planUpload,mergeDownload,acknowledge} from './sync-engine.js';

// Adaptador de red sin sincronización automática. Las mutaciones se confirman
// primero en IndexedDB y los conflictos requieren decisión humana.
export function createCloudSync({remote,getState,mutate,refresh,isCurrent,isLinkedElsewhere,confirmAction,notify}){
 let busy=false;
 const isBusy=()=>busy;
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
  const column=table==='tbl_sync_series'?'source_key':'id';
  const count=await remote.from(table).select(column,{count:'exact',head:true}).eq('user_id',uid);
  if(count.error||!Number.isSafeInteger(count.count)||count.count<0)
   throw Error('No se pudo comprobar el total remoto de '+table);
  const result=[],seen=new Set(),size=500;
  for(let start=0;start<count.count;start+=size){
   const sort=table==='tbl_sync_series'?'source_key':'date';
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
 async function upload(uid,stamp){
  if(busy)throw Error('Hay otra sincronización activa');
  await authorized(uid,stamp);
  const {data,profileName}=getState(),plan=planUpload(data);
  if(!plan.ops.length){notify('No hay series listas para subir; otros tipos de cambios siguen pendientes.');return {done:0,blocked:plan.blocked.length};}
  if(!confirmAction('¿Subir '+plan.ops.length+' cambios de series de '+profileName+'? Solo se aplicarán si coinciden las versiones. '+plan.blocked.length+' operaciones no compatibles seguirán pendientes.'))return null;
  busy=true;refresh();
  let done=0,duplicates=0,conflicts=0;
  try{
   for(let i=0;i<plan.ops.length;i+=50){
    validate(uid,stamp);
    const chunk=plan.ops.slice(i,i+50);
    const response=await remote.rpc('aplicar_cambios_offline',{p_changes:chunk});
    if(response.error)throw response.error;
    if(!Array.isArray(response.data))throw Error('El servidor devolvió una respuesta inválida');
    validate(uid,stamp);
    await mutate(local=>{
     validate(uid,stamp);
     const result=acknowledge(local,chunk,response.data);
     local.cloudUserId=uid;done+=result.done;duplicates+=result.duplicate;conflicts=result.conflicts;
    });
   }
   notify('Subida confirmada: '+done+' operaciones · '+duplicates+' reintentos idempotentes · '+conflicts+' conflictos.');
   return {done,duplicates,conflicts};
  }finally{busy=false;refresh();}
 }
 async function download(uid,stamp){
  if(busy)throw Error('Hay otra sincronización activa');
  await authorized(uid,stamp);
  const {profileName}=getState();
  if(!confirmAction('¿Descargar al perfil '+profileName+'? Se unirán los datos sin sobrescribir ediciones o eliminaciones locales; los conflictos se revisarán aparte.'))return null;
  busy=true;refresh();
  try{
   const [legacy,mirror]=await Promise.all([pages('vw_historial_series',uid),pages('tbl_sync_series',uid)]);
   validate(uid,stamp);
   let summary;
   await mutate(local=>{
    validate(uid,stamp);
    const known=new Set(local.records.map(sourceKey));
    const removed=new Set(local.tombstones.map(t=>t.syncKey||t.remoteId&&'legacy:'+t.remoteId||t.localId&&'local:'+t.localId));
    const modified=new Set(local.pending.map(x=>x.syncKey||x.remoteId&&'legacy:'+x.remoteId||x.localId&&'local:'+x.localId));
    const overlaid=new Set(mirror.map(x=>x.source_key));
    let oldAdded=0;
    for(const r of legacy){
     const key='legacy:'+r.id;
     if(known.has(key)||removed.has(key)||modified.has(key)||overlaid.has(key))continue;
     local.records.push({...r,id:'cloud:'+r.id,origin:'cloud',remoteId:r.id,syncKey:key,
      cloudVersion:0,weight:Number(r.weight||0),reps:Number(r.reps||0),assistance:Number(r.assistance||0)});
     known.add(key);oldAdded++;
    }
    summary=mergeDownload(local,mirror);
    summary.added+=oldAdded;
    local.cloudUserId=uid;local.lastPull=new Date().toISOString();
   });
   refresh();
   notify('Descarga completada: '+summary.added+' nuevas, '+summary.updated+' actualizadas, '+summary.conflicts+' conflictos. No se perdieron cambios locales.');
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
