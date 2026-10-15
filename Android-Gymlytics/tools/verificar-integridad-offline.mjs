// Ejecución real del paquete web dentro de Chromium con IndexedDB y Service Worker.
// No toca datos reales ni Supabase: se sirve dist con una clave de prueba ficticia.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const work=mkdtempSync(join(tmpdir(),'gym-integrity-'));
const chrome=process.env.CHROME_BIN||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(n=>(process.env.PATH||'').split(':').some(p=>existsSync(join(p,n))));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let browser,server,ws,id=0,stderr='';
const pending=new Map();
function cd(method,params={}){
 return new Promise((ok,fail)=>{
  const n=++id,clock=setTimeout(()=>{pending.delete(n);fail(Error('Chrome tardó: '+method))},20000);
  pending.set(n,{ok:x=>{clearTimeout(clock);ok(x)},fail:x=>{clearTimeout(clock);fail(x)}});
  ws.send(JSON.stringify({id:n,method,params}));
 });
}
async function evaluate(expression){
 const response=await cd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(response.exceptionDetails)throw Error('JavaScript: '+JSON.stringify(response.exceptionDetails).slice(0,1300));
 return response.result?.value;
}
async function until(expression,label){
 for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch{}await delay(120);}
 throw Error('No se alcanzó: '+label+' · estado='+await evaluate('document.getElementById("authStatus")?.textContent'));
}
async function navigate(url){
 const r=await cd('Page.navigate',{url});
 if(r.errorText)throw Error('Navegación: '+r.errorText);
 await until('document.readyState==="complete"','página completa');
}
async function db(){
 return evaluate(`(async()=>{const req=indexedDB.open('gymlytics_offline_profiles_v1',1);
 const database=await new Promise((ok,fail)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error)});
 const tx=database.transaction('profiles','readonly');
 const all=await new Promise((ok,fail)=>{const q=tx.objectStore('profiles').getAll();
 q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(q.error)});
 database.close();return all.map(p=>({id:p.id,name:p.name,cloudUserId:p.data.cloudUserId,
 records:p.data.records,pending:p.data.pending,tombstones:p.data.tombstones}));})()`);
}
const workout=(date,weight)=>({exercise:{g:'Smart Fit',s:'Pruebas',z:'Pecho',kind:'Máquina',
 i:'Prensa',a:'Ninguno',gr:'Neutro',e:'Press de pecho'},date,technique:'Controlado',
 notes:'Registro sin conectividad',entries:[{series:'Serie 1',sub:'-',unit:'kg',weight,reps:10,assistance:0}]});
try{
 assert.ok(chrome,'Chromium no disponible en runner');
 assert.ok(existsSync(join(root,'index.html')),'Primero construir npm run build:web');
 server=createServer((req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const file=resolve(root,'.'+(name==='/'?'/index.html':name));
   if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
   const bytes=readFileSync(file);
   const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript',
    '.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
    'Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0',
  '--user-data-dir='+work,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr?.on('data',chunk=>stderr+=String(chunk).slice(-3000));
 let port=0;
 for(let i=0;i<250;i++){try{port=Number(readFileSync(join(work,'DevToolsActivePort'),'utf8').split('\n')[0]);break}catch{await delay(100)}}
 assert.ok(port,'Chrome no inició: '+stderr.slice(-900));
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});
 ws.addEventListener('message',ev=>{
  const data=JSON.parse(ev.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);
  if(data.error)p.fail(Error(data.error.message));else p.ok(data.result);
 });
 await cd('Page.enable');await cd('Runtime.enable');await cd('Network.enable');
 const url='http://127.0.0.1:'+server.address().port+'/index.html';
 await navigate(url);
 await until('!!window.GymCloud?.canWrite?.()','inicialización IndexedDB sin login');
 assert.equal(await evaluate('document.querySelector("#authForm")!==null'),true);
 assert.equal(await evaluate('document.body.classList.contains("auth-locked")'),false);
 assert.equal(await evaluate('document.querySelector("#offlineProfiles").options.length'),1);
 console.log('PASS 1: instalación web sin login y perfil creado automáticamente');

 await until('navigator.serviceWorker?.ready.then(()=>true).catch(()=>false)','registro Service Worker');
 // Online=false no puede disparar subidas, pero permite entradas offline en IndexedDB.
 await cd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 // El primer reinicio después de instalar debe funcionar incluso sin una segunda
 // visita online: es aquí donde los chunks hash de Vite deben estar precargados.
 await navigate(url);
 await until('!!window.GymCloud?.canWrite?.()','primera reapertura inmediata sin Internet');
 assert.equal(await evaluate('document.querySelector("#offlineProfiles").options.length'),1);
 console.log('PASS 1b: primer arranque después de instalar con caché inicial sin Internet');
 for(const [date,weight] of [['2026-07-15',30],['2026-08-15',32],['2026-09-15',35],['2026-10-15',40]]){
  const r=await evaluate('window.GymCloud.saveWorkout('+JSON.stringify(workout(date,weight))+')');
  assert.equal(r,1);
 }
 let profiles=await db();
 assert.equal(profiles.length,1);assert.equal(profiles[0].records.length,4);
 assert.equal(profiles[0].pending.length,4);
 assert.equal(profiles[0].records[0].weight,30);
 console.log('PASS 2: cuatro meses de registros offline conservados con cola de subida');

 await evaluate(`(()=>{document.querySelector('#offlineNewName').value='Segundo usuario';
 document.querySelector('#offlineCreate').click();return true})()`);
 await until('document.querySelector("#offlineProfiles").options.length===2','segundo perfil offline');
 profiles=await db();
 assert.equal(profiles.length,2);assert.equal(profiles.find(x=>x.name==='Segundo usuario').records.length,0);
 await evaluate('window.GymCloud.saveWorkout('+JSON.stringify(workout('2026-10-14',65))+')');
 profiles=await db();
 assert.equal(profiles.find(x=>x.name==='Segundo usuario').records.length,1);
 assert.equal(profiles.find(x=>x.name==='Mi perfil').records.length,4);
 console.log('PASS 3: dos usuarios offline, datos estrictamente separados');

 await evaluate(`(()=>{const select=document.querySelector('#offlineProfiles');
 const first=[...select.options].find(o=>o.textContent==='Mi perfil');
 select.value=first.value;select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
 await until('document.querySelector("#offlineProfiles").selectedOptions[0].textContent==="Mi perfil" && window.GymCloud?.canWrite()','regreso a perfil A');
 const rows=await evaluate('window.GymCloud.loadHistory()');
 assert.equal(rows.length,4);assert.ok(rows.every(r=>r.weight<50));
 const removedId=rows[0].id;
 await evaluate('window.GymCloud.deleteSeries('+JSON.stringify(removedId)+')');
 profiles=await db();
 assert.equal(profiles.find(x=>x.name==='Mi perfil').records.length,3);
 assert.equal(profiles.find(x=>x.name==='Mi perfil').tombstones.length,1);
 assert.equal(profiles.find(x=>x.name==='Mi perfil').pending.length,3);
 console.log('PASS 4: borrado offline anterior a primera subida, lápida duradera');

 await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await navigate(url);
 await until('window.GymCloud?.canWrite?.() && document.querySelector("#offlineProfiles").options.length===2','reinicio completo');
 profiles=await db();
 assert.equal(profiles.find(x=>x.name==='Mi perfil').records.length,3);
 assert.equal(profiles.find(x=>x.name==='Mi perfil').tombstones.length,1);
 assert.equal(profiles.find(x=>x.name==='Segundo usuario').records.length,1);
 console.log('PASS 5: persistencia IndexedDB tras cerrar/reabrir la interfaz');

 await evaluate(`(()=>{const select=document.querySelector('#offlineProfiles');
 select.value=[...select.options].find(o=>o.textContent==='Segundo usuario').value;
 select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
 await until('document.querySelector("#offlineProfiles").selectedOptions[0].textContent==="Segundo usuario"','cambiar tras reinicio');
 assert.equal((await evaluate('window.GymCloud.loadHistory()')).length,1);
 console.log('PASS 6: no hay fugas de datos después de reiniciar');

 // Volver a abrir sin red comprueba cache de scripts, no solo IndexedDB.
 await until('navigator.serviceWorker.controller!==null','Service Worker controla cliente');
 await cd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await navigate(url);
 await until('!!window.GymCloud?.canWrite?.()','arranque sin red con cache instalada');
 assert.equal((await evaluate('window.GymCloud.loadHistory()')).length,1);
 console.log('PASS 7: reinicio web completamente offline sin pérdida ni login');

 console.log('7 escenarios Chromium+IndexedDB reales superados, sin compilar ni desplegar APK.');
}finally{
 try{await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})}catch{}
 try{ws?.close()}catch{}
 browser?.kill('SIGKILL');server?.close();
 try{rmSync(work,{recursive:true,force:true,maxRetries:12,retryDelay:200})}catch{}
}
