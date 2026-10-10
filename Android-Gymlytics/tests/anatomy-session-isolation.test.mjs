import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const auth=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
function snippet(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Falta sección '+start);
 return source.slice(a,b);
}
const detail=snippet(app,'function detailOpen(){','function showPage(');
const guard=snippet(auth,'const assertCurrentSession =','async function assertGymlyticsAccess(');
const load=snippet(auth,'async loadAnatomy(exercise){','async uploadUserPhoto(');

function viewerFixture(){
 const source=`
let session='A',anatomyData=null,anatomyRequestId=0,finish,draws=0;
const model={photos:{guardado:'B'}};
const elements={};
const $=id=>(elements[id]??={
 textContent:'',hidden:false,src:'',open:false,
 showModal(){this.open=true},querySelector(){return {textContent:''}}
});
const window={GymCloud:{
 getSessionStamp:()=>session,canWrite:()=>true,
 loadAnatomy:()=>new Promise(resolve=>finish=resolve)
}};
const chosenRow=()=>({g:'Gym A',s:'Sede A',i:'Máquina A',e:'Ejercicio A',
 z:'Espalda',a:'Cable',gr:'Prono',m:'Dorsal',ms:'Bíceps',n:0,last:null});
const getValue=()=> 'Base';
const techniqueDescription=()=> 'Técnica';
const photoFor=()=>['img',true];
const gymlyticsAnatomyView=()=>{};
const gymlyticsAnatomyDraw=()=>{draws++};
const detailOpenAfterUpload=()=>{draws++};
${detail}
({open:()=>detailOpen(),switchAccount:()=>{session='B'},
 finish:()=>finish({id:'e1',primary:['Dorsal'],secondary:[],zones3d:[],images:{},
 photos:{'ejercicio:general':'url-antigua'}}),
 state:()=>({photos:model.photos,draws,anatomyData,elements})});
`;
 return runInNewContext(source);
}
test('Respuesta anatómica de A no se pinta cuando ya entró B',async()=>{
 const h=viewerFixture();h.open();h.switchAccount();h.finish();
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.state().photos.guardado,'B');
 assert.equal(h.state().photos['ejercicio:Gym A|Sede A|Máquina A|Ejercicio A'],undefined);
 assert.equal(h.state().draws,0);
 assert.equal(h.state().anatomyData,null);
});
test('Consulta anatómica en misma sesión conserva funcionalidad',async()=>{
 const h=viewerFixture();h.open();h.finish();
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.state().photos['ejercicio:Gym A|Sede A|Máquina A|Ejercicio A'],'url-antigua');
 assert.ok(h.state().draws>0);
});

test('Consulta pendiente a Supabase se detiene antes de consultar datos de la nueva sesión',async()=>{
 const source=`
let signedIn={id:'A'},authEpoch=1,release,queries=0;
const gate=new Promise(resolve=>release=resolve);
const owns=()=>!!signedIn?.id;
const must=(data,error)=>{if(error)throw error;return data};
const db={from(){queries++;return {
 select(){return this},eq(){return this},limit(){return this},
 maybeSingle:async()=>{await gate;return {data:{id:'e1'},error:null}}
}}};
${guard}
const cloud={${load}signedPath:async()=>null};
({start:()=>cloud.loadAnatomy({cloud_id:'e1',e:'Remo',i:'Máquina'}),
 change:()=>{signedIn={id:'B'};authEpoch++},finish:()=>release(),
 state:()=>({queries})});
`;
 const h=runInNewContext(source),pending=h.start();
 h.change();h.finish();
 await assert.rejects(pending,/La sesión cambió durante la carga de datos/);
 assert.equal(h.state().queries,1);
});
