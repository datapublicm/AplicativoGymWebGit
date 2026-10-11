import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../web/sw.js',import.meta.url),'utf8');
function harness(){
 const handlers={},deleted=[],put=[],fetches=[],cacheNames=[
  'gymlytics-mobile-v0.3-20261010','gymlytics-mobile-v0.4-20261010','gymlytics-mobile-v0.5-20261011',
  'otra-app-v1','dashboard-personal','gymlog-otra-app'
 ];
 const self={
  location:{href:'https://ejemplo.test/apps/gymlytics/sw.js',origin:'https://ejemplo.test'},
  clients:{claim:async()=>{}},skipWaiting:async()=>{},
  addEventListener:(name,fn)=>{handlers[name]=fn}
 };
 const caches={
  keys:async()=>cacheNames,
  delete:async key=>{deleted.push(key);return true},
  open:async()=>({
   addAll:async()=>{},
   put:async(req)=>put.push(req.url)
  }),
  match:async()=>null
 };
 const fetch=async req=>{fetches.push(req.url);return {ok:true,clone(){return {ok:true}}}};
 runInNewContext(source,{URL,Set,self,caches,fetch,Response:{error:()=>({error:true})}});
 async function activate(){let waiting;handlers.activate({waitUntil:p=>waiting=p});await waiting}
 async function request(path,method='GET'){
  let supplied,waiting=[];
  const req={url:new URL(path,self.location.href).href,method};
  handlers.fetch({request:req,respondWith:p=>supplied=p,waitUntil:p=>waiting.push(p)});
  if(supplied)await supplied;
  await Promise.all(waiting);
  return Boolean(supplied);
 }
 return {activate,request,deleted,put,fetches};
}

test('Actualizar Gymlytics no elimina cachés de otras aplicaciones',async()=>{
 const h=harness();await h.activate();
 assert.deepEqual(h.deleted,['gymlytics-mobile-v0.3-20261010','gymlytics-mobile-v0.4-20261010','gymlytics-mobile-v0.5-20261011']);
});
test('La app solo intercepta y almacena recursos estáticos propios',async()=>{
 const h=harness();
 assert.equal(await h.request('./app.js'),true);
 assert.deepEqual(h.put,['https://ejemplo.test/apps/gymlytics/app.js']);
 assert.equal(h.fetches.length,1);
});
test('No almacena URLs con token, parámetros de recuperación ni API',async()=>{
 const h=harness();
 for(const path of ['./?code=secreto','./index.html?access_token=abc','./rest/v1/tbl_series','../otra-app/index.html']){
  assert.equal(await h.request(path),false,path);
 }
 assert.equal(h.put.length,0);
 assert.equal(h.fetches.length,0);
});
test('Service worker no intercepta métodos distintos de GET',async()=>{
 const h=harness();
 assert.equal(await h.request('./app.js','POST'),false);
 assert.equal(h.put.length,0);
});
