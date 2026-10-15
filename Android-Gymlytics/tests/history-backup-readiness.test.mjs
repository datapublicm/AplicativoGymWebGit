import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const from=app.indexOf('function setHistoryReady(ready){');
const to=app.indexOf('async function importJson(',from);
assert.ok(from>=0&&to>from,'No se encontró el circuito de exportación y recarga');
const implementation=app.slice(from,to);

function fixture(){
 const code=[
  "let historyReady=false,session='A',signedIn=true,resolveFetch,rejectFetch,requests=0;",
  "const model={records:[{id:'A1',exercise:'Remo',date:'2026-10-10',weight:25.5,reps:6.5,unit:'kg'}],photos:{}};",
  "const elements={exportCsv:{disabled:false,setAttribute(){}},exportJson:{disabled:false,setAttribute(){}},historyRefresh:{disabled:false}};",
  "const $=id=>elements[id];",
  "const notifications=[],downloads=[];",
  "const toast=msg=>notifications.push(msg);",
  "const dateNow=()=> '2026-10-10';",
  "const download=(name,body,mime)=>downloads.push({name,body,mime});",
  "const orderedRecords=()=>model.records;",
  "const drawRecent=()=>{},drawHistory=()=>{},drawReports=()=>{};",
  "const window={GymCloud:{canRead:()=>signedIn,canWrite:()=>signedIn,getSessionStamp:()=>session,loadHistory:()=>{requests++;return new Promise((resolve,reject)=>{resolveFetch=resolve;rejectFetch=reject;})}}};",
  implementation,
  "({init:()=>setHistoryReady(false),allow:()=>setHistoryReady(true),json:()=>exportJson(),csv:()=>exportCsv(),refresh:()=>refreshHistory(),",
  "succeed:records=>resolveFetch(records),fail:()=>rejectFetch(Error('Sin conexión')),",
  "switchAccount:()=>{session='B';setHistoryReady(false);model.records=[{id:'B1'}]},",
  "logout:()=>{signedIn=false;setHistoryReady(false)},",
  "state:()=>({ready:historyReady,disabledCsv:elements.exportCsv.disabled,disabledJson:elements.exportJson.disabled,refreshDisabled:elements.historyRefresh.disabled,ids:model.records.map(r=>r.id),downloads,notifications,requests})});"
 ].join('\n');
 return runInNewContext(code);
}
test('Sin historial descargado, ambos respaldos están bloqueados',()=>{
 const h=fixture();h.init();h.csv();h.json();
 const s=h.state();
 assert.equal(s.ready,false);assert.equal(s.disabledCsv,true);assert.equal(s.disabledJson,true);
 assert.equal(s.downloads.length,0);assert.equal(s.notifications.length,2);
});
test('Con historial completo y sesión propia se exportan CSV y JSON',()=>{
 const h=fixture();h.allow();h.json();h.csv();
 const s=h.state();
 assert.equal(s.disabledCsv,false);assert.equal(s.disabledJson,false);
 assert.equal(s.downloads.length,2);
 assert.equal(JSON.parse(s.downloads[0].body).records[0].id,'A1');
 assert.match(s.downloads[1].body,/Remo/);
});
test('Resincronización bloquea exportación hasta que termina',async()=>{
 const h=fixture();h.allow();const pending=h.refresh();h.json();
 assert.equal(h.state().downloads.length,0);
 assert.equal(h.state().disabledJson,true);
 h.succeed([{id:'A2',weight:27.5,reps:7.5,date:'2026-10-10',exercise:'Remo'}]);
 await pending;h.json();
 assert.equal(h.state().ready,true);
 assert.equal(h.state().refreshDisabled,false);
 assert.equal(JSON.parse(h.state().downloads[0].body).records[0].id,'A2');
});
test('Error de lectura impide respaldo parcial y se puede reintentar',async()=>{
 const h=fixture();h.allow();const pending=h.refresh();h.fail();await pending;
 assert.equal(h.state().ready,false);
 assert.equal(h.state().refreshDisabled,false);
 h.json();assert.equal(h.state().downloads.length,0);
 const retry=h.refresh();h.succeed([{id:'A3'}]);await retry;
 assert.equal(h.state().ready,true);
 assert.equal(h.state().ids[0],'A3');
 assert.equal(h.state().requests,2);
});
test('Respuesta tardía de A no sustituye datos de B ni habilita el respaldo',async()=>{
 const h=fixture();h.allow();
 const pending=h.refresh();h.switchAccount();h.succeed([{id:'A-old'}]);await pending;
 assert.equal(h.state().ready,false);
 assert.equal(h.state().ids[0],'B1');
 assert.equal(h.state().downloads.length,0);
});
test('Sin sesión no se descarga JSON aunque haya datos en memoria',()=>{
 const h=fixture();h.allow();h.logout();h.json();
 assert.equal(h.state().downloads.length,0);
});
test('Botones de copia y actualización inicialmente deshabilitados en el HTML',()=>{
 for(const id of ['historyRefresh','exportCsv','exportJson'])
  assert.match(html,new RegExp('id="'+id+'"[^>]*disabled'));
 assert.match(app,/\$\('historyRefresh'\)\.addEventListener\('click',refreshHistory\)/);
});
