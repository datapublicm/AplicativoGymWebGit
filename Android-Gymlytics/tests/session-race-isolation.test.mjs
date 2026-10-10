import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const slice=(start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Fragmento no encontrado: '+start);
 return src.slice(a,b);
};
const guard=slice('const assertCurrentSession =','async function assertGymlyticsAccess(');
const catalogs=slice('async loadOwnCatalog(){','async addIndependentItem(');
const stats=slice('async loadCatalogStats(){','async signedPath(');

function harness(){
 const source=`
let signedIn={id:'cuenta-A'},authEpoch=7,release,renderCount=0;
const gate=new Promise(resolve=>release=resolve);
const window={
 GymExerciseLibrary:['sin-cambios'],GymEntities:{gyms:['sin-cambios'],sites:[],machines:[],options:[]}
};
const counters={gymCount:{textContent:'previo'},exerciseCount:{textContent:'previo'},muscleCount:{textContent:'previo'}};
const $=id=>counters[id];
const renderIndependentCatalog=()=>{renderCount++};
const owns=()=>!!signedIn?.id;
const must=(value,error)=>{if(error)throw error;return value};
const rows={
 tbl_ejercicios:[{id:'e1',origen:'usuario',user_id:'cuenta-A',gimnasio_id:null}],
 tbl_gimnasios:[{id:'g1',nombre:'Gimnasio de A'}],
 tbl_sedes:[{id:'s1',gimnasio_id:'g1',nombre:'Sede de A'}],
 tbl_maquinas:[],tbl_opciones_personales:[],tbl_musculos:[]
};
const db={from(table){
 const query={
  select(){return query},eq(){return query},order(){return query},
  then(ok,fail){return gate.then(()=>({data:rows[table]||[],error:null,count:3})).then(ok,fail)}
 };
 return query;
}};
${guard}
const cloud={${catalogs}${stats} signedPath(){}};
({
 loadOwn:()=>cloud.loadOwnCatalog(),
 loadIndependent:()=>cloud.loadIndependentCatalog(),
 loadStats:()=>cloud.loadCatalogStats(),
 changeAccount:()=>{signedIn={id:'cuenta-B'};authEpoch++},
 release:()=>release(),
 state:()=>({library:window.GymExerciseLibrary,entities:window.GymEntities,renderCount,
  counts:Object.fromEntries(Object.entries(counters).map(([k,v])=>[k,v.textContent]))})
});
`;
 return runInNewContext(source);
}

test('La carga tardía de ejercicios no publica catálogo de la cuenta anterior',async()=>{
 const h=harness(),loading=h.loadOwn();
 h.changeAccount();h.release();
 await assert.rejects(loading,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().library[0],'sin-cambios');
});

test('La carga tardía de gimnasios, sedes y máquinas no pisa la cuenta nueva',async()=>{
 const h=harness(),loading=h.loadIndependent();
 h.changeAccount();h.release();
 await assert.rejects(loading,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().entities.gyms[0],'sin-cambios');
 assert.equal(h.state().renderCount,0);
});

test('Un contador de la cuenta anterior no puede reaparecer después del cambio',async()=>{
 const h=harness(),loading=h.loadStats();
 h.changeAccount();h.release();
 await assert.rejects(loading,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().counts.gymCount,'previo');
 assert.equal(h.state().counts.exerciseCount,'previo');
 assert.equal(h.state().counts.muscleCount,'previo');
});

test('Sin cambiar de usuario se conservan el catálogo y los contadores',async()=>{
 const h=harness(),loading=Promise.all([h.loadOwn(),h.loadIndependent(),h.loadStats()]);
 h.release();
 const [catalog,entities]=await loading;
 assert.equal(catalog.length,0);
 assert.equal(entities.gyms[0].nombre,'Gimnasio de A');
 assert.equal(h.state().library[0].id,'e1');
 assert.equal(h.state().counts.gymCount,'3');
 assert.equal(h.state().renderCount,1);
});
