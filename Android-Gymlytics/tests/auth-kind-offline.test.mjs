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
  'const remote={from:table=>{if(table!=="tbl_usuarios")throw Error("Consulta ajena");return {select(){return this},eq(){return this},maybeSingle:async()=>({data:account,error:null})}}};',
  'async function provisionGymlyticsAccount(){provisionCalls++;account={id:"uid",usuario:"gym_nueva",activo:true}};',
  'const refreshCloudControls=()=>updates++; const renderSyncStatus=()=>{};const linkAccount=async()=>updates++; const status=text=>notifications.push(text);const rotateCloudClient=()=>rotations++;',
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
test('Cuenta prueba verificada por la BD activa únicamente el modo demo',async()=>{
 const h=authCase({id:'uid',usuario:'prueba',activo:true});
 await h.login();
 const r=h.state();
 assert.equal(r.kind,'demo');assert.equal(r.provisionCalls,0);assert.equal(r.session,true);
});
test('Un perfil local llamado prueba no convierte una cuenta normal en demo',async()=>{
 const h=authCase({id:'uid',usuario:'usuario_individual',activo:true},{localName:'prueba'});
 await h.login();assert.equal(h.state().kind,'personal');
});
test('Primera autenticación después de confirmar el correo termina el registro en Supabase',async()=>{
 const h=authCase(null);await h.login();
 const r=h.state();assert.equal(r.provisionCalls,1);assert.equal(r.kind,'personal');
});
test('Una cuenta de nube desactivada no se reactiva al iniciar sesión',async()=>{
 const h=authCase({id:'uid',usuario:'persona_inactiva',activo:false});
 await assert.rejects(h.login(),/no está habilitada/);
 const s=h.state();assert.equal(s.provisionCalls,0);assert.equal(s.session,false);
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
