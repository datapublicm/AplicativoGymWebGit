import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
function extract(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Método no encontrado: '+start);
 return src.slice(a,b);
}
const methods=extract('async addIndependentItem(kind,values){','async updateCatalogItem(kind,itemId,newName){')+extract('async saveCustomExercise(values){','async loadCatalogStats(){');

function cloudFixture(){
 const code=`
let signedIn={id:'A'},authEpoch=3,release,started,reloads=0,stats=0;
const wait=new Promise(resolve=>started=resolve);
const owns=()=>!!signedIn?.id;
const assertCurrentSession=(uid,epoch)=>{
 if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió durante la carga de datos.');
};
const findOrCreate=async(table,fields)=>{
 started();
 await new Promise(resolve=>release=resolve);
 return 'nuevo-id';
};
const window={GymEntities:{gyms:[],sites:[],machines:[],options:[]}};
const normalizeCatalogName=s=>String(s||'').trim().toLowerCase();
const cloud={${methods}
 async loadIndependentCatalog(){reloads++},
 async loadCatalogStats(){stats++},
 async loadOwnCatalog(){reloads++;return [{e:'Ejercicio de A'}]}
};
({
 gym:()=>cloud.addIndependentItem('gym',{nombre:'Gym A'}),
 custom:()=>cloud.saveCustomExercise({e:'Remo A',z:'Espalda',tecnica:'Base'}),
 other:()=>{signedIn={id:'B'};authEpoch++},
 relogin:()=>{authEpoch++},
 wait:()=>wait,finish:()=>release?.(),
 state:()=>({reloads,stats})
});
`;
 return runInNewContext(code);
}

test('Cambiar de A a B durante creación de gimnasio impide recargar datos de B',async()=>{
 const h=cloudFixture(),pending=h.gym();
 await h.wait();h.other();h.finish();
 await assert.rejects(pending,/La sesión cambió/);
 assert.equal(h.state().reloads,0);
 assert.equal(h.state().stats,0);
});
test('Reautenticación de A durante creación de ejercicio no actualiza catálogo de sesión nueva',async()=>{
 const h=cloudFixture(),pending=h.custom();
 await h.wait();h.relogin();h.finish();
 await assert.rejects(pending,/La sesión cambió/);
 assert.equal(h.state().reloads,0);
});
test('Catálogo sin cambio de sesión conserva su carga y estadísticas',async()=>{
 const h=cloudFixture(),pending=h.gym();
 await h.wait();h.finish();await pending;
 assert.equal(h.state().reloads,1);
 assert.equal(h.state().stats,1);
});

const eventMethods=extract('for(const [formId,kind,feedbackId] of [',"document.querySelector('#addOptionForm [name=\"tipo\"]')");
function formFixture(){
 const code=`
let session='A',resolve,started,resetCount=0;
const gate=new Promise(r=>started=r);
const listeners={};
const elements={};
const $=id=>elements[id]??=( {textContent:'',disabled:false,
 addEventListener(type,fn){listeners[id+':'+type]=fn},
 querySelector(){return {disabled:false}},reset(){resetCount++}});
const cloud={
 getSessionStamp:()=>session,canWrite:()=>true,
 addIndependentItem:async()=>{started();await new Promise(r=>resolve=r)},
 saveCustomExercise:async()=>{started();await new Promise(r=>resolve=r);return [{e:'Old A'}]},
 loadCatalogStats:async()=>{}
};
const window={GymCustomCatalog:[{e:'New B'}]};
const owns=()=>true;
const setStatus=()=>{};
const FormData=class {constructor(){} entries(){return [['nombre','Gym A'],['e','Remo A']] }};
let cascadeCount=0;
const cascade=()=>{cascadeCount++},renderOwnCatalog=()=>{},renderIndependentCatalog=()=>{};
${eventMethods}
({
 submit:formId=>{
  const form=$(formId),event={preventDefault(){},currentTarget:form};
  return listeners[formId+':submit'](event)
 },
 wait:()=>gate,other:()=>{session='B';window.GymCustomCatalog=[{e:'New B'}]},
 release:()=>resolve?.(),
 state:()=>({gymMessage:$('gymFeedback').textContent,catalogMessage:$('catalogFeedback').textContent,
  custom:window.GymCustomCatalog,resetCount,cascadeCount})
});
`;
 return runInNewContext(code);
}
test('Formulario de gimnasio no muestra éxito ni limpia campos de B tras respuesta vieja',async()=>{
 const h=formFixture(),pending=h.submit('addGymForm');
 await h.wait();h.other();h.release();await pending;
 assert.equal(h.state().gymMessage,'');
 assert.equal(h.state().resetCount,0);
});
test('Formulario de ejercicio no sustituye catálogo de B por respuesta tardía de A',async()=>{
 const h=formFixture(),pending=h.submit('catalogForm');
 await h.wait();h.other();h.release();await pending;
 assert.equal(h.state().custom[0].e,'New B');
 assert.equal(h.state().catalogMessage,'');
 assert.equal(h.state().resetCount,0);
 assert.equal(h.state().cascadeCount,0);
});
