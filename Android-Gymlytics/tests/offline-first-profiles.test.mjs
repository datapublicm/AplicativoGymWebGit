import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const src=file('../web/offline-first.js'),html=file('../web/index.html');
const start=src.indexOf('const api={'),end=src.indexOf('\nfunction refreshCloudControls()',start);
assert.ok(start>=0&&end>start,'Existe el motor local de operaciones');
const methods=src.slice(start,end);
function fixture(){
 const h=`
let serial=0,latest={data:{
 records:[],photos:{},custom:[],library:[],entities:{gyms:[],sites:[],machines:[],options:[]},
 tombstones:[],pending:[],cloudUserId:null,lastPull:null
}};
const uuid=()=> 'uuid-'+(++serial);
const tidy=x=>String(x??'').trim();
const flush=async update=>update(latest.data);
const catalogUpdate=()=>{};
const snapshot=()=>structuredClone(latest.data);
const activeId='local-uno',profileEpoch=1,window={GymBaseCatalog:[]};
const stamp=()=>activeId+':'+profileEpoch;
const catalogInit=()=>[];
${methods}
({save:entry=>api.saveWorkout(entry),remove:id=>api.deleteSeries(id),
 data:()=>JSON.parse(JSON.stringify(latest.data)),setCloudRow:r=>latest.data.records.push(r)});
`;
 return runInNewContext(h);
}
const workout=()=>({exercise:{g:'Gimnasio',s:'Sede',z:'Pierna',kind:'Máquina',
 i:'Prensa',a:'No especificado',gr:'No especificado',e:'Prensa de piernas'},
 date:'2026-10-15',technique:'Controlado (4-6 seg)',notes:'Sin molestias',
 entries:[{series:'Serie 1',sub:'-',unit:'kg',weight:60,reps:12,assistance:0}]});
test('La navegación del Catálogo, Registro, Tablas y Dashboard no exige iniciar sesión',()=>{
 for(const page of ['catalogos','registro','tablas','dashboard'])
  assert.match(html,new RegExp('data-page="'+page+'"'));
 assert.match(html,/offline-profile-panel/);
 assert.match(html,/id="offlineProfiles"/);
 assert.doesNotMatch(html,/id="authStatus"[^>]*>Comprobando configuración de Supabase/);
 assert.match(src,/window.GymCloud=api/);
});
test('Guardar series offline crea IDs únicos y una operación pendiente durable',async()=>{
 const h=fixture();
 await h.save(workout());await h.save(workout());
 const data=h.data();
 assert.equal(data.records.length,2);
 assert.notEqual(data.records[0].id,data.records[1].id);
 assert.equal(data.pending.length,2);
 assert.ok(data.records.every(r=>r.origin==='offline'&&r.weight===60&&r.reps===12));
});
test('Eliminar un registro local no lo sube y mantiene lápida antirresurrección',async()=>{
 const h=fixture();await h.save(workout());
 const id=h.data().records[0].id;
 await h.remove(id);
 const data=h.data();
 assert.equal(data.records.length,0);
 assert.equal(data.pending.length,0);
 assert.equal(data.tombstones[0].localId,id);
 assert.equal(data.tombstones[0].remoteId,null);
});
test('Eliminar registro descargado conserva remoteId para no reimportarlo',async()=>{
 const h=fixture();h.setCloudRow({id:'cloud:serie-99',remoteId:'serie-99',origin:'cloud'});
 await h.remove('cloud:serie-99');
 const data=h.data();
 assert.equal(data.records.length,0);
 assert.equal(data.tombstones[0].remoteId,'serie-99');
 assert.equal(data.pending.length,1);
 assert.equal(data.pending[0].kind,'delete_series');
});
test('Sin sincronización automática; descarga voluntaria y separada por cuenta',()=>{
 assert.match(src,/if\(!confirm\('¿Descargar y unir/);
 assert.match(src,/if\(data.cloudUserId&&data.cloudUserId!==uid\)/);
 assert.match(src,/removed.has\(id\)/);
 assert.match(src,/remoteId:id,origin:'cloud'/);
 assert.match(src,/data.pending.push/);
});
