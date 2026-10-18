import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../web/offline-first.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const section=(from,to)=>{
 const a=source.indexOf(from),b=source.indexOf(to,a);
 assert.ok(a>0&&b>a,from);return source.slice(a,b);
};
const complete=section('async function completeCloudLogin(', '\nasync function cloudLogin(');
const action=section('async function remoteAction(', '\nfunction downloadLocal(');

function authCase(row,opts={}){
 const js=[
  'let cloudAccountKind=null,remoteSession=null,provisionCalls=0,updates=0,rotations=0,notifications=[];',
  'let account='+JSON.stringify(row)+';',
  'let latest={name:'+JSON.stringify(opts.localName||'Mi perfil')+',data:{cloudUserId:null}};',
  'const client={}; const stamp=()=> "perfil-uno";',
  'const requireCloudIdentity=(uid,ownerStamp)=>{if(uid!=="uid" || ownerStamp!=="perfil-uno")throw Error("Identidad distinta")};',
  'const syncController={ensureUser:async()=>{provisionCalls++;if(account?.tipo_cuenta==="prueba")throw Error("La cuenta remota no es personal");return {id:"uid",auth_id:"uid",tipo_cuenta:"personal"}}};',
  'const refreshCloudControls=()=>updates++; const renderSyncStatus=()=>{};const linkAccount=async()=>updates++; const status=text=>notifications.push(text);const rotateCloudClient=()=>{rotations++;remoteSession=null;cloudAccountKind=null;};',
  complete,
  '({login:()=>completeCloudLogin({user:{id:"uid",email:"test@example.org"}},"perfil-uno",client),state:()=>({kind:cloudAccountKind,provisionCalls,updates,rotations,session:!!remoteSession,notifications})});'
 ].join('\n');
 return runInNewContext(js);
}
function downloadCase(kind){
 const js=[
  'let cloudAccountKind='+JSON.stringify(kind)+',remoteSession={user:{id:"uid"}},calls=[],latest={data:{cloudUserId:'+JSON.stringify(kind==='personal'?'uid':null)+'}};',
  'const syncController={download:async(...args)=>calls.push(args),upload:async(...args)=>calls.push(args)};',
  'const stamp=()=> "perfil";',
  action,
  '({action:async(name,options={})=>remoteAction(name,options),calls});'
 ].join('\n');
 return runInNewContext(js);
}
test('Solo una cuenta personal puede quedar vinculada al esquema nuevo',async()=>{
 const h=authCase({tipo_cuenta:'prueba'});
 await assert.rejects(h.login(),/no es personal/);
 const r=h.state();assert.equal(r.kind,null);assert.equal(r.session,false);assert.equal(r.rotations,1);
});
test('El perfil local Prueba puede vincularse con una cuenta personal',async()=>{
 const h=authCase({tipo_cuenta:'personal'},{localName:'Prueba'});
 await h.login();assert.equal(h.state().kind,'personal');assert.equal(h.state().session,true);
});
test('Primer inicio de sesión registra la identidad con las ocho tablas',async()=>{
 const h=authCase(null);await h.login();
 const r=h.state();assert.equal(r.provisionCalls,1);assert.equal(r.kind,'personal');assert.equal(r.updates,1);
});
test('Si la validación de cuenta falla se retira la sesión remota sin tocar perfil',async()=>{
 const h=authCase({tipo_cuenta:'prueba'});
 await assert.rejects(h.login(),/cuenta remota/);
 assert.equal(h.state().session,false);
});
test('Usuario demo descarga editable offline sin permiso de escritura en nube',async()=>{
 const h=downloadCase('demo');
 await h.action('download');
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][2].readOnly,true);
 await assert.rejects(h.action('upload'),/cuenta personal vinculada/);
});
test('Usuario personal siempre descarga en modo editable local',async()=>{
 const h=downloadCase('personal');
 await h.action('download',{readOnly:true});
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][2].readOnly,false);
 await h.action('upload');assert.equal(h.calls.length,2);
});
test('Los perfiles demo conservan lectura, exportación y consulta del historial',()=>{
 assert.match(source,/canRead:\(\)=>!!activeId&&!!latest/);
 assert.match(source,/canWrite:\(\)=>!!activeId&&!!latest&&!transitioning/);
 assert.match(app,/if\(historyReady&&!!window\.GymCloud\?\.canRead\?\.\(\)\)return true/);
 assert.match(app,/if\(!window\.GymCloud\?\.canRead\?\.\(\)\)/);
});
