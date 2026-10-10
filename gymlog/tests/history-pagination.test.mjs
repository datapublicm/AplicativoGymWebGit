import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('El historial de 9263 filas se presenta por páginas de 60, no completo',()=>{
  const start=app.indexOf('let historyVisible=60;');
  const end=app.indexOf('async function deleteRecord(id)',start);
  assert.ok(start>=0&&end>start);
  const code=app.slice(start,end);
  const harness=`
const records=Array.from({length:9263},(_,i)=>({id:i,exercise:i<100?'Curl de bíceps':'Curl martillo',gym:'Pruebas',sede:'Centro',zone:'Brazo',equipment:'Mancuerna',technique:'Base'}));
const els={historySearch:{value:''},historyRecords:{innerHTML:''},historyPagination:{hidden:true},historyPageInfo:{textContent:''}};
const $=id=>els[id];
const orderedRecords=()=>records;
const recordHtml=r=>'<article>'+r.id+'</article>';
`;
  const m=runInNewContext(harness+code+`({drawHistory,els,more:()=>{historyVisible+=60},getVisible:()=>historyVisible})`);
  m.drawHistory();
  assert.equal((m.els.historyRecords.innerHTML.match(/<article>/g)||[]).length,60);
  assert.equal(m.els.historyPagination.hidden,false);
  m.more();m.drawHistory();
  assert.equal((m.els.historyRecords.innerHTML.match(/<article>/g)||[]).length,120);
  m.els.historySearch.value='bíceps';m.drawHistory(true);
  assert.equal((m.els.historyRecords.innerHTML.match(/<article>/g)||[]).length,60);
  assert.match(m.els.historyPageInfo.textContent,/100 series/);
});

function workoutHarness({failSave=false,failRefresh=false}={}){
 const start=app.indexOf('async function saveSeries(){'),end=app.indexOf('function recordHtml(',start);
 assert.ok(start>=0&&end>start);
 const code=app.slice(start,end);
 const fixture=`
const messages=[];
let calls=0,cleared=false;
const window={GymCloud:{canWrite:()=>true,
 saveWorkout:async()=>{calls++;if(${failSave})throw Error('falló guardado')},
 loadHistory:async()=>{if(${failRefresh})throw Error('falló descarga');return [{id:1}]}}};
const model={records:[]};
const elements={fecha:{value:'2026-10-10'},observaciones:{value:'nota'},saveRecords:{disabled:false,textContent:'Guardar series'},saveFeedback:{hidden:true,textContent:''}};
const $=id=>elements[id];
const chosenRow=()=>({g:'Pruebas',e:'Curl bíceps',t:['Base']});
const getValue=()=> 'Base';
const getEntries=()=>[{weight:'10',reps:'10',assistance:'0',series:'Serie 1',sub:'-',unit:'kg'}];
const toast=msg=>messages.push(msg);
const renderSeries=()=>{cleared=true};
function drawRecent(){};function drawHistory(){};function drawReports(){};
`;
 return runInNewContext(fixture+code+`({run:saveSeries,messages,values:()=>({calls,cleared,records:model.records,button:elements.saveRecords})})`);
}
test('Guardado confirmado: un error al descargar no induce a duplicar series',async()=>{
 const m=workoutHarness({failRefresh:true});
 await m.run();
 assert.equal(m.values().calls,1);
 assert.equal(m.values().cleared,true);
 assert.ok(m.messages.some(x=>x.includes('GUARDADAS')));
 assert.match(m.values().button.textContent,/Guardar series/);
 assert.equal(m.values().button.disabled,false);
 assert.ok(m.messages.every(x=>!x.startsWith('No se guardó:')));
});
test('Error de guardado real: se mantienen las series sin borrar',async()=>{
 const m=workoutHarness({failSave:true});
 await m.run();
 assert.equal(m.values().calls,1);
 assert.equal(m.values().cleared,false);
 assert.ok(m.messages.some(x=>x.startsWith('No se guardó:')));
 assert.equal(m.values().button.disabled,false);
});
