// Verifica el HTML y CSS reales en Chrome móvil, sin compilar APK.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../web');
const work=mkdtempSync(join(tmpdir(),'gym-layout-'));
const chrome=process.env.CHROME_BIN||['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(n=>(process.env.PATH||'').split(':').some(p=>existsSync(join(p,n))));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const pending=new Map();let browser,server,ws,id=0,chromeStderr='';
function request(method,params={}){
 return new Promise((ok,fail)=>{
  const n=++id;
  const clock=setTimeout(()=>{pending.delete(n);fail(Error('Chrome tardó: '+method))},12000);
  pending.set(n,{ok:v=>{clearTimeout(clock);ok(v)},fail:e=>{clearTimeout(clock);fail(e)}});
  ws.send(JSON.stringify({id:n,method,params}));
 });
}
async function check(width,page){
 const names={
  sesion:['#page-sesion .auth-panel'],
  catalogos:['#page-catalogos .catalog-compact-card','#page-catalogos .catalog-main-actions','#catalogRefresh','#gymExistingSelect','#exerciseExistingSelect'],
  registro:['#page-registro .exercise-tabs-wrap','#page-registro .context-panel','#continueToSeries'],
  'registro-series':['#page-registro .series-panel','#page-registro .table-scroll','#saveRecords'],
  tablas:['#page-tablas .history-tools','#historyGym','#historyRefresh','#exportCsv','#historyView'],
  dashboard:['#page-dashboard .progress-panel','#page-dashboard .progress-filters','#progressExercise','#progressMetric','#progressChart']
 };
 const js='(()=>{'+
 'const page='+JSON.stringify(page)+';'+
 'document.body.classList.remove("auth-locked");'+
 'document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+(page==="registro-series"?"registro":page)));'+
 'const reg=document.getElementById("page-registro");reg.classList.toggle("step-context",page==="registro");reg.classList.toggle("step-series",page==="registro-series");'+
 'if(typeof drawReports==="function"){model.records=Array.from({length:24},(_,i)=>({id:"demo-"+i,exercise:"Remo",date:"2026-10-"+String(i%15+1).padStart(2,"0"),weight:20+i,reps:8,unit:"kg"}));drawReports();}'+
 'const selectors='+JSON.stringify(names[page])+';'+
 'const positions=selectors.map(selector=>{const el=document.querySelector(selector);if(!el)return{selector,missing:true};const r=el.getBoundingClientRect();return{selector,left:r.left,right:r.right,width:r.width,visible:getComputedStyle(el).display!=="none"&&r.width>0}});'+
 'const r=document.querySelector(".bottom-nav").getBoundingClientRect();'+
 'const over=[...document.querySelectorAll("body *")].filter(el=>{const s=getComputedStyle(el);if(s.display==="none"||s.position==="fixed")return false;const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+.5||r.left<-.5)}).slice(0,15).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,65),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width}));'+
 'return JSON.stringify({screen:innerWidth,visual:visualViewport.width,documentWidth:document.documentElement.scrollWidth,positions,over,nav:{left:r.left,right:r.right},chart:!!document.querySelector("#progressChart svg"),summary:document.getElementById("progressSummary").textContent});'+
 '})()';
 const result=await request('Runtime.evaluate',{expression:js,returnByValue:true});
 if(result.exceptionDetails)throw Error('Error al evaluar página: '+JSON.stringify(result.exceptionDetails).slice(0,400));
 const d=JSON.parse(result.result.value);
 if(d.screen!==width||d.documentWidth>width+1)console.log('MOBILE_LAYOUT_DEBUG',width,page,JSON.stringify(d));
 assert.equal(d.screen,width,'Chrome no aplicó la anchura solicitada');
 assert.ok(d.documentWidth<=width+1, width+'px '+page+': documento desbordado '+d.documentWidth+'px');
 for(const r of d.positions){
  assert.ok(!r.missing,'Falta elemento '+r.selector);
  if(r.visible)assert.ok(r.left>=-1&&r.right<=width+1,width+'px '+page+': desborda '+r.selector+' ('+r.left+', '+r.right+')');
 }
 assert.ok(d.nav.left>=-1&&d.nav.right<=width+1,'Barra inferior fuera de pantalla');
 if(page==='dashboard'){
  assert.ok(d.chart,'Gráfico de compatibilidad no renderizado');assert.match(d.summary,/Último valor/);
  for(const [tab,chart] of [['resumen','#dashWeekly svg'],['progreso','#dashTrend svg'],['analisis','#dashStates svg']]){
   const expr='(()=>{const button=document.querySelector(\'[data-dash-tab="'+tab+'"]\');button.click();const panel=document.getElementById("dash-'+tab+'");return JSON.stringify({visible:!panel.hidden,svg:!!document.querySelector("'+chart+'"),chosen:button.getAttribute("aria-selected")});})()';
   const result=await request('Runtime.evaluate',{expression:expr,returnByValue:true});
   if(result.exceptionDetails)throw Error('Falló la interacción del Dashboard: '+JSON.stringify(result.exceptionDetails));
   const state=JSON.parse(result.result.value);
   assert.ok(state.visible&&state.svg&&state.chosen==='true',width+'px: la pestaña '+tab+' no funciona: '+JSON.stringify(state));
   if(width===390){
    const path=resolve(root,'../mobile-check');mkdirSync(path,{recursive:true});
    const shot=await request('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(path,'gymlytics-dashboard-'+tab+'-390.png'),Buffer.from(shot.data,'base64'));
   }
  }
 }
 console.log('OK',width,page,'documento',d.documentWidth);
 if((width===320&&page==='dashboard')||(width===390&&['registro-series','catalogos','tablas'].includes(page))){
  const path=resolve(root,'../mobile-check');mkdirSync(path,{recursive:true});
  const shot=await request('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(join(path,'gymlytics-'+page+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
}
try{
 assert.ok(chrome,'No hay Google Chrome o Chromium preinstalado');
 server=createServer((req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const file=resolve(root,'.'+name);
   if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
   const bytes=readFileSync(file);
   const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+work,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.on('error',e=>{chromeStderr+='\n'+e.message});
 browser.stderr?.on('data',chunk=>{chromeStderr+=String(chunk).slice(-2000)});
 console.log('Chrome binario:',chrome);
 let port;
 for(let i=0;i<100;i++){try{port=Number(readFileSync(join(work,'DevToolsActivePort'),'utf8').split('\n')[0]);break}catch{await delay(100)}}
 assert.ok(port,'Chrome no inició DevTools; exit='+browser.exitCode+'; stderr='+chromeStderr.slice(-2500));
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});
 ws.addEventListener('message',ev=>{
  const r=JSON.parse(ev.data),p=pending.get(r.id);if(!p)return;
  pending.delete(r.id);if(r.error)p.fail(Error(r.error.message));else p.ok(r.result);
 });
 await request('Page.enable');await request('Runtime.enable');
 const url='http://127.0.0.1:'+server.address().port+'/index.html';
 for(const width of [320,360,390,412]){
  await request('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:780});
  const nav=await request('Page.navigate',{url});
  if(nav.errorText)throw Error('No se pudo abrir la app: '+nav.errorText);
  let loaded=false;
  for(let i=0;i<40;i++){
   const r=await request('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
   if(r.result?.value==='complete'){loaded=true;break}await delay(100);
  }
  assert.ok(loaded,'El navegador no terminó de cargar');
  await delay(180);
  for(const name of ['sesion','catalogos','registro','registro-series','tablas','dashboard'])await check(width,name);
 }
 console.log('24 escenarios de navegador realizados, sin APK.');
}finally{
 try{ws?.close()}catch{}browser?.kill('SIGKILL');server?.close();
 rmSync(work,{recursive:true,force:true,maxRetries:15,retryDelay:150});
}
