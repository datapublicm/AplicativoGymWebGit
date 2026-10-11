import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Ejecuta la implementación real de cloud.loadHistory con respuestas simuladas.
const source=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const begin=source.indexOf('async loadHistory(onProgress){');
const end=source.indexOf('async loadInitialCatalog(){',begin);
assert.ok(begin>=0&&end>begin,'Se encontró loadHistory');
const method=source.slice(begin,end);

function harness(changeUser=false,restartSameUser=false){
  const fixture=`
let signedIn={id:'cuenta-A'},authEpoch=1;
const calls=[];
const users={
 'cuenta-A':Array.from({length:9263},(_,i)=>({id:i+1,user_id:'cuenta-A',date:'2026-10-10',weight:'10',reps:'12',assistance:'0'})),
 'cuenta-B':Array.from({length:500},(_,i)=>({id:i+1,user_id:'cuenta-B',date:'2026-10-10',weight:'20',reps:'6',assistance:'0'}))
};
const owns=()=>!!signedIn?.id;
const must=(data,error)=>{if(error)throw error;return data};
const assertCurrentSession=(uid,epoch)=>{if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió durante la carga de datos.');};
const db={from(table){
 if(table!=='vw_historial_series')throw Error('Tabla inesperada');
 return {select(_columns,opts={}){
  let uid=null;
  return {
   eq(field,value){if(field!=='user_id')throw Error('Falta filtro propietario');uid=value;
    return opts.head?Promise.resolve({count:users[uid].length,error:null}):this;},
   order(){return this;},
   async range(start,end){calls.push({uid,start,end});
    if(${changeUser}&&start===0){signedIn={id:'cuenta-B'};authEpoch++;}
    if(${restartSameUser}&&start===0)authEpoch++;
    return {data:users[uid].slice(start,end+1),error:null};}
  };
 }};
}};
const cloud={${method}};
({run:callback=>cloud.loadHistory(callback),calls,getUser:()=>signedIn.id});
`;
 return runInNewContext(fixture);
}
test('Descarga 9.263 series de una sola cuenta sin límite de mil',async()=>{
 const h=harness();
 const history=await h.run();
 assert.equal(history.length,9263);
 assert.equal(history[0].user_id,'cuenta-A');
 assert.equal(history.at(-1).user_id,'cuenta-A');
 assert.ok(history.every(x=>x.user_id==='cuenta-A'));
 assert.equal(h.calls.length,14);
 assert.ok(h.calls.every(x=>x.uid==='cuenta-A'&&x.end-x.start+1===700));
 assert.equal(history[0].weight,10);
});
test('Rechaza respuesta si cambia la cuenta durante la descarga',async()=>{
 const h=harness(true);
 await assert.rejects(h.run(),/La sesión cambió durante la carga/);
 assert.equal(h.getUser(),'cuenta-B');
});

test('Rechaza una descarga vieja tras nueva sesión de la MISMA cuenta',async()=>{
 const h=harness(false,true);
 await assert.rejects(h.run(),/La sesión cambió durante la carga/);
 assert.equal(h.getUser(),'cuenta-A');
});

test('Informa progreso real de las 9.263 series por lotes y solo completa al final',async()=>{
 const h=harness(),events=[];
 const history=await h.run((received,total)=>events.push([received,total]));
 assert.equal(history.length,9263);
 assert.deepEqual(events,[[0,9263],[2800,9263],[5600,9263],[8400,9263],[9263,9263]]);
});
test('Si cambia la sesión durante la descarga no informa progreso de otra cuenta',async()=>{
 const h=harness(true),events=[];
 await assert.rejects(h.run((received,total)=>events.push([received,total])),/La sesión cambió/);
 assert.deepEqual(events,[[0,9263]]);
});
