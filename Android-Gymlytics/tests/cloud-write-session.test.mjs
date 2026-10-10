import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
function extract(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Falta implementación '+start);
 return src.slice(a,b);
}
const guard=extract('const assertCurrentSession =','async function assertGymlyticsAccess(');
const ensure=extract('async ensureExercise(exercise,technique=','async saveWorkout(');
const photo=extract('async uploadUserPhoto({exercise,technique,type,side,blob}){','\n};\nwindow.GymCloud=cloud;');

function fixture({delayGym=false,delayUpload=false}={}){
 const script=`
let signedIn={id:'cuenta-A'},authEpoch=3,releaseGym,releaseUpload,notifyGym,notifyUpload;
const gymStarted=new Promise(r=>notifyGym=r),uploadStarted=new Promise(r=>notifyUpload=r);
const calls=[],uploads=[],inserted=[];
const owns=()=>!!signedIn?.id;
const crypto={randomUUID:()=> 'foto-123'};
const must=(_value,error)=>{if(error)throw error};
const findOrCreate=async(table,fields)=>{
 calls.push({table,user_id:fields.user_id});
 if(table==='tbl_gimnasios'){notifyGym();if(${delayGym})await new Promise(r=>releaseGym=r)}
 return table+'-id';
};
const db={from(table){return {
 update(){return this},eq(){return Promise.resolve({error:null})},
 insert(value){inserted.push({table,value});return Promise.resolve({error:null})}
}}};
const client={storage:{from(bucket){return {
 upload:async(path)=>{uploads.push({bucket,path});notifyUpload();
  if(${delayUpload})await new Promise(r=>releaseUpload=r);return {error:null}},
 remove:async()=>({error:null})
}}}};
${guard}
const cloud={${ensure}${photo}};
({
 ensure:()=>cloud.ensureExercise({g:'Gym A',s:'Sede A',i:'Equipo A',kind:'Máquina',
   e:'Remo A',t:['Base'],z:'Espalda'}),
 photo:()=>cloud.uploadUserPhoto({exercise:{g:'Gym A',s:'Sede A',i:'Equipo A',
   kind:'Máquina',e:'Remo A',t:['Base'],z:'Espalda'},
   technique:'Base',type:'ejercicio',side:null,blob:{}}),
 switchAccount:()=>{signedIn={id:'cuenta-B'};authEpoch++},
 awaitGym:()=>gymStarted,awaitUpload:()=>uploadStarted,
 releaseGym:()=>releaseGym?.(),releaseUpload:()=>releaseUpload?.(),
 state:()=>({calls,uploads,inserted})
});
`;
 return runInNewContext(script);
}

test('Creación de ejercicio mantiene el mismo propietario en cada relación',async()=>{
 const h=fixture(),ids=await h.ensure();
 assert.equal(ids.user_id,'cuenta-A');
 assert.equal(h.state().calls.length,4);
 assert.ok(h.state().calls.every(x=>x.user_id==='cuenta-A'));
});
test('Cambio de sesión durante gimnasio aborta las siguientes escrituras',async()=>{
 const h=fixture({delayGym:true}),run=h.ensure();
 await h.awaitGym();h.switchAccount();h.releaseGym();
 await assert.rejects(run,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().calls.length,1);
});
test('Subida normal registra la fotografía con la ruta de su propietario',async()=>{
 const h=fixture(),path=await h.photo();
 assert.equal(path,'cuenta-A/foto-123.jpg');
 assert.equal(h.state().uploads[0].path,path);
 assert.equal(h.state().inserted[0].value.user_id,'cuenta-A');
});
test('Subida comenzada por A no crea una fila de fotos cuando ya está B',async()=>{
 const h=fixture({delayUpload:true}),run=h.photo();
 await h.awaitUpload();h.switchAccount();h.releaseUpload();
 await assert.rejects(run,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().inserted.length,0);
 assert.equal(h.state().uploads[0].path,'cuenta-A/foto-123.jpg');
});
