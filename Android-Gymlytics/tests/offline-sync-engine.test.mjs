import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceKey,planUpload,mergeDownload,acknowledge,payloadOf} from '../web/sync-engine.js';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const mk=(n,weight=25)=>({id:id(n),origin:'offline',date:'2026-10-15',gym:'Evolution',
 sede:'VES',exercise:'Remo en barra T',series:'Serie 1',unit:'kg',weight,reps:10,
 cloudVersion:0,remoteId:null});
const initial=()=>({records:[],pending:[],tombstones:[],conflicts:[],cloudUserId:null});
const send=(server,ops)=>{
 const out=[];
 for(const op of ops){
  const old=server.logs.get(op.op_id);
  if(old){
   assert.deepEqual(old.request,op);
   out.push({...old.answer,status:old.answer.status==='applied'?'duplicate':old.answer.status});
   continue;
  }
  const row=server.rows.get(op.source_key);
  const result=row&&row.version!==op.expected_version||
   !row&&op.expected_version!==0
   ?{op_id:op.op_id,status:'conflict',current:row||null}:(()=>{
    const updated={source_key:op.source_key,version:row?row.version+1:1,
      deleted:op.action==='delete',payload:op.action==='upsert'?op.payload:row?.payload||{},
      updated_at:'2026-10-15T15:00:00Z'};
    server.rows.set(op.source_key,updated);
    return {op_id:op.op_id,status:'applied',version:updated.version};
   })();
  server.logs.set(op.op_id,{request:op,answer:result});
  out.push(result);
 }
 return out;
};
const server=()=>({rows:new Map(),logs:new Map()});
const change=(data,row,n,kind='create_series')=>{
 data.records.push(row);data.pending.push({id:id(n),kind,localId:row.id,
  syncKey:sourceKey(row),expectedVersion:Number(row.cloudVersion||0)});
};
test('Alta offline -> nube -> segundo dispositivo sin duplicación',()=>{
 const cloud=server(),a=initial(),b=initial();
 const row=mk(1);change(a,row,100);
 const ops=planUpload(a).ops;assert.equal(ops.length,1);
 acknowledge(a,ops,send(cloud,ops));
 assert.equal(a.pending.length,0);assert.equal(row.cloudVersion,1);
 const merged=mergeDownload(b,[...cloud.rows.values()]);
 assert.equal(merged.added,1);assert.equal(b.records[0].weight,25);
 assert.equal(mergeDownload(b,[...cloud.rows.values()]).added,0);
 assert.equal(b.records.length,1);assert.equal(cloud.rows.size,1);
});
test('Repetir la misma operación idempotente no genera otra versión',()=>{
 const cloud=server(),a=initial();change(a,mk(2),101);
 const ops=planUpload(a).ops;
 assert.equal(send(cloud,ops)[0].version,1);
 const retry=send(cloud,ops);
 assert.equal(retry[0].status,'duplicate');assert.equal(retry[0].version,1);
 acknowledge(a,ops,retry);
 assert.equal(cloud.rows.values().next().value.version,1);
 assert.equal(a.pending.length,0);
});
test('Ediciones simultáneas no se sobrescriben automáticamente',()=>{
 const cloud=server(),a=initial(),b=initial();change(a,mk(3),102);
 let ops=planUpload(a).ops;acknowledge(a,ops,send(cloud,ops));
 mergeDownload(b,[...cloud.rows.values()]);
 a.records[0].weight=40;b.records[0].weight=55;
 a.pending.push({id:id(103),kind:'update_series',localId:a.records[0].id,expectedVersion:1});
 b.pending.push({id:id(104),kind:'update_series',localId:b.records[0].id,expectedVersion:1});
 ops=planUpload(a).ops;acknowledge(a,ops,send(cloud,ops));
 const bo=planUpload(b).ops;
 assert.equal(send(cloud,bo)[0].status,'conflict');
 acknowledge(b,bo,send(cloud,bo));
 assert.equal(b.records[0].weight,55);
 assert.equal(b.pending.length,1);
 assert.equal(b.conflicts.length,1);
 assert.equal(cloud.rows.values().next().value.payload.weight,40);
});
test('Una eliminación remota prevalece sin restaurar registros borrados',()=>{
 const cloud=server(),a=initial(),b=initial();change(a,mk(4),105);
 let ops=planUpload(a).ops;acknowledge(a,ops,send(cloud,ops));
 mergeDownload(b,[...cloud.rows.values()]);
 const deleted=a.records.pop(),key=sourceKey(deleted);
 a.tombstones.push({localId:deleted.id,syncKey:key});
 a.pending.push({id:id(106),kind:'delete_series',localId:deleted.id,syncKey:key,expectedVersion:1});
 ops=planUpload(a).ops;assert.equal(ops[0].action,'delete');
 acknowledge(a,ops,send(cloud,ops));
 assert.equal(mergeDownload(b,[...cloud.rows.values()]).hidden,1);
 assert.equal(b.records.length,0);
 assert.equal(mergeDownload(b,[{...cloud.rows.get(key),deleted:false}]).added,0,
  'La lápida impide resurrección al descargar una copia antigua');
});
test('La eliminación antes de la primera subida no crea operaciones de nube',()=>{
 const a=initial();const row=mk(5);
 change(a,row,107);a.records.pop();a.pending=[];
 a.tombstones.push({localId:row.id,syncKey:sourceKey(row)});
 assert.equal(planUpload(a).ops.length,0);
});
test('Pendientes de catálogo y fotografía permanecen pendientes, nunca se silencian',()=>{
 const a=initial();a.pending=[{kind:'photo',id:id(108)},{kind:'add_catalog',id:id(109)}];
 const plan=planUpload(a);
 assert.equal(plan.ops.length,0);assert.equal(plan.blocked.length,2);
});
test('Migración en schema de pruebas tiene RLS, versionado y RPC explícito',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261015150000_gymlytics_offline_sync_v1.sql',import.meta.url),'utf8');
 for(const term of ['tbl_sync_series','tbl_sync_ops','ENABLE ROW LEVEL SECURITY',
  'auth.uid()','usuario_habilitado()','SECURITY DEFINER','pg_advisory_xact_lock','FOR UPDATE',
  'expected_version','op_id','source_key','GRANT EXECUTE'])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM sch_android_gymlytics\.tbl_series\b/i);
});
