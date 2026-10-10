import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const a=src.indexOf('async saveWorkout({exercise,date,technique,notes,entries})');
const z=src.indexOf('async deleteSeries(id)',a);
assert.ok(a>=0&&z>a,'Existe el método de guardado real');
const method=src.slice(a,z);

function fixture({delayEnsure=false,delayRpc=false}={}){
 const code=`
let signedIn={id:'A'},authEpoch=4,finishEnsure,finishRpc,startedEnsure,startedRpc;
const ensureStarted=new Promise(r=>startedEnsure=r),rpcStarted=new Promise(r=>startedRpc=r);
let rpcCalls=0,payload=null;
const owns=()=>!!signedIn?.id;
const assertCurrentSession=(uid,epoch)=>{
 if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió durante la carga de datos.');
};
const must=(_data,error)=>{if(error)throw error};
const db={rpc:async(_name,params)=>{rpcCalls++;payload=params;startedRpc();
 if(${delayRpc})await new Promise(r=>finishRpc=r);
 return {error:null};
}};
const cloud={
 ensureExercise:async()=>{startedEnsure();if(${delayEnsure})await new Promise(r=>finishEnsure=r);
 return {gimnasio_id:'g',sede_id:'s',ejercicio_id:'e'};},
 ${method}
};
({
 save:()=>cloud.saveWorkout({exercise:{e:'Bíceps'},date:'2026-10-10',technique:'Base',notes:'',
 entries:[{series:'Serie 1',sub:'-',unit:'kg',weight:'25.5',reps:'6.5',assistance:'1.25'}]}),
 switch:()=>{signedIn={id:'B'};authEpoch++},relogin:()=>{authEpoch++},
 finishEnsure:()=>finishEnsure?.(),finishRpc:()=>finishRpc?.(),
 awaitEnsure:()=>ensureStarted,awaitRpc:()=>rpcStarted,
 state:()=>({rpcCalls,payload})
});
`;
 return runInNewContext(code);
}
test('Guarda peso, repeticiones y asistencias como números decimales',async()=>{
 const h=fixture();await h.save();
 assert.equal(h.state().rpcCalls,1);
 assert.equal(h.state().payload.p_series[0].peso,25.5);
 assert.equal(h.state().payload.p_series[0].repeticiones,6.5);
 assert.equal(h.state().payload.p_series[0].asistencias,1.25);
});
test('Cambio de cuenta antes de la RPC no envía el entrenamiento',async()=>{
 const h=fixture({delayEnsure:true}),saving=h.save();
 await h.awaitEnsure();h.switch();h.finishEnsure();
 await assert.rejects(saving,/La sesión cambió/);
 assert.equal(h.state().rpcCalls,0);
});
test('Nueva sesión de igual usuario antes de RPC cancela el guardado antiguo',async()=>{
 const h=fixture({delayEnsure:true}),saving=h.save();
 await h.awaitEnsure();h.relogin();h.finishEnsure();
 await assert.rejects(saving,/La sesión cambió/);
 assert.equal(h.state().rpcCalls,0);
});
test('Cambio de sesión durante la RPC no comunica éxito a la sesión nueva',async()=>{
 const h=fixture({delayRpc:true}),saving=h.save();
 await h.awaitRpc();h.switch();h.finishRpc();
 await assert.rejects(saving,/La sesión cambió/);
 assert.equal(h.state().rpcCalls,1);
});
test('Los tres campos Android admiten teclado y valor decimal',()=>{
 for(const name of ['weight','reps','help']){
  assert.match(app,new RegExp('class="entry '+name+'" type="number" min="0" step="any" inputmode="decimal"'));
 }
});
