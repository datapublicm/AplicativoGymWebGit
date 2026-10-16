import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogSnapshot,planCatalogUpload,acknowledgeCatalog} from '../web/catalog-sync-engine.js';
import {prepareDownloadedCatalog,mergeDownloadedCatalog,emptyCatalogue} from '../web/offline-catalog-download.js';
const g='00000000-0000-4000-8000-000000000001',s='00000000-0000-4000-8000-000000000002';
const o='00000000-0000-4000-8000-000000000003',p='00000000-0000-4000-8000-000000000004';
const uid='cuenta-propia';
const state=()=>({ ...emptyCatalogue(), pending:[],tombstones:[],conflicts:[]});
const pending=(id,kind,localId,catalogKind)=>({id,kind,localId,catalogKind});
test('Crear gimnasio y luego sede por UUID, nunca al revés',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Evolution'}];
 d.entities.sites=[{id:s,nombre:'VES',gimnasio_id:g}];
 d.pending=[pending(o,'add_catalog',s,'site'),pending(p,'add_catalog',g,'gym')];
 const plan=planCatalogUpload(d,uid);
 assert.deepEqual(plan.ops.map(x=>x.catalogKind),['gym','site']);
 assert.equal(plan.ops[1].request.payload.gimnasio_id,g);
});
test('Un alta seguida de modificación utiliza CREATE con el nombre nuevo',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Evolution Nuevo'}];
 d.pending=[pending(o,'add_catalog',g,'gym'),pending(p,'update_catalog',g,'gym')];
 const plan=planCatalogUpload(d,uid);
 assert.equal(plan.ops.length,1);
 assert.equal(plan.ops[0].request.action,'create');
 assert.equal(plan.ops[0].request.payload.nombre,'Evolution Nuevo');
 assert.deepEqual(plan.ops[0].ids,[o,p]);
});
test('Alta local y baja antes de subir: nunca escribe en Supabase',()=>{
 const d=state();d.pending=[pending(o,'add_catalog',g,'gym'),pending(p,'delete_catalog',g,'gym')];
 assert.equal(planCatalogUpload(d,uid).ops.length,0);
 assert.deepEqual(planCatalogUpload(d,uid).noops,[o,p]);
});
test('Modificar conserva UUID y usa estado descargado como precondición',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Nuevo',cloudOwnerId:uid,cloudSnapshot:{nombre:'Viejo',activo:true}}];
 d.pending=[pending(o,'update_catalog',g,'gym')];
 const op=planCatalogUpload(d,uid).ops[0].request;
 assert.equal(op.id,g);assert.equal(op.action,'update');
 assert.equal(op.expected.nombre,'Viejo');assert.equal(op.payload.nombre,'Nuevo');
});
test('Prohibir subir referencias ajenas descargadas desde otra cuenta',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Prueba editado',cloudOwnerId:'otra-cuenta',cloudSnapshot:{nombre:'Prueba',activo:true}}];
 d.pending=[pending(o,'update_catalog',g,'gym')];
 const plan=planCatalogUpload(d,uid);
 assert.equal(plan.ops.length,0);assert.equal(plan.blocked[0].reason,'other_account');
});
test('Eliminación remota requiere instantánea original',()=>{
 const d=state();d.tombstones=[{catalogKind:'gym',localId:g,cloudOwnerId:uid,cloudSnapshot:{nombre:'Evolution',activo:true}}];
 d.pending=[pending(o,'delete_catalog',g,'gym')];
 const op=planCatalogUpload(d,uid).ops[0].request;
 assert.equal(op.action,'delete');assert.equal(op.expected.nombre,'Evolution');
});
test('ACK idempotente confirma y no duplica registro',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Evolution'}];
 d.pending=[pending(o,'add_catalog',g,'gym')];
 const op=planCatalogUpload(d,uid).ops[0];
 assert.equal(acknowledgeCatalog(d,op,{op_id:o,status:'duplicate',current:{nombre:'Evolution',activo:true}},uid),true);
 assert.equal(d.pending.length,0);assert.equal(d.entities.gyms.length,1);
 assert.equal(d.entities.gyms[0].cloudOwnerId,uid);
});
test('Conflicto no reconoce cambios ni sobrescribe valor local',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Mi cambio'}];
 d.pending=[pending(o,'update_catalog',g,'gym')];
 const plan={request:{op_id:o},ids:[o],localId:g,catalogKind:'gym'};
 assert.equal(acknowledgeCatalog(d,plan,{op_id:o,status:'conflict',reason:'remote_changed',current:{nombre:'Otro',activo:true}},uid),false);
 assert.equal(d.pending.length,1);assert.equal(d.entities.gyms[0].nombre,'Mi cambio');
 assert.equal(d.conflicts[0].kind,'catalog_conflict');
});
test('Descarga conserva lápidas y no resucita un elemento eliminado',()=>{
 const d=state();d.tombstones=[{catalogKind:'gym',localId:g}];
 const cloud=prepareDownloadedCatalog({gyms:[{id:g,user_id:uid,nombre:'Evolution',activo:true}]});
 assert.equal(mergeDownloadedCatalog(d,cloud).entities.gyms.length,0);
});
test('Descarga conserva dueño, baseline y relación sede-gimnasio',()=>{
 const cloud=prepareDownloadedCatalog({gyms:[{id:g,user_id:uid,nombre:'Evolution',activo:true}],
  sites:[{id:s,user_id:uid,gimnasio_id:g,nombre:'VES',activo:true}]});
 assert.equal(cloud.entities.gyms[0].cloudOwnerId,uid);
 assert.equal(cloud.entities.sites[0].cloudSnapshot.gimnasio_id,g);
 assert.deepEqual(catalogSnapshot('site',cloud.entities.sites[0]),cloud.entities.sites[0].cloudSnapshot);
});

test('Migración antigua con modificación sin baseline: no subir hasta revisión explícita',()=>{
 const d=state();d.entities.gyms=[{id:g,nombre:'Mi edición antigua'}];
 d.pending=[pending(o,'update_catalog',g,'gym')];
 const cloud=prepareDownloadedCatalog({gyms:[{id:g,user_id:uid,nombre:'Nombre remoto',activo:true}]});
 const merged=mergeDownloadedCatalog(d,cloud);
 assert.equal(merged.entities.gyms[0].nombre,'Mi edición antigua');
 assert.equal(merged.entities.gyms[0].cloudSnapshot.nombre,'Nombre remoto');
 assert.equal(merged.catalogWarnings.length,1);
 assert.equal(merged.catalogWarnings[0].kind,'catalog_conflict');
 assert.equal(d.entities.gyms[0].cloudSnapshot,undefined,'la fusión original no se modifica');
});

test('Ejercicio descargado con sede: se modifica con el mismo identificador',()=>{
 const d=state(), id='00000000-0000-4000-8000-000000000006';
 d.custom=[{id,cloud_id:id,nombre:'Remo actualizado',e:'Remo actualizado',
  gimnasio_id:g,sede_id:s,cloudOwnerId:uid,
  cloudSnapshot:{nombre:'Remo',activo:true,zona_entrenamiento:'Espalda',tecnica_actualizada:'Base'},
  zona_entrenamiento:'Espalda',tecnica_actualizada:'Base'}];
 d.pending=[pending(o,'update_catalog',id,'exercise')];
 const plan=planCatalogUpload(d,uid);
 assert.equal(plan.ops.length,1);assert.equal(plan.ops[0].request.action,'update');
 assert.equal(plan.ops[0].request.id,id);
 assert.equal(plan.ops[0].request.payload.nombre,'Remo actualizado');
});
