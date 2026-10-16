import test from 'node:test';
import assert from 'node:assert/strict';
import {photoLocalKey,photoRevisionPath,photoJobPlan,acknowledgePhoto,decidePhotoDownload,applyDownloadedPhoto} from '../web/photo-sync-engine.js';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const ex={g:'Smart Fit',s:'La Rambla',i:'Polea alta',e:'Jalón al pecho'};
const id='33333333-3333-4333-8333-333333333333',id2='44444444-4444-4444-8444-444444444444';
const bytes='data:image/jpeg;base64,'+Buffer.from('jpeg-simulation').toString('base64');
const state=()=>({pending:[],photoVersions:{},photoPayloads:{},photos:{},conflicts:[]});
test('Foto de máquina, ejercicio y músculos tienen claves distintas',()=>{
 const keys=new Set([photoLocalKey(ex,'maquina'),photoLocalKey(ex,'ejercicio'),photoLocalKey(ex,'musculos','frontal'),photoLocalKey(ex,'musculos','posterior')]);
 assert.equal(keys.size,4);
 assert.throws(()=>photoLocalKey(ex,'musculos'),/vista/);
});
test('Fotos de sedes distintas no comparten identificador',()=>{
 assert.notEqual(photoLocalKey(ex,'ejercicio'),photoLocalKey({...ex,s:'Otra sede'},'ejercicio'));
});
test('La ruta Storage es privada por uid y operación',()=>{
 assert.equal(photoRevisionPath(uid,id),uid+'/gymlytics/'+id+'.jpg');
 assert.throws(()=>photoRevisionPath('otro-usuario',id));
});
test('Planifica JPEG pendiente y conserva versión original',()=>{
 const d=state(),key=photoLocalKey(ex,'ejercicio');
 d.pending.push({kind:'photo',id,photoKey:key,photoType:'ejercicio'});
 d.photoPayloads[id]=bytes;
 const p=photoJobPlan(d,uid);
 assert.equal(p.ops.length,1);
 assert.equal(p.ops[0].request.expected_revision,null);
 assert.equal(p.ops[0].request.storage_path,uid+'/gymlytics/'+id+'.jpg');
});
test('Confirma subida, limpia cola y conserva versión',()=>{
 const d=state(),key=photoLocalKey(ex,'maquina');
 d.pending.push({kind:'photo',id,photoKey:key,photoType:'maquina'});d.photoPayloads[id]=bytes;
 const p=photoJobPlan(d,uid).ops[0];
 assert.equal(acknowledgePhoto(d,p,{status:'applied',photo_key:key,revision:id},uid),true);
 assert.equal(d.pending.length,0);assert.equal(d.photoPayloads[id],undefined);
 assert.equal(d.photoVersions[key].revision,id);
});
test('Segunda foto usa revisión confirmada sin sobrescribir sin control',()=>{
 const d=state(),key=photoLocalKey(ex,'ejercicio');
 d.photoVersions[key]={ownerId:uid,revision:id};
 d.pending.push({kind:'photo',id:id2,photoKey:key,photoType:'ejercicio'});d.photoPayloads[id2]=bytes;
 const p=photoJobPlan(d,uid).ops[0].request;
 assert.equal(p.expected_revision,id);assert.equal(p.revision,id2);
});
test('Bloquea subir fotografías de otra cuenta',()=>{
 const d=state(),key=photoLocalKey(ex,'ejercicio');
 d.photoVersions[key]={ownerId:other,revision:id};
 d.pending.push({kind:'photo',id:id2,photoKey:key,photoType:'ejercicio'});d.photoPayloads[id2]=bytes;
 assert.equal(photoJobPlan(d,uid).blocked[0].reason,'other_account');
});
test('Reintento confirmado mantiene la misma solicitud',()=>{
 const d=state(),key=photoLocalKey(ex,'maquina');
 const request={photo_key:key,tipo_referencia:'maquina',vista:null,revision:id,
  expected_revision:null,storage_path:photoRevisionPath(uid,id)};
 d.pending.push({kind:'photo',id,photoKey:key,photoType:'maquina',submittedRequest:request});d.photoPayloads[id]=bytes;
 assert.deepEqual(photoJobPlan(d,uid).ops[0].request,request);
 assert.equal(acknowledgePhoto(d,photoJobPlan(d,uid).ops[0],{status:'duplicate',photo_key:key,revision:id},uid),true);
});
test('Conflicto preserva imagen y operación local',()=>{
 const d=state(),key=photoLocalKey(ex,'ejercicio');
 d.pending.push({kind:'photo',id,photoKey:key,photoType:'ejercicio'});d.photoPayloads[id]=bytes;d.photos[key]=bytes;
 const p=photoJobPlan(d,uid).ops[0];
 assert.equal(acknowledgePhoto(d,p,{status:'conflict',photo_key:key,current_revision:id2},uid),false);
 assert.equal(d.pending.length,1);assert.equal(d.photos[key],bytes);
 assert.equal(d.conflicts[0].kind,'photo_conflict');
});
test('Descarga sin pendiente rellena perfil local',()=>{
 const d=state(),key=photoLocalKey(ex,'musculos','frontal');
 const cloud={photo_key:key,revision:id,storage_path:photoRevisionPath(uid,id)};
 assert.equal(decidePhotoDownload(d,cloud,uid),'download');
 assert.equal(applyDownloadedPhoto(d,cloud,bytes,uid),true);
 assert.equal(d.photos[key],bytes);
 assert.equal(decidePhotoDownload(d,cloud,uid),'same');
});
test('Descarga no pisa ediciones locales pendientes',()=>{
 const d=state(),key=photoLocalKey(ex,'ejercicio');
 d.photos[key]=bytes;
 d.pending.push({kind:'photo',id:id2,photoKey:key,photoType:'ejercicio'});
 assert.equal(decidePhotoDownload(d,{photo_key:key,revision:id,storage_path:photoRevisionPath(uid,id)},uid),'keep');
});
test('Foto remota distinta y edición local anterior generan conflicto',()=>{
 const d=state(),key=photoLocalKey(ex,'maquina');
 d.photos[key]=bytes;d.photoVersions[key]={ownerId:uid,revision:id};
 assert.equal(decidePhotoDownload(d,{photo_key:key,revision:id2,storage_path:photoRevisionPath(uid,id2)},uid),'conflict');
});
