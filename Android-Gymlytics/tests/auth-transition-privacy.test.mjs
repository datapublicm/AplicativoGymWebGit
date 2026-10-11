import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const a=src.indexOf('async function applyState(session,epoch) {');
const b=src.indexOf('async function findOrCreate(',a);
assert.ok(a>=0&&b>a,'Se encuentra la implementación real de cambio de sesión');
const method=src.slice(a,b);
function fixture({rejectProfile=false}={}){
 const code=`
let signedIn={id:'cuenta-A',email:'a@pruebas.test'},lastDraftOwner='cuenta-A',authEpoch=8;
let releaseProfile,draws=0,resets=0,invalidated=0,page='registro',status='',loads=0,navLocked=false,historyReady=true;
const profileGate=new Promise(resolve=>releaseProfile=resolve);
const model={records:[{id:'serie-A',weight:25}],photos:{'fotografia-A':'data:privada'}};
const window={
 GymBaseCatalog:[{g:'Gym A'}],GymCustomCatalog:[{e:'Ejercicio A'}],
 GymExerciseLibrary:[{nombre:'Privado A'}],
 GymEntities:{gyms:[{nombre:'Gimnasio A'}],sites:[],machines:[],options:[]}
};
const elements={authProfile:{hidden:false},authForm:{hidden:true},authRegister:{hidden:true},
 authRecovery:{hidden:true},loggedUser:{textContent:'Cuenta A'},
 loggedEmail:{textContent:'a@pruebas.test'}};
const $=id=>(elements[id]??={hidden:false,textContent:''});
const nav=[{dataset:{page:'registro'},disabled:false,setAttribute(k,v){this.ariaDisabled=v}},
 {dataset:{page:'tablas'},disabled:false,setAttribute(k,v){this.ariaDisabled=v}}];
const document={body:{classList:{toggle(_name,value){navLocked=value}}},querySelectorAll:()=>nav};
const setHistoryReady=ready=>{historyReady=ready};
const owns=()=>!!signedIn?.id;
const invalidatePendingSave=()=>{invalidated++};
const resetExerciseTabs=()=>{resets++};
const renderOwnCatalog=()=>{},renderIndependentCatalog=()=>{};
const drawRecent=()=>{draws++},drawHistory=()=>{draws++},drawReports=()=>{draws++};
const showPage=name=>{page=name},setStatus=s=>{status=s};
const assertGymlyticsAccess=async()=>{
 await profileGate;
 if(${rejectProfile})throw Error('Acceso no autorizado');
 return {nombre:'Cuenta B',usuario:'usuario_b',activo:true};
};
const config={environment:'pruebas'};
const cloud={
 loadInitialCatalog:async()=>[{g:'Gym B'}],
 loadOwnCatalog:async()=>[{e:'Ejercicio B'}],
 loadIndependentCatalog:async()=>{
  window.GymEntities={gyms:[{nombre:'Gimnasio B'}],sites:[],machines:[],options:[]};
 },
 loadHistory:async()=>{loads++;return [{id:'serie-B',weight:15}]},
 loadCatalogStats:async()=>{}
};
const cascade=()=>{};
${method}
({
 start:()=>applyState({user:{id:'cuenta-B',email:'b@pruebas.test'}},8),
 logout:()=>applyState(null,8),
 finishProfile:()=>releaseProfile(),
 state:()=>({signedIn,records:model.records,photos:model.photos,base:window.GymBaseCatalog,
 custom:window.GymCustomCatalog,library:window.GymExerciseLibrary,
 entities:window.GymEntities,owner:lastDraftOwner,draws,resets,invalidated,page,status,loads,
 navLocked,navDisabled:nav.every(x=>x.disabled),refreshDisabled:$('historyRefresh').disabled,historyReady,
 profileVisible:!elements.authProfile.hidden,formVisible:!elements.authForm.hidden})
});
`;
 return runInNewContext(code);
}
test('Cambia A por B: datos privados de A se vacían ANTES de validar el perfil B',async()=>{
 const h=fixture(),pending=h.start();
 const state=h.state();
 assert.equal(state.signedIn,null);
 assert.equal(state.records.length,0);
 assert.deepEqual(Object.keys(state.photos),[]);
 assert.equal(state.base.length,0);
 assert.equal(state.custom.length,0);
 assert.equal(state.library.length,0);
 assert.equal(state.entities.gyms.length,0);
 assert.equal(state.owner,null);
 assert.equal(state.page,'sesion');
 assert.equal(state.profileVisible,false);
 assert.equal(state.formVisible,false);
 assert.equal(state.loads,0);
 assert.equal(state.navLocked,true);
 assert.equal(state.navDisabled,true);
 assert.equal(state.refreshDisabled,true);
 assert.equal(state.historyReady,false);
 assert.ok(state.resets>=1);
 h.finishProfile();await pending;
 assert.equal(h.state().records[0].id,'serie-B');
 assert.equal(h.state().custom[0].e,'Ejercicio B');
 assert.equal(h.state().page,'registro');
 assert.equal(h.state().navLocked,false);
 assert.equal(h.state().navDisabled,false);
 assert.equal(h.state().refreshDisabled,false);
 assert.equal(h.state().historyReady,true);
});
test('Cuenta B sin permiso no conserva información A ni presenta registro privado',async()=>{
 const h=fixture({rejectProfile:true}),pending=h.start();
 h.finishProfile();await pending;
 const state=h.state();
 assert.equal(state.records.length,0);
 assert.equal(state.signedIn,null);
 assert.equal(state.page,'sesion');
 assert.equal(state.profileVisible,false);
 assert.equal(state.formVisible,true);
 assert.match(state.status,/Acceso no autorizado/);
 assert.equal(state.loads,0);
 assert.equal(state.navLocked,true);
 assert.equal(state.navDisabled,true);
 assert.equal(state.refreshDisabled,true);
 assert.equal(state.historyReady,false);
});
test('Cierre de sesión limpia historial, catálogos y fotos inmediatamente',async()=>{
 const h=fixture();await h.logout();
 const state=h.state();
 assert.equal(state.records.length,0);
 assert.equal(state.custom.length,0);
 assert.deepEqual(Object.keys(state.photos),[]);
 assert.equal(state.page,'sesion');
 assert.equal(state.profileVisible,false);
 assert.equal(state.formVisible,true);
 assert.equal(state.navLocked,true);
 assert.equal(state.navDisabled,true);
 assert.equal(state.historyReady,false);
});
