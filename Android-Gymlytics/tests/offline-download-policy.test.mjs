import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDownloadedCatalog,mergeDownloadedCatalog,emptyCatalogue} from '../web/offline-catalog-download.js';
import {createCloudSync} from '../web/cloud-sync.js';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../web/'+name,import.meta.url),'utf8');
const uid='demo-user-01',stamp='profile-stamp';
const empty=()=>({records:[],pending:[],tombstones:[],conflicts:[],cloudUserId:null,
 ...emptyCatalogue(),readOnly:false,demo:false});
const fakeRemote=()=>{
 const input={vw_historial_series:[{id:'row-1',user_id:uid,date:'2026-10-01',
  gym:'G',sede:'S',exercise:'Remo',series:'Serie 1',weight:80,reps:10,unit:'kg'}],
  tbl_sync_series:[]};
 return {from(table){
  const result={head:false,field:'',select(fields,options){this.field=fields;this.head=!!options?.head;return this},
   eq(){return this},order(){return this},maybeSingle:async()=>({data:{id:uid,activo:true},error:null}),
   range:async(a,b)=>({data:(input[table]||[]).slice(a,b+1),error:null}),
   then(resolve){return Promise.resolve({count:(input[table]||[]).length,error:null}).then(resolve)}
  };
  return result;
 }};
};
const catalogue=()=>prepareDownloadedCatalog({
 base:[{id:'catalog-a',gimnasio:'Evolution',sede:'VES',zona_entrenamiento:'Espalda',
  instrumento:'Máquina de remo',ejercicio:'Remo',tecnica_actualizada:'02 - Controlado (3-5 seg)'}],
 gyms:[{id:'g1',nombre:'Evolution'}],sites:[{id:'s1',gimnasio_id:'g1',nombre:'VES'}],
 machines:[{id:'m1',nombre:'Máquina de remo',tipo_equipo:'Máquina'}],
 options:[{id:'t1',tipo:'tecnica',nombre:'02 - Controlado (3-5 seg)'}],
 muscles:[{id:'mus-1',nombre:'Dorsal ancho',activo:true}],
 exercises:[{id:'e1',nombre:'Remo',gimnasio_id:'g1',sede_id:'s1',
  instrumento:'Máquina de remo',tecnica_actualizada:'02 - Controlado (3-5 seg)'}]
});
function harness(initial=empty(),fetchCatalog=async()=>catalogue()){
 let state=structuredClone(initial),writes=0,allow=true;
 const sync=createCloudSync({
  remote:fakeRemote(),getState:()=>({profileName:'Perfil local',data:state}),
  mutate:async fn=>{const after=structuredClone(state);await fn(after);state=after;writes++},
  refresh:()=>{},isCurrent:(account,token)=>account===uid&&token===stamp,
  isLinkedElsewhere:()=>false,confirmAction:()=>allow,notify:()=>{},
  catalogFetch:fetchCatalog
 });
 return {sync,read:()=>structuredClone(state),writes:()=>writes,deny:()=>allow=false};
}
async function online(fn){
 const original=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{return await fn()}finally{
  if(original===undefined)delete globalThis.navigator;
  else Object.defineProperty(globalThis,'navigator',{value:original,configurable:true});
 }
}
test('Instalación limpia: sin catálogo incrustado ni historial antes de descargar',()=>{
 const src=read('offline-first.js'),html=read('index.html');
 assert.deepEqual(emptyCatalogue().baseCatalog,[]);
 assert.match(src,/baseCatalog:\[\],muscles:\[\],custom:\[\],library:\[\]/);
 assert.match(src,/const source=Array\.isArray\(latest\?\.data\?\.baseCatalog\)/);
 assert.doesNotMatch(html,/src="\.\/catalogo\.js"/);
 assert.match(html,/id="offlineDemoDownload"/);
});
test('La descarga convierte todos los catálogos y conserva la técnica con segundos',()=>{
 const c=catalogue();
 assert.equal(c.entities.gyms[0].nombre,'Evolution');
 assert.equal(c.entities.sites[0].nombre,'VES');
 assert.equal(c.entities.options[0].tipo,'tecnica');
 assert.equal(c.baseCatalog.length,1);
 assert.equal(c.muscles.length,1);
 assert.equal(c.baseCatalog[0].t[0],'02 - Controlado (3-5 seg)');
 assert.equal(c.custom[0].e,'Remo');
});
test('La fusión conserva modificaciones locales y añade referencias sin duplicarlas',()=>{
 const remote=catalogue(),local=empty();
 local.entities.gyms=[{id:'g1',nombre:'Mi nombre local'},{id:'local2',nombre:'Otro gimnasio'}];
 local.baseCatalog=[{...remote.baseCatalog[0],e:'Remo modificado'}];
 const merged=mergeDownloadedCatalog(local,remote);
 assert.equal(merged.entities.gyms[0].nombre,'Mi nombre local');
 assert.equal(merged.entities.gyms.length,2);
 assert.equal(merged.baseCatalog.length,1,'No duplicar el mismo ID del catálogo aunque se haya modificado su descripción local');
 assert.equal(merged.baseCatalog[0].e,'Remo modificado');
 assert.deepEqual(local.entities.gyms[0],{id:'g1',nombre:'Mi nombre local'});
});
test('Descargar cuenta personal: catálogo y series son visibles en el perfil local',async()=>online(async()=>{
 const h=harness();await h.sync.download(uid,stamp);
 const data=h.read();assert.equal(h.writes(),1);
 assert.equal(data.records.length,1);assert.equal(data.entities.gyms.length,1);
 assert.equal(data.custom.length,1);assert.equal(data.baseCatalog.length,1);
 assert.equal(data.muscles.length,1);
 assert.equal(data.readOnly,false);assert.equal(data.cloudUserId,uid);
}));
test('Descarga de prueba: editable offline y nunca vinculada para subir',async()=>online(async()=>{
 const h=harness();await h.sync.download(uid,stamp,{readOnly:true});
 const data=h.read();assert.equal(data.readOnly,false);assert.equal(data.demo,true);
 assert.equal(data.cloudUserId,null);
 assert.equal(data.records.length,1);assert.equal(data.entities.gyms.length,1);
 assert.ok(h.writes()>0);
}));
test('Descargar catálogo demo conserva las series existentes en el perfil offline',async()=>online(async()=>{
 const prior=empty();prior.records.push({id:'offline-a',date:'2026-10-02'});
 const h=harness(prior);
 await h.sync.download(uid,stamp,{readOnly:true});
 assert.equal(h.read().records.length,2);
 assert.ok(h.read().records.some(r=>r.id==='offline-a'));
 assert.equal(h.read().readOnly,false);
}));
test('Descarga fallida de catálogo no modifica datos locales ni elimina operaciones pendientes',async()=>online(async()=>{
 const prior=empty();prior.pending=[{id:'pending-1',kind:'add_catalog',localId:'g1'}];
 const h=harness(prior,async()=>{throw Error('Catálogo inaccesible')});
 await assert.rejects(h.sync.download(uid,stamp),/Catálogo inaccesible/);
 assert.equal(h.writes(),0);assert.deepEqual(h.read(),prior);
}));
test('Ediciones locales pendientes se conservan incluso al descargar la cuenta personal',async()=>online(async()=>{
 const prior=empty();prior.entities.gyms=[{id:'local-g',nombre:'Gimnasio personal'}];
 prior.pending=[{id:'pending-1',kind:'add_catalog',localId:'local-g'}];
 const h=harness(prior);
 await h.sync.download(uid,stamp);
 const saved=h.read();assert.equal(saved.pending.length,1);
 assert.ok(saved.entities.gyms.some(x=>x.nombre==='Gimnasio personal'));
 assert.ok(saved.entities.gyms.some(x=>x.nombre==='Evolution'));
}));
test('La cuenta de prueba solo bloquea la escritura en nube, no la edición local',()=>{
 const src=read('offline-first.js'),html=read('index.html');
 assert.match(src,/canWrite:\(\)=>!!activeId&&!!latest&&!transitioning/);
 assert.doesNotMatch(src,/if\(latest\.data\?\.readOnly\)return \{code:'read_only'/);
 for(const signature of ['saveWorkout','deleteSeries','updateSeries','addIndependentItem','saveCustomExercise',
  'updateCatalogItem','deleteCatalogItem','uploadUserPhoto']){
  const start=src.indexOf('async '+signature+'(');
  assert.ok(start>0,signature);
  assert.match(src.slice(start,start+200),/assertEditable\(\)/,signature);
 }
 assert.match(src,/cloudAccountKind!=='personal'/);
 assert.match(html,/id="offlineCloudUpload"/);
 assert.match(html,/id="offlineSyncMode"/);
});
