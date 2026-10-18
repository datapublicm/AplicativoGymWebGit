/** GymLytics 01.10: primer inicio vacío e IndexedDB real en Chromium. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const chrome=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>x&&existsSync(x));
const work=mkdtempSync(join(tmpdir(),'gym-seed-test-'));
let browser,server,ws,seq=0,stderr='';const requests=new Map();
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function cd(method,params={}){
 return new Promise((ok,fail)=>{
  const id=++seq,timer=setTimeout(()=>{requests.delete(id);fail(Error('Chrome tardó: '+method));},20000);
  requests.set(id,{ok:v=>{clearTimeout(timer);ok(v)},fail:e=>{clearTimeout(timer);fail(e)}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const v=await cd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(v.exceptionDetails)throw Error('JavaScript Chromium: '+JSON.stringify(v.exceptionDetails).slice(0,500));
 return v.result?.value;
}
async function until(expression,label){
 for(let i=0;i<170;i++){try{if(await evaluate(expression))return;}catch{}await wait(150);}
 throw Error('No se alcanzó: '+label+' · '+await evaluate('document.getElementById("authStatus")?.textContent'));
}
async function profiles(){
 return evaluate(`(async()=>{const r=indexedDB.open('gymlytics_offline_profiles_v1',1),db=await new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});
 const tx=db.transaction('profiles','readonly'),rows=await new Promise((ok,fail)=>{const q=tx.objectStore('profiles').getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(q.error)});
 db.close();return rows.map(p=>({id:p.id,name:p.name,records:p.data.records?.length||0,gyms:p.data.entities?.gyms?.length||0,sites:p.data.entities?.sites?.length||0,exercises:p.data.library?.length||0,
 sessions:p.data.sessions?.length||0,pending:p.data.pending?.length||0,demo:p.data.demo,cloudUserId:p.data.cloudUserId,
 absentUnits:p.data.records?.filter(x=>x.unit===null).length||0,rows:p.data.records?.slice(-2).map(x=>({id:x.id,exerciseId:x.exerciseId}))||[]}))})()`);
}
async function navigate(){await cd('Page.navigate',{url:'http://127.0.0.1:4173/'});await until('!!window.GymCloud?.canWrite?.()','arranque completo de GymLytics');}
try{
 assert(chrome,'No se encontró Chromium en runner');
 assert(existsSync(join(root,'node_modules','vite','bin','vite.js')),'Requiere instalar dependencias, sin compilar');
 server=spawn(process.execPath,[join(root,'node_modules','vite','bin','vite.js'),'--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','ignore','pipe']});
 server.stderr.on('data',v=>stderr+=String(v).slice(-1000));
 for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:4173/')).ok)break;}catch{}await wait(130);}
 browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0','--user-data-dir='+work,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',v=>stderr+=String(v).slice(-1000));
 let port;
 for(let i=0;i<250;i++){try{port=Number(readFileSync(join(work,'DevToolsActivePort'),'utf8').split('\n')[0]);break;}catch{}await wait(100);}
 assert(port,'Chrome no inició: '+stderr.slice(-500));
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 ws.addEventListener('message',ev=>{const data=JSON.parse(ev.data),p=requests.get(data.id);if(!p)return;requests.delete(data.id);data.error?p.fail(Error(data.error.message)):p.ok(data.result);});
 await cd('Page.enable');await cd('Runtime.enable');await cd('Network.enable');
 await navigate();
 let p=await profiles();
 assert.equal(p.length,1,'El primer inicio solo debe crear el perfil vacío');
 assert.deepEqual(p[0]&&[p[0].name,p[0].records,p[0].gyms,p[0].sites,p[0].exercises,p[0].sessions,p[0].pending,p[0].cloudUserId,p[0].demo],
  ['Mi perfil',0,0,0,0,0,0,null,false]);
 assert.equal(await evaluate('document.querySelector("#offlineCloudUpload")?.disabled'),true,'No se sincroniza sin vincular');
 assert.equal(await evaluate('document.querySelector("#offlineLinkStatus")?.textContent'),"No vinculado");
 assert.equal(await evaluate('document.querySelector("#gimnasio")?.disabled'),true,'Ningún gimnasio precargado');
 console.log('PASS 1: primera instalación, gimnasio/sede/ejercicio/sesión/serie en cero y sin nube');
 const imported=await evaluate("localStorage.getItem('gymlytics-hojamatriz-seed-v1-completed')");
 assert.equal(imported,null,'Ninguna marca de HojaMatriz se registró');
 await navigate();p=await profiles();assert.equal(p.length,1);assert.equal(p[0].records,0);assert.equal(p[0].gyms,0);
 console.log('PASS 2: reinicio sin importación automática');
 const id=await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio manual"})');
 assert.equal(typeof id,'string');
 p=await profiles();assert.equal(p[0].gyms,1);assert.equal(p[0].sites,1);
 console.log('PASS 3: creación manual de gimnasio y sede «Única»');
 await evaluate('window.GymCloud.saveCustomExercise({e:"Ejercicio manual",anotacion:"Espalda",tecnica:"Ejecutar suave"})');
 p=await profiles();assert.equal(p[0].exercises,1);
 const exerciseId=await evaluate("(async()=>{const r=indexedDB.open('gymlytics_offline_profiles_v1',1),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));const tx=db.transaction('profiles','readonly'),rows=await new Promise(ok=>{const q=tx.objectStore('profiles').getAll();q.onsuccess=()=>ok(q.result)});db.close();return rows[0].data.library[0].id;})()");
 const payload={exercise:{g:'Gimnasio manual',s:'Única',z:'Espalda',kind:'Otro',i:'No especificado',a:'No especificado',gr:'No especificado',e:'Ejercicio manual',exerciseId},
  date:'2026-10-18',technique:'Prueba local',notes:'Solo IndexedDB',entries:[{series:'Serie 1',sub:'-',unit:'kg',weight:20,reps:12,assistance:0}]};
 assert.equal(await evaluate('window.GymCloud.saveWorkout('+JSON.stringify(payload)+')'),1);
 p=await profiles();assert.equal(p[0].records,1);
 console.log('PASS 4: ejercicio y entrenamiento guardados únicamente offline');
 await navigate();p=await profiles();assert.equal(p[0].records,1);assert.equal(p[0].exercises,1);
 console.log('PASS 5: persistencia local tras reiniciar');
 await evaluate("(()=>{document.querySelector('#offlineNewName').value='Segundo usuario';document.querySelector('#offlineCreate').click();return true})()");
 await until('document.querySelector("#offlineProfiles").options.length===2','perfil independiente');
 p=await profiles();assert.equal(p.find(x=>x.name==='Mi perfil').records,1);assert.equal(p.find(x=>x.name==='Segundo usuario').records,0);
 assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,0);
 console.log('PASS 6: perfiles separados, segundo perfil también vacío');
 await cd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 assert.equal(typeof await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio offline"})'),'string');
 p=await profiles();assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,1);assert.equal(p.find(x=>x.name==='Segundo usuario').sites,1);
 console.log('PASS 7: edición sin Internet');
 console.log('Chromium/IndexedDB: 7 escenarios correctos, inicio vacío, sin precarga ni Supabase.');
}finally{
 try{await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}catch{}
 try{ws?.close();}catch{} browser?.kill('SIGKILL');server?.kill('SIGKILL');
 try{rmSync(work,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}