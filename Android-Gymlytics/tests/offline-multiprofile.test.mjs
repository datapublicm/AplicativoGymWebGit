import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {profileMeta,validateProfileName,validateProfileBinding,verifyRestoreBackup} from '../web/profile-policy.js';

const src=readFileSync(new URL('../web/offline-first.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const bundle=readFileSync(new URL('../web/sw.js',import.meta.url),'utf8');
const base=(id,name,cloudUserId=null,series=[])=>({id,name,data:{
 records:series,photos:{},pending:[],tombstones:[],custom:[],library:[],
 entities:{gyms:[],sites:[],machines:[],options:[]},cloudUserId}});
test('Los perfiles conservan sus IDs y exponen solo metadatos mínimos en memoria',()=>{
 const profiles=[profileMeta(base('p1','Fuerza',null,[{id:'a',weight:100}]))];
 assert.equal(profiles[0].records,1);
 assert.ok(!('data' in profiles[0]));
 assert.ok(!JSON.stringify(profiles).includes('weight'));
});
test('Nombres locales únicos, con cambio de nombre sin afectar otro perfil',()=>{
 const profiles=[profileMeta(base('p1','A')),profileMeta(base('p2','B'))];
 assert.equal(validateProfileName('  Mi   perfil ',profiles),'Mi perfil');
 assert.throws(()=>validateProfileName(' a ',profiles),/Ya existe/);
 assert.equal(validateProfileName('A',profiles,'p1'),'A');
 assert.throws(()=>validateProfileName(' '.repeat(3),profiles),/entre 1 y 60/);
 assert.throws(()=>validateProfileName('x'.repeat(61),profiles),/entre 1 y 60/);
});
test('Una cuenta diferente por perfil: se impiden vínculos cruzados y duplicados',()=>{
 const profiles=[profileMeta(base('p1','Adulto','cloud-A')),profileMeta(base('p2','Joven',null))];
 assert.equal(validateProfileBinding(profiles,'p1','cloud-A'),true);
 assert.throws(()=>validateProfileBinding(profiles,'p1','cloud-B'),/vinculado a otra cuenta/);
 assert.throws(()=>validateProfileBinding(profiles,'p2','cloud-A'),/ya está asociada a otro perfil/);
 assert.equal(validateProfileBinding(profiles,'p2','cloud-B'),true);
});
test('Perfiles sin nube son válidos y permanecen independientes',()=>{
 const profiles=[profileMeta(base('a','Usuario 1')),profileMeta(base('b','Usuario 2'))];
 assert.equal(validateProfileBinding(profiles,'a','nueva-A'),true);
 assert.equal(validateProfileBinding(profiles,'b','nueva-B'),true);
 assert.ok(profiles.every(p=>p.cloudUserId===null));
});
test('Restaurar respaldo conserva lápidas y rechaza duplicar una cuenta vinculada',()=>{
 const p=base('p1','A','cloud-A');
 const backup={format:'gymlytics-profile-backup',version:1,data:{
 ...p.data,pending:[{id:'op'}],tombstones:[{id:'borrada'}]}};
 assert.throws(()=>verifyRestoreBackup(backup,[profileMeta(p)]),/Ya existe otro perfil/);
 assert.equal(verifyRestoreBackup(backup,[]),true);
 const copy=structuredClone(backup.data);copy.tombstones.push({id:'otra'});
 assert.equal(backup.data.tombstones.length,1);
});
test('UI de Perfil permite crear, renombrar y vincular sin pedir login previo',()=>{
 for(const key of ['offlineProfiles','offlineNewName','offlineCreate','offlineRenameName',
 'offlineRename','offlineLinkAccount','offlineBackup','offlineImport'])
  assert.ok(html.includes('id="'+key+'"'),key);
 assert.match(html,/data-page="sesion" type="button"><span>♙<\/span> Perfil/);
 assert.match(src,/function rotateCloudClient\(/);
 assert.match(src,/await queue;/);
 assert.match(src,/validateProfileBinding\(profiles,activeId,uid\)/);
 assert.match(src,/if\(!confirm\('¿Vincular/);
 assert.match(bundle,/profile-policy\.js/);
});
test('El cambio de A a B espera guardados activos y destruye sesión previa',async()=>{
 const start=src.indexOf('async function activate(id,initial=false){');
 const end=src.indexOf('\nasync function createProfile()',start);
 assert.ok(start>0&&end>start);
 const method=src.slice(start,end);
 const js=`
let activeId='A',profileEpoch=4,transitioning=false,remoteSession={user:{id:'cloud-A'}};
let queueDone,rotations=0,reads=0,savedId=null,draws=0;
const queue=new Promise(ok=>queueDone=ok);
let profiles=[{id:'A',name:'Usuario A',cloudUserId:'cloud-A'},{id:'B',name:'Usuario B',cloudUserId:null}];
let latest={id:'A',name:'Usuario A',data:{records:[{id:'serie-A'}]}};
const syncController={isBusy:()=>false};
const model={records:[{id:'serie-A'}],photos:{secret:'A'}};
const window={GymBaseCatalog:[{g:'A'}],GymEntities:{},GymCustomCatalog:[{id:'A'}],GymExerciseLibrary:[]};
const elements={offlineProfiles:{value:'A',disabled:false,replaceChildren(...xs){this.options=xs}},
 historyRefresh:{},catalogRefresh:{},offlineCloudPanel:{},offlineRemoteUser:{}};
const $=id=>elements[id]||(elements[id]={});
function Option(name,id){this.textContent=name;this.value=id}
const get=async id=>{reads++;return {id,name:'Usuario B',data:{
 records:[{id:'serie-B'}],photos:{secret:'B'},entities:{gyms:[],sites:[],machines:[],options:[]},
 library:[],custom:[],pending:[],tombstones:[]}}};
const all=async()=>[await get('B')];
const profileMeta=p=>({id:p.id,name:p.name,cloudUserId:p.data.cloudUserId||null});
const rotateCloudClient=()=>{rotations++;remoteSession=null};
const localStorage={setItem:(k,v)=>savedId=v};
const invalidatePendingSave=()=>{},showHistoryLoadProgress=()=>{},setHistoryReady=()=>{};
const catalogInit=()=>[],resetHistoryFilters=()=>{},resetExerciseTabs=()=>{},renderOwnCatalog=()=>{};
const renderIndependentCatalog=()=>{},cascade=()=>{},renderSyncStatus=()=>{},renderProfileControls=()=>{};
const drawRecent=()=>{draws++},drawHistory=()=>{draws++},drawReports=()=>{draws++};
const renderConflictButtons=()=>{},refreshCloudControls=()=>{},status=()=>{},showPage=()=>{};
const document={body:{classList:{remove:()=>{}}},querySelectorAll:()=>[]};
const EMPTY=()=>({entities:{gyms:[],sites:[],machines:[],options:[]}});
${method}
({switchProfile:()=>activate('B'),release:()=>queueDone(),
 state:()=>({activeId,profileEpoch,transitioning,remoteSession,
 records:model.records.map(r=>r.id),photos:model.photos,rotations,reads,savedId})});
`;
 const h=runInNewContext(js);
 const running=h.switchProfile();
 assert.equal(h.state().transitioning,true);
 assert.equal(h.state().activeId,'A');
 assert.equal(h.state().rotations,0,'No invalidar A antes de finalizar su escritura');
 h.release();await running;
 const state=h.state();
 assert.equal(state.activeId,'B');assert.equal(state.rotations,1);
 assert.equal(state.remoteSession,null);
 assert.deepEqual(Array.from(state.records),['serie-B']);
 assert.equal(state.photos.secret,'B');assert.equal(state.savedId,'B');
});
