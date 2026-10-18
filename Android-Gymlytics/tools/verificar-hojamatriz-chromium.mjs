/** GymLytics 01.08: integración IndexedDB real en Chromium sin compilar APK ni Vite build. */
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
 assert.equal(p.length,1,'Primer inicio debe crear únicamente Prueba');
 assert.deepEqual(p[0]&&[p[0].name,p[0].records,p[0].gyms,p[0].sites,p[0].exercises,p[0].sessions,p[0].absentUnits,p[0].pending,p[0].cloudUserId],
  ['Prueba',9424,3,16,146,446,9424,0,null]);
 assert.equal(await evaluate('document.querySelector("#offlineCloudUpload")?.disabled'),true,'La cuenta de prueba nunca sube a Supabase');
 console.log('PASS 1: perfil demo inicial, relaciones y 9424 series, sin nube');
 const payload={exercise:{g:'Evolution',s:'VES',z:'Piernas',kind:'Otro',i:'Máquina Hack',a:'No especificado',gr:'No especificado',e:'Sentadilla Hack',exerciseId:'seed-test'},date:'2026-10-18',technique:'Prueba local',notes:'Solo IndexedDB',entries:[{series:'Serie 1',sub:'-',unit:'kg',weight:20,reps:12,assistance:0}]};
 assert.equal(await evaluate('window.GymCloud.saveWorkout('+JSON.stringify(payload)+')'),1);
 p=await profiles();assert.equal(p[0].records,9425);assert.equal(p[0].pending,1);
 console.log('PASS 2: escritura offline en Prueba, sin modificar los 9424 históricos');
 await navigate();p=await profiles();assert.equal(p.length,1);assert.equal(p[0].records,9425);assert.equal(p[0].pending,1);
 console.log('PASS 3: reinstancia la interfaz sin duplicar semilla ni registros');
 await evaluate(`(()=>{document.querySelector('#offlineNewName').value='Segundo usuario';document.querySelector('#offlineCreate').click();return true})()`);
 await until('document.querySelector("#offlineProfiles").options.length===2','perfil independiente');
 p=await profiles();assert.equal(p.find(x=>x.name==='Prueba').records,9425);assert.equal(p.find(x=>x.name==='Segundo usuario').records,0);
 const second=await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio personal"})');
 p=await profiles();assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,1);assert.equal(p.find(x=>x.name==='Segundo usuario').sites,1);
 console.log('PASS 4: perfiles aislados y gimnasio con sede Única local');
 await cd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 assert.equal(await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio sin Internet"})')!==undefined,true);
 p=await profiles();assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,2);assert.equal(p.find(x=>x.name==='Segundo usuario').sites,2);
 console.log('PASS 5: escritura IndexedDB con red desconectada');
 console.log('Chromium + IndexedDB: 5 escenarios reales correctos, sin compilar y sin Supabase.');
}finally{
 try{await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}catch{}
 try{ws?.close();}catch{} browser?.kill('SIGKILL');server?.kill('SIGKILL');
 try{rmSync(work,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}