// Operaciones de catálogo independientes de series. Sin red ni acceso a IndexedDB.
const groups={gym:'gyms',site:'sites',machine:'machines',option:'options',exercise:'library'};
const kinds=Object.keys(groups),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function catalogSnapshot(kind,row){
 if(!row)return null;
 const out={nombre:row.nombre,activo:row.activo!==false};
 for(const f of ({site:['gimnasio_id'],machine:['tipo_equipo'],option:['tipo'],
  exercise:['zona_entrenamiento','tecnica_actualizada']}[kind]||[]))
  out[f]=row[f]??null;
 return out;
}
export function catalogPayload(kind,row){
 if(!row)return null;
 const {nombre,gimnasio_id,tipo,tipo_equipo,zona_entrenamiento,tecnica_actualizada}=row;
 return {nombre,...(kind==='site'?{gimnasio_id}:{ }),
  ...(kind==='option'?{tipo}:{}),...(kind==='machine'?{tipo_equipo}:{}),
  ...(kind==='exercise'?{zona_entrenamiento,tecnica_actualizada}:{})};
}
const getRow=(data,kind,id)=>(kind==='exercise'?data.library:data.entities?.[groups[kind]])?.find(x=>String(x.id)===String(id));
export function planCatalogUpload(data,uid){
 const pending=(data.pending||[]).filter(x=>['add_catalog','update_catalog','delete_catalog'].includes(x.kind)),
  byKey=new Map(),ops=[],noops=[],blocked=[];
 for(const change of pending){
  if(!kinds.includes(change.catalogKind)||!uuid.test(String(change.localId))){blocked.push({reason:'invalid_id',change});continue;}
  const key=change.catalogKind+':'+change.localId;
  if(!byKey.has(key))byKey.set(key,[]);
  byKey.get(key).push(change);
 }
 for(const group of byKey.values()){
  const firstSent=group.find(x=>x.submittedRequest);
  const part=firstSent?group.slice(0,group.indexOf(firstSent)+1):group;
  const last=part.at(-1),kind=last.catalogKind,id=last.localId;
  const row=getRow(data,kind,id),tomb=(data.tombstones||[]).find(x=>x.catalogKind===kind&&String(x.localId)===String(id));
  const original=row||tomb,baseline=original?.cloudSnapshot||null;
  if((data.conflicts||[]).some(x=>x.kind==='catalog_conflict'&&x.catalogKind===kind&&x.localId===id)){
   blocked.push({reason:'conflict',change:last});continue;
  }
  if(original?.cloudOwnerId&&original.cloudOwnerId!==uid){
   blocked.push({reason:'other_account',change:last});continue;
  }
  const isCreate=part.some(x=>x.kind==='add_catalog'),isDelete=last.kind==='delete_catalog';
  if(isCreate&&isDelete&&!firstSent&&!baseline){noops.push(...part.map(x=>x.id));continue;}
  if(!firstSent&&!isCreate&&!baseline){blocked.push({reason:'needs_download',change:last});continue;}
  if(!isDelete&&!row){blocked.push({reason:'missing_local',change:last});continue;}
  if(!uuid.test(String(last.id))){blocked.push({reason:'invalid_op',change:last});continue;}
  const req=firstSent?structuredClone(firstSent.submittedRequest):{
   op_id:last.id,id,kind,action:isDelete?'delete':isCreate?'create':'update',
   payload:isDelete?{}:catalogPayload(kind,row),expected:isCreate?null:baseline
  };
  if(req.action==='create'&&kind==='site'){
   const gym=getRow(data,'gym',req.payload.gimnasio_id);
   if(!gym||gym.cloudOwnerId&&gym.cloudOwnerId!==uid){blocked.push({reason:'parent_other_account',change:last});continue;}
  }
  ops.push({request:req,ids:part.map(x=>x.id),localId:id,catalogKind:kind});
 }
 const priority=o=>o.request.action==='delete'
  ?({exercise:0,site:1,option:2,machine:2,gym:3}[o.catalogKind]??4)
  :({gym:0,machine:1,option:1,site:2,exercise:3}[o.catalogKind]??4);
 ops.sort((a,b)=>priority(a)-priority(b));
 return {ops,noops,blocked};
}
export function acknowledgeCatalog(data,planned,result,uid){
 const op=planned.request,kind=planned.catalogKind,id=planned.localId;
 if(result?.op_id!==op.op_id)throw Error('La respuesta del catálogo no corresponde a la solicitud');
 if(result.status==='conflict'){
  data.conflicts??=[];
  if(!data.conflicts.some(x=>x.kind==='catalog_conflict'&&x.catalogKind===kind&&x.localId===id))
   data.conflicts.push({kind:'catalog_conflict',catalogKind:kind,localId:id,reason:result.reason,current:result.current||null});
  return false;
 }
 if(!['applied','duplicate'].includes(result.status)||!result.current)throw Error('Respuesta de sincronización de catálogo inválida');
 const row=getRow(data,kind,id);
 if(row){row.cloudSnapshot=structuredClone(result.current);row.cloudOwnerId=uid;}
 const t=(data.tombstones||[]).find(x=>x.catalogKind===kind&&x.localId===id);
 if(t){t.cloudSnapshot=structuredClone(result.current);t.cloudOwnerId=uid;}
 const accepted=new Set(planned.ids);
 data.pending=data.pending.filter(x=>!accepted.has(x.id));
 return true;
}
