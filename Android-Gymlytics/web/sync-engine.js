// Motor puro y verificable: Gymlytics 01.06. Sin red, reloj ni acceso a IndexedDB.
export const SYNC_FIELDS=['date','gym','sede','zone','type','equipment','accessory','grip',
 'exercise','technique','notes','series','subdivision','unit','weight','reps','assistance','createdAt'];
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sourceKey=row=>{
 if(row.syncKey)return row.syncKey;
 if(row.origin==='cloud'||row.origin==='legacy'||row.remoteId)
  return 'legacy:'+String(row.remoteId||row.id).replace(/^cloud:/,'');
 return 'local:'+row.id;
};
export function payloadOf(row){
 const out={};for(const key of SYNC_FIELDS)if(row[key]!==undefined)out[key]=row[key];
 return out;
}
export function remoteToRow(value){
 const payload=value.payload||{},source=value.source_key;
 return {...payload,id:source.startsWith('legacy:')?'cloud:'+source.slice(7):source.slice(6),
  syncKey:source,remoteId:source.startsWith('legacy:')?source.slice(7):null,
  origin:source.startsWith('legacy:')?'cloud':'offline',cloudVersion:Number(value.version||0),
  lastServerPayload:payloadOf(payload),deleted:!!value.deleted};
}
export function planUpload(data){
 const ops=[],blocked=[],seen=new Set();
 for(const change of data.pending||[]){
  if(!['create_series','delete_series','update_series'].includes(change.kind)){
   blocked.push(change);continue;
  }
  const row=(data.records||[]).find(x=>x.id===change.localId);
  const key=change.syncKey||row&&sourceKey(row)||change.remoteId&&'legacy:'+change.remoteId||
   'local:'+change.localId;
  if(!key||seen.has(key))continue;
  // Combinar cambios sobre una misma serie en una única operación vigente.
  seen.add(key);
  const related=data.pending.filter(x=>x.localId===change.localId&&
   ['create_series','delete_series','update_series'].includes(x.kind));
  const last=related.at(-1);
  const found=(data.conflicts||[]).some(c=>c.sourceKey===key);
  if(found){blocked.push(...related);continue;}
  // Si la red cortó después del commit, repetir idéntico op_id y payload.
  // Ningún cambio posterior puede alterar una petición ya enviada.
  const submitted=related.find(x=>x.submittedRequest);
  const item=submitted?structuredClone(submitted.submittedRequest):{
   op_id:last.id,source_key:key,action:last.kind==='delete_series'?'delete':'upsert',
   expected_version:Math.max(0,Number(last.expectedVersion??row?.cloudVersion??0)),
   ...(last.kind==='delete_series'?{}:{payload:payloadOf(row||{})})
  };
  if(item.action==='upsert'&&!row&&!submitted)throw Error('El registro pendiente '+key+' ya no existe');
  if(!uuidPattern.test(item.op_id)||!/^(local|legacy):[0-9a-f-]{36}$/i.test(key))
   throw Error('Identificador de sincronización inválido: '+key);
  ops.push(item);
 }
 return {ops,blocked};
}
export function mergeDownload(data,remoteRows){
 const records=data.records||[],pending=data.pending||[],deleted=data.tombstones||[],
  removed=new Set(deleted.map(t=>t.syncKey||t.remoteId&&'legacy:'+t.remoteId||t.localId&&'local:'+t.localId)),
  dirty=new Set(pending.filter(x=>['create_series','delete_series','update_series'].includes(x.kind))
   .map(p=>p.syncKey||p.remoteId&&'legacy:'+p.remoteId||p.localId&&'local:'+p.localId)),
  conflicts=new Map((data.conflicts||[]).map(c=>[c.sourceKey,c]));
 let added=0,updated=0,hidden=0;
 for(const remote of remoteRows){
  const key=remote.source_key;
  if(!/^(local|legacy):[0-9a-f-]{36}$/i.test(key))throw Error('Clave de nube inválida');
  const current=records.find(r=>sourceKey(r)===key),version=Number(remote.version);
  if(!Number.isSafeInteger(version)||version<1)throw Error('Versión inválida en la nube');
  if(dirty.has(key)){
   if(version!==Number(current?.cloudVersion||0)&&!conflicts.has(key))
    conflicts.set(key,{sourceKey:key,server:remote,local:current?payloadOf(current):null,
     kind:'concurrent_change'});
   continue;
  }
  if(conflicts.has(key)||removed.has(key))continue;
  if(remote.deleted){
   if(current){records.splice(records.indexOf(current),1);hidden++}
   deleted.push({syncKey:key,remoteId:key.startsWith('legacy:')?key.slice(7):null,
    localId:current?.id||key.slice(6),at:remote.updated_at||null,cloudVersion:version});
   continue;
  }
  if(current){
   if(version>Number(current.cloudVersion||0)){
    Object.assign(current,remoteToRow(remote));updated++;
   }
  }else{records.push(remoteToRow(remote));added++}
 }
 data.conflicts=[...conflicts.values()];
 return {added,updated,hidden,conflicts:conflicts.size};
}
export function acknowledge(data,submitted,results){
 const byId=new Map(results.map(x=>[String(x.op_id),x]));
 const accepted=new Set(),conflicts=new Map((data.conflicts||[]).map(c=>[c.sourceKey,c]));
 let done=0,duplicate=0;
 for(const op of submitted){
  const result=byId.get(op.op_id);
  if(!result)throw Error('El servidor no respondió a la operación '+op.op_id);
  if(result.status==='conflict'){
   conflicts.set(op.source_key,{sourceKey:op.source_key,server:result.current,
    local:op.action==='upsert'?op.payload:null,kind:'version_conflict'});
   continue;
  }
  if(!['applied','duplicate'].includes(result.status))throw Error('Respuesta desconocida de Supabase');
  // Un ACK confirma la última operación enviada y cualquier modificación anterior
  // del mismo registro, pero NO una modificación posterior al envío.
  const related=(data.pending||[]).filter(x=>x.localId===op.source_key.slice(6)||
   x.remoteId&&op.source_key==='legacy:'+x.remoteId||
   x.syncKey===op.source_key);
  let reached=false;
  for(const item of related){
   accepted.add(item.id);
   if(item.id===op.op_id){reached=true;break;}
  }
  if(!reached)throw Error('La respuesta confirmó una operación que ya no está en la cola');
  // Las ediciones realizadas después del intento anterior deben usar la
  // versión recién confirmada, pero conservan un op_id distinto.
  let past=false;
  for(const item of related){
   if(past)item.expectedVersion=Number(result.version);
   if(item.id===op.op_id)past=true;
  }
  done++;if(result.status==='duplicate')duplicate++;
  const record=data.records.find(r=>sourceKey(r)===op.source_key);
  if(record){
   record.cloudVersion=Number(result.version);
   record.syncKey=op.source_key;
   record.lastServerPayload=op.action==='upsert'?structuredClone(op.payload):payloadOf(record);
  }
  for(const t of data.tombstones||[]){
   if(t.syncKey===op.source_key||op.action==='delete'&&(t.localId===op.source_key.slice(6)||t.remoteId&&op.source_key==='legacy:'+t.remoteId))
    t.cloudVersion=Number(result.version);
  }
  conflicts.delete(op.source_key);
 }
 data.pending=(data.pending||[]).filter(p=>!accepted.has(p.id));
 data.conflicts=[...conflicts.values()];
 return {done,duplicate,conflicts:conflicts.size};
}
