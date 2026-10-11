import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const auth=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function extract(a,b){
 const start=auth.indexOf(a),end=auth.indexOf(b,start);
 assert.ok(start>=0&&end>start,'No se encontró '+a);
 return auth.slice(start,end);
}
const apply=extract('async function applyState(session,epoch) {','async function findOrCreate(');
const retry=extract('async refreshCatalog(){','async ensureExercise(');
function fixture({failCatalog=false,failHistory=false,failIndependent=false,delayedCatalog=false}={}){
 const code=[
  "let signedIn=null,lastDraftOwner=null,authEpoch=1,historyReady=false,failCatalog="+failCatalog+",failHistory="+failHistory+",failIndependent="+failIndependent+",delayed="+delayedCatalog+",releaseCatalog=null;",
  "let historyReads=0,profileReads=0,page='',status='',catCount=0;",
  "const model={records:[],photos:{}};",
  "const elements={};",
  "const $=id=>elements[id]??={hidden:false,disabled:false,textContent:''};",
  "const document={body:{classList:{toggle(){}}},querySelectorAll:()=>[{dataset:{page:'registro'},disabled:false,setAttribute(){}},{dataset:{page:'catalogos'},disabled:false,setAttribute(){}}]};",
  "const window={GymBaseCatalog:[],GymCustomCatalog:[],GymExerciseLibrary:[],GymEntities:{gyms:[],sites:[],machines:[],options:[]}};",
  "const owns=()=>!!signedIn?.id;",
  "const setHistoryReady=value=>{historyReady=!!value};",
  "const invalidatePendingSave=()=>{},resetExerciseTabs=()=>{},renderOwnCatalog=()=>{},renderIndependentCatalog=()=>{},drawRecent=()=>{},drawHistory=()=>{},drawReports=()=>{};",
  "const showPage=name=>{page=name},setStatus=value=>{status=value};",
  "const assertGymlyticsAccess=async user=>{profileReads++;return {nombre:'Usuario de prueba',usuario:'prueba',activo:true}};",
  "const assertCurrentSession=(uid,epoch)=>{if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió');};",
  "const config={environment:'pruebas'},cascade=()=>{};",
  "const cloud={",
  "async loadInitialCatalog(){catCount++;if(delayed)await new Promise(r=>releaseCatalog=r);if(failCatalog)throw Error('Catálogo fuera de línea');return [{id:'ref-1',g:'Gym A'}]},",
  "async loadOwnCatalog(){return [{id:'own-1',e:'Remo'}]},",
  "async loadIndependentCatalog(){if(failIndependent)throw Error('Listas de gimnasios no disponibles');window.GymEntities={gyms:[{id:'gymA'}],sites:[],machines:[],options:[]}},",
  "async loadHistory(){historyReads++;if(failHistory)throw Error('Historial fuera de línea');return [{id:'serie-1',user_id:signedIn.id,date:'2026-10-10',weight:25}]},",
  "async loadCatalogStats(){} ,",
  retry,
  "};",
  apply,
  "({start:()=>applyState({user:{id:'A',email:'a@test.dev'}},1),reload:()=>cloud.refreshCatalog(),",
  "stop:()=>{signedIn={id:'B'};authEpoch++},resolve:()=>releaseCatalog?.(),",
  "enableCatalog:()=>{failCatalog=false},setDelayed:()=>{delayed=true},disableHistory:()=>{failHistory=true},",
  "state:()=>({records:model.records,ready:historyReady,page,status,base:window.GymBaseCatalog,custom:window.GymCustomCatalog,catMessage:$('catalogStatus').textContent,",
  "refresh:$('historyRefresh').disabled,catalogRefresh:$('catalogRefresh').disabled,historyReads,catCount})});"
 ].join('\n');
 return runInNewContext(code);
}
test('Si falla el catálogo, mantiene la descarga del historial y el Dashboard utilizable',async()=>{
 const h=fixture({failCatalog:true});await h.start();
 const v=h.state();
 assert.equal(v.records.length,1);
 assert.equal(v.records[0].id,'serie-1');
 assert.equal(v.ready,true);
 assert.equal(v.page,'catalogos');
 assert.equal(v.historyReads,1);
 assert.equal(v.refresh,false);
 assert.equal(v.catalogRefresh,false);
 assert.match(v.catMessage,/Actualizar catálogo/);
 assert.match(v.status,/Catálogo fuera de línea/);
});
test('El catálogo se recupera manualmente sin borrar el historial previamente descargado',async()=>{
 const h=fixture({failCatalog:true});await h.start();h.enableCatalog();
 const count=await h.reload();
 assert.equal(count,1);
 assert.equal(h.state().base[0].id,'ref-1');
 assert.equal(h.state().custom[0].e,'Remo');
 assert.equal(h.state().records[0].id,'serie-1');
 assert.equal(h.state().ready,true);
 assert.equal(h.state().historyReads,1);
});
test('Si falla catálogo e historial no se declara lista una copia parcial',async()=>{
 const h=fixture({failCatalog:true,failHistory:true});await h.start();
 assert.equal(h.state().ready,false);
 assert.equal(h.state().records.length,0);
 assert.match(h.state().status,/Historial fuera de línea/);
});
test('Si solo falla historial conserva el catálogo y permite actualizar historial',async()=>{
 const h=fixture({failHistory:true});await h.start();
 assert.equal(h.state().base.length,1);
 assert.equal(h.state().ready,false);
 assert.equal(h.state().page,'registro');
 assert.equal(h.state().refresh,false);
});
test('Respuesta de recarga de la cuenta anterior nunca sustituye el catálogo de otra cuenta',async()=>{
 const h=fixture();await h.start();
 const h2=fixture({delayedCatalog:true});
 // El primer intento se deja pendiente y luego cambia la identidad.
 const pending=h2.start();
 await Promise.resolve();await Promise.resolve();
 h2.stop();h2.resolve();
 await pending;
 assert.equal(h2.state().base.length,0);
});
test('El botón de actualización está deshabilitado por defecto y se conecta a su controlador',()=>{
 assert.match(html,/id="catalogRefresh"[^>]*disabled/);
 assert.match(auth,/\$\('catalogRefresh'\)\.addEventListener\('click'/);
 assert.match(auth,/if\(!catalogLoaded&&catalogStatus\)/);
});

test('La actualización manual tardía no publica los ejercicios en otra sesión',async()=>{
 const h=fixture();await h.start();
 h.setDelayed();
 const loading=h.reload();
 await Promise.resolve();await Promise.resolve();
 h.stop();h.resolve();
 await assert.rejects(loading,/La sesión cambió/);
 assert.equal(h.state().base[0].id,'ref-1');
});
test('En inicio exitoso la actualización manual queda habilitada',async()=>{
 const h=fixture();await h.start();
 assert.equal(h.state().catalogRefresh,false);
 assert.equal(h.state().records.length,1);
 assert.equal(h.state().ready,true);
});

test('Si fallan las listas de gimnasios, no declara completo el catálogo ni abre Registro',async()=>{
 const h=fixture({failIndependent:true});await h.start();
 const st=h.state();
 assert.equal(st.page,'catalogos');
 assert.match(st.catMessage,/Actualizar catálogo/);
 assert.equal(st.records.length,1);
 assert.equal(st.ready,true);
 assert.equal(st.historyReads,1);
});
test('Si falla solo la descarga del historial, no la repite automáticamente',async()=>{
 const h=fixture({failHistory:true});await h.start();
 const st=h.state();
 assert.equal(st.historyReads,1);
 assert.equal(st.ready,false);
 assert.equal(st.refresh,false);
 assert.equal(st.page,'registro');
});
