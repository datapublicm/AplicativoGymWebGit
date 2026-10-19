// Gymlytics 01.06 — cola pura de fotografías offline, idempotente por revisión.
const SIDES=['frontal','posterior','lateral_izquierda','lateral_derecha'];
const TYPES={maquina:'equipo',ejercicio:'ejercicio',musculos:'anatomia'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function photoLocalKey(exercise,type,side=null){
 if(!TYPES[type])throw Error('Tipo de fotografía inválido');
 if(type==='musculos'&&!SIDES.includes(side))throw Error('Selecciona una vista anatómica');
 if(type!=='musculos'&&side)throw Error('La vista sólo corresponde a fotografías musculares');
 const fields=[exercise?.g,exercise?.s,exercise?.i];
 if(type!=='maquina')fields.push(exercise?.e);
 if(fields.some(v=>!String(v??'').trim()))throw Error('Selecciona un gimnasio, sede y ejercicio válidos');
 const context=fields.map(v=>String(v).trim()).join('|');
 return TYPES[type]+':'+(side?side+':':'')+context;
}
export const photoRevisionPath=(uid,revision)=>{
 if(!UUID.test(String(uid))||!UUID.test(String(revision)))throw Error('Identificador inválido para Storage');
 return uid+'/gymlytics/'+revision+'.jpg';
};
export function photoJobPlan(data,uid){
 const ops=[],blocked=[];
 const versions=data.photoVersions||{},payloads=data.photoPayloads||{};
 const conflicted=new Set((data.conflicts||[]).filter(x=>x.kind==='photo_conflict').map(x=>x.photoKey));
 for(const job of data.pending||[]){
  if(job.kind!=='photo')continue;
  if(!job.photoKey||!UUID.test(String(job.id))||!['maquina','ejercicio','musculos'].includes(job.photoType)){
   blocked.push({job,reason:'legacy_photo_pending'});continue;
  }
  if(conflicted.has(job.photoKey)){blocked.push({job,reason:'conflict'});continue;}
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=\s]+$/.test(payloads[job.id]||'')){
   blocked.push({job,reason:'missing_photo_blob'});continue;
  }
  const before=versions[job.photoKey];
  if(before?.ownerId&&before.ownerId!==uid){blocked.push({job,reason:'other_account'});continue;}
  const expected=job.submittedRequest?.expected_revision??
   (before?.revision||null);
  const request=job.submittedRequest||{photo_key:job.photoKey,tipo_referencia:job.photoType,
   vista:job.side||null,revision:job.id,expected_revision:expected,
   storage_path:photoRevisionPath(uid,job.id)};
  ops.push({request,payload:payloads[job.id],jobId:job.id,photoKey:job.photoKey});
 }
 return {ops,blocked};
}
export function acknowledgePhoto(data,planned,response,uid){
 const request=planned.request;
 if(response?.photo_key!==request.photo_key||!['applied','duplicate','conflict'].includes(response.status))
  throw Error('Respuesta de fotografía inesperada');
 if(response.status==='conflict'){
  data.conflicts??=[];
  if(!data.conflicts.some(x=>x.kind==='photo_conflict'&&x.photoKey===request.photo_key))
   data.conflicts.push({kind:'photo_conflict',photoKey:request.photo_key,currentRevision:response.current_revision||null});
  return false;
 }
 if(response.revision!==request.revision)throw Error('La revisión confirmada no coincide');
 data.photoVersions??={};
 data.photoVersions[request.photo_key]={revision:request.revision,ownerId:uid};
 data.photoPayloads??={};delete data.photoPayloads[planned.jobId];
 data.pending=data.pending.filter(x=>x.id!==planned.jobId);
 return true;
}
export function decidePhotoDownload(local,remote,uid){
 if(!remote?.photo_key||!remote.revision||!remote.storage_path)throw Error('Metadatos remotos incompletos');
 const existing=local.photoVersions?.[remote.photo_key];
 const pending=(local.pending||[]).some(p=>p.kind==='photo'&&
  (p.photoKey===remote.photo_key||p.key===remote.photo_key));
 if(pending||existing?.ownerId&&existing.ownerId!==uid)return 'keep';
 if(existing?.revision===remote.revision)return 'same';
 if(local.photos?.[remote.photo_key]&&(!existing||existing.revision!==remote.revision))return 'conflict';
 return 'download';
}
export function applyDownloadedPhoto(local,remote,dataUrl,uid){
 if(decidePhotoDownload(local,remote,uid)!=='download')return false;
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=\s]+$/.test(dataUrl))throw Error('Foto descargada inválida');
 local.photos??={};local.photoVersions??={};
 local.photos[remote.photo_key]=dataUrl;
 local.photoVersions[remote.photo_key]={revision:remote.revision,ownerId:uid};
 return true;
}

export function migrateLegacyPhotoJobs(data){
 data.photoVersions??={};data.photoPayloads??={};data.photos??={};
 if(!Array.isArray(data.pending))data.pending=[];
 let converted=0,unresolved=0;
 const legacy=new Map();
 for(const job of data.pending){
  if(job.kind!=='photo'||job.photoKey)continue;
  const suffix=String(job.key||'');
  const candidates=[['equipo:'+suffix,'maquina'],['ejercicio:'+suffix,'ejercicio']]
   .filter(([key])=>/^data:image\/jpeg;base64,/.test(data.photos[key]||''));
  if(candidates.length!==1||!UUID.test(String(job.id))){unresolved++;continue;}
  const [photoKey,photoType]=candidates[0];
  if(legacy.has(photoKey))legacy.get(photoKey).push(job);
  else legacy.set(photoKey,[job]);
 }
 const obsolete=new Set();
 for(const [photoKey,jobs] of legacy){
  const newest=jobs.at(-1);
  if(jobs.some(x=>x.submittedRequest)){unresolved+=jobs.length;continue;}
  for(const old of jobs.slice(0,-1))obsolete.add(old.id);
  newest.photoKey=photoKey;
  newest.photoType=photoKey.startsWith('equipo:')?'maquina':'ejercicio';
  newest.side=null;newest.createdAt=newest.at||new Date(0).toISOString();
  data.photoPayloads[newest.id]=data.photos[photoKey];
  converted++;
 }
 if(obsolete.size)data.pending=data.pending.filter(x=>!obsolete.has(x.id));
 return {converted,unresolved,removed:obsolete.size};
}
