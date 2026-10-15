import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyAlerts,normalizeLegacySnapshot} from '../web/legacy-compat.js';
import {mergeDownload,planUpload} from '../web/sync-engine.js';

const uuid='9fda531e-2761-4f9a-b6be-e12925e62300',key='legacy:'+uuid;
const legacy=(weight=50)=>({id:uuid,date:'2026-10-15',gym:'Smart Fit',sede:'Lima',
 exercise:'Prensa',series:'Serie 1',unit:'kg',weight,reps:12,assistance:0,notes:'Base'});
const own=(weight=50)=>({...legacy(weight),id:'cloud:'+uuid,remoteId:uuid,syncKey:key,
 origin:'cloud',cloudVersion:0,lastLegacyPayload:normalizeLegacySnapshot(legacy())});
const state=(records=[own()])=>({records,pending:[],tombstones:[],conflicts:[],cloudUserId:null});
const mirror=(weight=50)=>({source_key:key,payload:normalizeLegacySnapshot(legacy(weight)),
 version:2,deleted:false,updated_at:'2026-10-15T15:00:00Z'});

test('Leer varias veces datos de versión 01.05 sin cambios no genera falsos conflictos',()=>{
 const local=state();
 assert.deepEqual(legacyAlerts(local,[legacy()],[]),{changed:0,missing:0});
 assert.equal(local.conflicts.length,0);
 assert.equal(legacyAlerts(local,[legacy()],[]).changed,0);
});
test('Cambio en web antigua genera alerta y NO sobreescribe el entrenamiento offline',()=>{
 const local=state(),old=legacy(77);
 assert.equal(legacyAlerts(local,[old],[]).changed,1);
 assert.equal(local.conflicts[0].kind,'legacy_unversioned');
 assert.equal(local.conflicts[0].server.payload.weight,77);
 assert.equal(local.records[0].weight,50);
 assert.equal(mergeDownload(local,[mirror(66)]).updated,0);
 assert.equal(local.records[0].weight,50,'No se debe actualizar automáticamente al existir conflicto');
});
test('Eliminación desde cliente antiguo exige revisión, sin borrar automáticamente el local',()=>{
 const local=state();
 assert.equal(legacyAlerts(local,[],[]).missing,1);
 assert.equal(local.conflicts[0].server.deleted,true);
 assert.equal(local.records.length,1);
});
test('Borrado del historial antiguo se detecta aun si existe su espejo',()=>{
 const local=state();
 const result=legacyAlerts(local,[],[mirror()]);
 assert.deepEqual(result,{changed:0,missing:1});
 assert.equal(local.conflicts[0].kind,'legacy_unversioned');
 assert.equal(local.records.length,1,'Conservar datos hasta una conciliación segura');
});
test('Si cliente antiguo actualiza tras cambio en espejo se bloquea la subida conflictiva',()=>{
 const local=state();local.records[0].weight=65;
 local.records[0].cloudVersion=2;
 local.pending.push({id:'8315bb45-a204-4735-a2cc-39d6a48a5812',kind:'update_series',
 localId:local.records[0].id,syncKey:key,expectedVersion:2});
 legacyAlerts(local,[legacy(80)],[mirror(65)]);
 const upload=planUpload(local);
 assert.equal(upload.ops.length,0);assert.equal(upload.blocked.length,1);
 assert.equal(local.records[0].weight,65);
});
test('Migración inicial de registros históricos anteriores preserva baseline',()=>{
 const data=state([{...own(),lastLegacyPayload:null}]);
 assert.equal(legacyAlerts(data,[legacy()],[]).changed,0);
 assert.equal(data.records[0].lastLegacyPayload.weight,50);
});
test('Historial ajeno y series offline sin origen cloud no generan alertas de clientes antiguos',()=>{
 const offline={id:'3c0610e7-7bd2-43b4-b590-f08224323234',origin:'offline',weight:77};
 const data=state([offline]);legacyAlerts(data,[legacy(80)],[]);
 assert.equal(data.conflicts.length,0);
});
