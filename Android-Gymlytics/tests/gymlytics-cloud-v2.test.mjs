import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGymlyticsSeedProfile} from '../web/gymlytics-seed-offline.mjs';
import {CLOUD_SCHEMA,CLOUD_TABLES,prepareGymlyticsTables,detectCloudConflicts,createGymlyticsCloudSync} from '../web/gymlytics-cloud-v2.mjs';
const original=JSON.parse(readFileSync(new URL('../web/data/hojamatriz-offline-20261018.json',import.meta.url),'utf8'));
const userId='c811eb5f-b2e6-4c4a-a60e-295af4e19b90';
const makeProfile=()=>createGymlyticsSeedProfile(original,()=>({}));
const makeDB=()=>{
 const storage=Object.fromEntries(CLOUD_TABLES.map(t=>[t,new Map()]));
 const calls=[];
 function from(name){
  if(!storage[name])throw Error('Tabla antigua consultada: '+name);
  const context={fields:'*',filters:[],type:'select',opts:{},range:[0,Infinity]};
  const filtered=()=>[...storage[name].values()].filter(row=>context.filters.every(([k,v])=>row[k]===v));
  const q={
   select(fields,opts={}){context.type='select';context.fields=fields;context.opts=opts;return q;},
   eq(field,value){context.filters.push([field,value]);return q;},
   order(){return q;},
   range(a,b){calls.push({op:'range',name});return Promise.resolve({data:filtered().sort((a,b)=>a.id.localeCompare(b.id)).slice(a,b+1),error:null});},
   maybeSingle(){calls.push({op:'maybeSingle',name});const rows=filtered();return Promise.resolve({data:rows[0]||null,error:null});},
   insert(row){calls.push({op:'insert',name});const a=Array.isArray(row)?row:[row];
    for(const x of a){if(storage[name].has(x.id))return Promise.resolve({error:{code:'23505',message:'Duplicado'}});storage[name].set(x.id,structuredClone(x));}
    return Promise.resolve({error:null});},
   upsert(rows){calls.push({op:'upsert',name,n:rows.length});for(const row of rows){storage[name].set(row.id,structuredClone(row));}
    return Promise.resolve({error:null});},
   delete(){context.type='delete';return q;},
   in(field,ids){calls.push({op:'delete',name});for(const [id,row] of storage[name])if(ids.includes(row[field]))storage[name].delete(id);
    return Promise.resolve({error:null});},
   then(ok,fail){return Promise.resolve({data:context.opts.head?null:filtered(),count:filtered().length,error:null}).then(ok,fail);}
  };return q;
 }
 return {from,storage,calls};
};
test('El modelo está vinculado exclusivamente a las ocho tablas nuevas',()=>{
 assert.equal(CLOUD_SCHEMA,'sch_gymlytics');
 assert.deepEqual(CLOUD_TABLES,['tbl_usuarios','tbl_perfiles','tbl_gimnasios','tbl_sedes','tbl_ejercicios','tbl_ejercicio_detalles','tbl_sesiones','tbl_series']);
});
test('Se conserva exactamente la identidad y la relación HojaMatriz (9.424 registros)',async()=>{
 const p=makeProfile(),t=await prepareGymlyticsTables(p.data,p.id,p.name,userId);
 assert.equal(t.tbl_gimnasios.length,3);
 assert.equal(t.tbl_sedes.length,16);
 assert.equal(t.tbl_ejercicios.length,146);
 assert.equal(t.tbl_ejercicio_detalles.length,622);
 assert.equal(t.tbl_sesiones.length,446);
 assert.equal(t.tbl_series.length,9424);
 assert.equal(t.tbl_series.filter(s=>s.unidad===null).length,9424);
 assert(t.tbl_series.every(s=>t.tbl_sesiones.some(x=>x.id===s.sesion_id)&&t.tbl_ejercicios.some(x=>x.id===s.ejercicio_id)));
 assert.equal(t.tbl_series[0].id,p.data.records[0].id);
 assert.equal(t.tbl_perfiles[0].id,p.id);
});
test('Reconciliación idempotente, edición real y conflicto no sobrescrito',async()=>{
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 const p=makeProfile(),db=makeDB(),statuses=[];
 let state={profileId:p.id,profileName:p.name,data:p.data};
 const sync=createGymlyticsCloudSync({remote:db,getState:()=>state,mutate:async change=>{const d=structuredClone(state.data);change(d);state.data=d;},
  refresh:()=>{},isCurrent:(uid)=>uid===userId,isLinkedElsewhere:()=>false,confirmAction:()=>true,notify:x=>statuses.push(x)});
 const first=await sync.upload(userId,'test');
 assert(first.done>10000);
 assert.equal(db.storage.tbl_series.size,9424);
 assert.equal(state.data.cloudUserId,userId);
 assert.equal(state.data.demo,false);
 const repeat=await sync.upload(userId,'test');
 assert.equal(repeat.done,0);
 assert.equal(db.storage.tbl_series.size,9424);
 const row=state.data.records[0],before=Number(row.weight);
 row.weight=before+1;
 const edit=await sync.upload(userId,'test');
 assert.equal(edit.done,1);
 assert.equal(db.storage.tbl_series.get(row.id).peso,before+1);
 db.storage.tbl_series.get(row.id).peso=999;
 row.weight=before+2;
 await assert.rejects(()=>sync.upload(userId,'test'),/versiones distintas/);
 assert.equal(state.data.records[0].weight,before+2);
 assert.equal(db.storage.tbl_series.get(row.id).peso,999);
 assert(statuses.some(s=>s.includes('sch_gymlytics')));
});
test('Solo extrae tablas del perfil activo, aunque la cuenta tenga otros perfiles',async()=>{
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 const p=makeProfile(),db=makeDB();let state={profileId:p.id,profileName:p.name,data:p.data};
 const sync=createGymlyticsCloudSync({remote:db,getState:()=>state,mutate:async change=>{const copy=structuredClone(state.data);change(copy);state.data=copy;},
 refresh:()=>{},isCurrent:()=>true,isLinkedElsewhere:()=>false,confirmAction:()=>true,notify:()=>{}});
 const id='2d44ec34-c21e-40f4-98ef-40ca64cfb353';
 db.storage.tbl_perfiles.set(id,{id,usuario_id:userId,nombre:'Otro',modo_sync:'despues'});
 const result=await sync.download(userId,'test');
 assert.equal(result.added,0);
 assert.equal(state.data.records.length,9424);
 assert(!state.data.sessions.some(x=>x.perfil_id===id));
});
