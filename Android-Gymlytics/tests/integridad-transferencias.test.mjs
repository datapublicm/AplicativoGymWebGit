import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createCloudSync} from '../web/cloud-sync.js';

const uid=randomUUID(),date='2026-10-15',exercise='Remo en barra T';
const base=()=>({records:[],pending:[],tombstones:[],conflicts:[],cloudUserId:null});
const row=()=>({id:randomUUID(),origin:'offline',date,gym:'Smart Fit',sede:'Pruebas',
 exercise,series:'Serie 1',unit:'kg',weight:50,reps:10,assistance:0,cloudVersion:0});
const seed=data=>{const r=row();data.records.push(r);
 data.pending.push({id:randomUUID(),kind:'create_series',localId:r.id});
 return r};
function setup(initial=base()){
 let state=structuredClone(initial),allow=true,current=true,failAfterCommit=false,denyPage=false,mutations=0,rpcCalls=0;
 const rows=new Map(),logs=new Map(),notices=[],view=[];
 const verify=()=>uid;
 const remote={
  from(name){
   const q={
    field:'',head:false,user:'',orders:[],select(field,options){this.field=field;this.head=!!options?.head;return this},
    eq(field,value){this.user=value;return this},
    order(field,settings){this.orders.push({field,settings});return this},
    maybeSingle:async()=>({data:{id:uid,activo:true},error:null}),
    async range(begin,end){
     if(denyPage&&begin>=500)return {data:null,error:{message:'Corte de red al descargar'}};
     const all=name==='tbl_sync_series'?[...rows.values()]:name==='vw_historial_series'?view:[];
     const sorted=[...all].sort((a,b)=>name==='tbl_sync_series'?
      a.source_key.localeCompare(b.source_key):b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
     return {data:sorted.slice(begin,end+1),error:null};
    },
    then(ok){return Promise.resolve({count:name==='tbl_sync_series'?rows.size:name==='vw_historial_series'?view.length:0,error:null}).then(ok)}
   };
   return q;
  },
  async rpc(functionName,args){
   assert.equal(functionName,'aplicar_cambios_offline');rpcCalls++;
   const results=[];
   for(const op of args.p_changes){
    if(logs.has(op.op_id)){const o=logs.get(op.op_id);
     assert.deepEqual(o.op,op,'ID de operación no debe cambiar su contenido');
     results.push({...o.result,status:o.result.status==='applied'?'duplicate':o.result.status});continue;}
    const prev=rows.get(op.source_key);
    let result;
    if((prev?.version||0)!==op.expected_version){
     result={op_id:op.op_id,status:'conflict',current:prev||null};
    }else{
     const next={source_key:op.source_key,user_id:uid,version:(prev?.version||0)+1,
      payload:op.action==='upsert'?op.payload:prev?.payload||{},deleted:op.action==='delete',
      updated_at:new Date().toISOString()};
     rows.set(op.source_key,next);
     result={op_id:op.op_id,status:'applied',version:next.version};
    }
    logs.set(op.op_id,{op,result});results.push(result);
   }
   if(failAfterCommit){failAfterCommit=false;return {data:null,error:{message:'Timeout tras confirmar transacción'}}}
   return {data:results,error:null};
  }
 };
 const sync=createCloudSync({
  remote,getState:()=>({data:state,profileName:'Pruebas'}),
  mutate:async fn=>{const next=structuredClone(state);await fn(next);state=next;mutations++},
  refresh:()=>{},isCurrent:(account,token)=>current&&account===uid&&token==='perfil-A',
  isLinkedElsewhere:()=>false,confirmAction:()=>allow,notify:text=>notices.push(text),
  catalogFetch:async()=>({baseCatalog:[],muscles:[],library:[],custom:[],entities:{gyms:[],sites:[],machines:[],options:[]}})
 });
 return {sync,uid,view,rows,notices,read:()=>structuredClone(state),
  editLocal:fn=>fn(state),
  enableConfirm:v=>allow=v,cutAfterCommit:()=>failAfterCommit=true,
  cutSecondPage:()=>denyPage=true,changeProfile:()=>current=false,
  rpcCalls:()=>rpcCalls,mutations:()=>mutations};
}
test('Sin internet ninguna subida se inicia ni se descartan pendientes',async()=>{
 const original=base();seed(original);const h=setup(original);
 const originalNav=globalThis.navigator;Object.defineProperty(globalThis,'navigator',
  {value:{onLine:false},configurable:true});
 try{
  await assert.rejects(h.sync.upload(uid,'perfil-A'),/No hay conexión/);
  assert.equal(h.rpcCalls(),0);assert.equal(h.read().pending.length,1);
 }finally{Object.defineProperty(globalThis,'navigator',{value:originalNav,configurable:true})}
});
test('Corte de Internet justo después de aplicar RPC: reintento no duplica ni modifica versión',async()=>{
 const data=base();const original=seed(data);const h=setup(data);
 const originalNav=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{
  h.cutAfterCommit();await assert.rejects(h.sync.upload(uid,'perfil-A'),err=>err?.message?.includes('Timeout'));
  assert.equal(h.read().pending.length,1);
  assert.equal(h.rows.get('local:'+original.id).version,1);
  const result=await h.sync.upload(uid,'perfil-A');
  assert.equal(result.duplicates,1);
  assert.equal(h.rows.get('local:'+original.id).version,1);
  assert.equal(h.rows.size,1);assert.equal(h.read().pending.length,0);
 }finally{Object.defineProperty(globalThis,'navigator',{value:originalNav,configurable:true})}
});
test('Negar confirmación impide subir y descargar sin ninguna mutación',async()=>{
 const data=base();seed(data);const h=setup(data);h.enableConfirm(false);
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 assert.equal(await h.sync.upload(uid,'perfil-A'),null);
 assert.equal(await h.sync.download(uid,'perfil-A'),null);
 assert.equal(h.rpcCalls(),0);assert.equal(h.mutations(),0);
});
test('Descarga incompleta de la página 2 no escribe datos parciales',async()=>{
 const h=setup(),first=JSON.stringify(h.read());
 for(let i=0;i<501;i++)h.view.push({id:randomUUID(),user_id:uid,date:'2026-10-15',
  gym:'Gimnasio',sede:'Sede',exercise,reps:10,weight:i,unit:'kg'});
 h.cutSecondPage();
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 await assert.rejects(h.sync.download(uid,'perfil-A'),/incompleta/);
 assert.equal(JSON.stringify(h.read()),first);
 assert.equal(h.mutations(),0);
});
test('Cambio de perfil mientras responde Supabase nunca confirma datos al perfil equivocado',async()=>{
 const data=base();const r=seed(data);const h=setup(data);
 const original=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{
  const upload=h.sync.upload(uid,'perfil-A');
  h.changeProfile();
  await assert.rejects(upload,/Cambió la cuenta o el perfil/);
  assert.equal(h.read().pending.length,1);
  assert.equal(h.read().cloudUserId,null);
 }finally{Object.defineProperty(globalThis,'navigator',{value:original,configurable:true})}
});

test('Modificar una serie después de perder su ACK conserva el alta original y actualiza luego',async()=>{
 const state=base(),item=seed(state),h=setup(state);
 const original=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{
  h.cutAfterCommit();
  await assert.rejects(h.sync.upload(uid,'perfil-A'),e=>e?.message?.includes('Timeout'));
  const pending=h.read().pending[0];assert.equal(pending.submittedRequest.payload.weight,50);
  h.editLocal(data=>{
   data.records[0].weight=75;
   data.pending.push({id:randomUUID(),kind:'update_series',localId:item.id,
    syncKey:'local:'+item.id,expectedVersion:0});
  });
  assert.equal(h.read().pending[0].submittedRequest.payload.weight,50);
  const retry=await h.sync.upload(uid,'perfil-A');
  assert.equal(retry.duplicates,1);assert.equal(h.read().pending.length,1);
  assert.equal(h.read().pending[0].expectedVersion,1);
  await h.sync.upload(uid,'perfil-A');
  assert.equal(h.rows.get('local:'+item.id).version,2);
  assert.equal(h.rows.get('local:'+item.id).payload.weight,75);
  assert.equal(h.read().pending.length,0);
 }finally{Object.defineProperty(globalThis,'navigator',{value:original,configurable:true})}
});
test('Borrar una serie después de perder ACK evita resurrecciones al reconectar',async()=>{
 const state=base(),item=seed(state),h=setup(state);
 const original=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{
  h.cutAfterCommit();
  await assert.rejects(h.sync.upload(uid,'perfil-A'),e=>e?.message?.includes('Timeout'));
  h.editLocal(data=>{
   data.records.splice(0,1);
   data.tombstones.push({localId:item.id,syncKey:'local:'+item.id});
   data.pending.push({id:randomUUID(),kind:'delete_series',localId:item.id,
    syncKey:'local:'+item.id,expectedVersion:0});
  });
  await h.sync.upload(uid,'perfil-A');
  assert.equal(h.read().records.length,0);
  assert.equal(h.read().pending[0].expectedVersion,1);
  await h.sync.upload(uid,'perfil-A');
  assert.equal(h.rows.get('local:'+item.id).deleted,true);
  assert.equal(h.rows.get('local:'+item.id).version,2);
  assert.equal(h.read().tombstones.length,1);
  assert.equal(h.read().pending.length,0);
 }finally{Object.defineProperty(globalThis,'navigator',{value:original,configurable:true})}
});

test('Descarga paginada de 9.263 series conserva el historial completo sin duplicados',async()=>{
 const h=setup();
 for(let i=0;i<9263;i++)h.view.push({id:randomUUID(),user_id:uid,
  date:'2026-10-15',gym:'Gimnasio',sede:'Sede',
  exercise:'Remo',series:'Serie '+(i%4+1),reps:10,weight:20+i/100,unit:'kg'});
 const original=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{
  await h.sync.download(uid,'perfil-A');
  const a=h.read();
  assert.equal(a.records.length,9263);
  assert.equal(new Set(a.records.map(x=>x.remoteId)).size,9263);
  assert.equal(h.mutations(),1);
  await h.sync.download(uid,'perfil-A');
  const b=h.read();
  assert.equal(b.records.length,9263,'Descargar dos veces no duplica series');
  assert.equal(new Set(b.records.map(x=>x.id)).size,9263);
 }finally{Object.defineProperty(globalThis,'navigator',{value:original,configurable:true})}
});
