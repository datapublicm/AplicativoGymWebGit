import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileMeta,validateProfileName,validateProfileBinding,verifyRestoreBackup} from '../web/profile-policy.js';
import {createCloudSync} from '../web/cloud-sync.js';

const source=readFileSync(new URL('../web/offline-first.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const defaultData=()=>({records:[],pending:[],tombstones:[],custom:[],library:[],
 entities:{gyms:[],sites:[],machines:[],options:[]},photos:{},photoVersions:{},
 photoPayloads:{},referenceOverrides:{},cloudUserId:null});
const profiles=[
 {id:'perfil-a',name:'Primero',cloudUserId:'cuenta-a'},
 {id:'perfil-b',name:'Segundo',cloudUserId:'cuenta-b'}
];
test('No permitir nombres vacíos, duplicados ni exceso de longitud',()=>{
 assert.throws(()=>validateProfileName('',profiles));
 assert.throws(()=>validateProfileName('primero',profiles),/existe/);
 assert.throws(()=>validateProfileName('x'.repeat(61),profiles));
 assert.equal(validateProfileName('  Mi   perfil  ',profiles),'Mi perfil');
});
test('Nunca asociar un perfil ya vinculado a otra cuenta',()=>{
 assert.throws(()=>validateProfileBinding(profiles,'perfil-a','cuenta-b'));
 assert.throws(()=>validateProfileBinding(profiles,'perfil-a','cuenta-nueva'),/otra cuenta/);
 assert.equal(validateProfileBinding(profiles,'perfil-a','cuenta-a'),true);
});
test('No permitir dos perfiles con la misma cuenta',()=>{
 const p=[{...profiles[0],cloudUserId:null},profiles[1]];
 assert.throws(()=>validateProfileBinding(p,'perfil-a','cuenta-b'),/otro perfil/);
});
test('Respaldo íntegro conserva fotos, modificaciones de referencia y pendientes',()=>{
 const data=defaultData();
 data.photos['ejercicio:Gym|Sede|Máquina|Remo']='data:image/jpeg;base64,YWJj';
 data.photoPayloads['task-1']='data:image/jpeg;base64,YWJj';
 data.referenceOverrides['gimnasio']={name:'Nuevo'};
 data.pending.push({id:'task-1',kind:'photo'});
 const backup={format:'gymlytics-profile-backup',version:1,data, name:'Perfil offline'};
 assert.equal(verifyRestoreBackup(backup,[]),true);
 const restored=structuredClone(backup);
 assert.deepEqual(restored.data,data);
 assert.equal(restored.data.photoPayloads['task-1'],data.photoPayloads['task-1']);
});
test('Rechazar respaldo incompleto o con cuenta vinculada duplicada',()=>{
 const bad={format:'gymlytics-profile-backup',version:1,data:{records:[]}};
 assert.throws(()=>verifyRestoreBackup(bad,[]),/compatible/);
 const data=defaultData();data.cloudUserId='cuenta-a';
 assert.throws(()=>verifyRestoreBackup({format:'gymlytics-profile-backup',version:1,data},profiles),/otro perfil/);
});
const begin='async function deleteActiveProfile(){',end='\nfunction catalogUpdate(){';
const start=source.indexOf(begin),stop=source.indexOf(end,start);
assert.ok(start>=0&&stop>start);
const deletion=source.slice(start,stop);
const evaluateDelete=({ids=['a','b'],approve=true,busy=false}={})=>{
 const store=new Map(ids.map(id=>[id,{id,name:id,data:{records:[{id}],photos:{[id]:'foto'}}}]));
 const removed=[],switched=[];let selected=ids[0],asked=0,ui={value:selected,replaceChildren(){}};
 const fn=new Function('activeId','profiles','syncController','transitioning','get','activate',
  'requestFrom','all','profileMeta','$','renderProfileControls','status','confirm','Option',
  deletion+';return deleteActiveProfile;')(
  selected,ids.map(id=>profileMeta(store.get(id))),{isBusy:()=>busy},false,
  async key=>store.get(key),async id=>{switched.push(id);selected=id},
  async(_table,_mode,action)=>action({delete:key=>{removed.push(key);store.delete(key)}}),
  async()=>[...store.values()],profileMeta,()=>ui,()=>{},()=>{},
  ()=>{asked++;return approve},class{constructor(n,id){this.textContent=n;this.value=id}}
 );
 return {fn,store,removed,switched,asked:()=>asked,selected:()=>selected};
};
test('Eliminar perfil se cancela sin borrar si el usuario no confirma',async()=>{
 const h=evaluateDelete({approve:false});assert.equal(await h.fn(),false);
 assert.equal(h.store.size,2);assert.deepEqual(h.removed,[]);
});
test('Eliminar perfil cambia primero a otro y no afecta los demás datos',async()=>{
 const h=evaluateDelete({ids:['a','b','c']});assert.equal(await h.fn(),true);
 assert.deepEqual(h.switched,['b']);assert.deepEqual(h.removed,['a']);
 assert.deepEqual([...h.store.keys()],['b','c']);
 assert.equal(h.store.get('b').data.photos.b,'foto');
});
test('No permite eliminar el único perfil ni eliminar durante sincronización',async()=>{
 const only=evaluateDelete({ids:['solo']});
 await assert.rejects(only.fn(),/único perfil/);
 assert.equal(only.store.size,1);
 const busy=evaluateDelete({busy:true});
 await assert.rejects(busy.fn(),/Termina/);
 assert.equal(busy.store.size,2);
});
test('El menú compacto contiene Eliminar y la protección de último perfil',()=>{
 assert.match(html,/data-profile-action="delete"/);
 assert.match(source,/profiles\.length<2/);
 assert.match(source,/del\.disabled=profiles\.length<2/);
});
test('La caché offline conserva foto, referencias y motores de sincronización',()=>{
 const sw=readFileSync(new URL('../web/sw.js',import.meta.url),'utf8');
 const vite=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
 for(const file of ['catalog-sync-engine.js','reference-overrides.js','photo-sync-engine.js']){
  assert.ok(sw.includes("'./"+file+"'"),file);
  assert.ok(vite.includes("'"+file+"'"),file);
 }
});

test('Sin Internet: no consulta ni escribe en Supabase, conserva operaciones pendientes',async()=>{
 const old=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
 try{
  const data=defaultData();data.cloudUserId='cuenta-uno';
  data.pending=[{id:'pendiente',kind:'add_catalog',catalogKind:'gym',localId:'local'}];
  let reads=0,writes=0;
  const sync=createCloudSync({
   remote:{from:()=>{reads++;throw Error('No se debe consultar Supabase offline')}},
   getState:()=>({data,profileName:'Offline'}),
   mutate:async()=>{writes++},refresh:()=>{},
   isCurrent:(uid,stamp)=>uid==='cuenta-uno'&&stamp==='token',isLinkedElsewhere:()=>false,
   confirmAction:()=>true,notify:()=>{},catalogFetch:async()=>({})
  });
  await assert.rejects(sync.upload('cuenta-uno','token'),/No hay conexión/);
  assert.equal(reads,0);assert.equal(writes,0);
  assert.equal(data.pending.length,1);
 }finally{
  if(old===undefined)delete globalThis.navigator;
  else Object.defineProperty(globalThis,'navigator',{value:old,configurable:true});
 }
});
test('Intentar sincronizar otro perfil o cuenta aborta antes de contactar Supabase',async()=>{
 const data=defaultData();data.cloudUserId='cuenta-uno';
 let reads=0,writes=0;
 const sync=createCloudSync({
  remote:{from:()=>{reads++;throw Error('Consulta inesperada')}},
  getState:()=>({data,profileName:'Offline'}),mutate:async()=>{writes++},
  refresh:()=>{},isCurrent:(uid,stamp)=>uid==='cuenta-uno'&&stamp==='token',
  isLinkedElsewhere:()=>false,confirmAction:()=>true,notify:()=>{},catalogFetch:async()=>({})
 });
 await assert.rejects(sync.upload('cuenta-dos','token'),/Cambió la cuenta o el perfil/);
 await assert.rejects(sync.upload('cuenta-uno','token-antiguo'),/Cambió la cuenta o el perfil/);
 assert.equal(reads,0);assert.equal(writes,0);
});
