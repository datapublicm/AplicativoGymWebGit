import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const start=src.indexOf('function validSeriesDecimal(value,limit){');
const end=src.indexOf('function recordHtml(',start);
assert.ok(start>=0&&end>start,'Se encuentra el ciclo completo de guardado');
const saving=src.slice(start,end);

function fixture({delaySave=false,delayHistory=false,failSave=false}={}){
 const code=`
let session='cuenta-A:1',activeDraftId='tabA',resolveSave,resolveHistory,saves=0,loads=0,redraws=0,cleared=0;
const messages=[];
let model={records:[{id:'B-original'}]};
const draftTabs=[{id:'tabA',rows:[{weight:'10'}],notes:'notas A'},{id:'tabB',rows:[{weight:'25'}],notes:'notas B'}];
const elements={fecha:{value:'2026-10-10'},observaciones:{value:'notas A'},
 saveRecords:{disabled:false,textContent:'Guardar series'},
 saveFeedback:{hidden:true,textContent:''}};
const $=id=>elements[id];
const window={GymCloud:{
 canWrite:()=>true,getSessionStamp:()=>session,
 saveWorkout:async()=>{saves++;if(${delaySave})await new Promise(resolve=>resolveSave=resolve);
  if(${failSave})throw Error('Falló red')},
 loadHistory:async()=>{loads++;if(${delayHistory})await new Promise(resolve=>resolveHistory=resolve);
  return [{id:'A-tardía'}]}
}};
const chosenRow=()=>({g:'Pruebas',e:activeDraftId==='tabA'?'Ejercicio A':'Ejercicio B'});
const getValue=()=> 'Base';
const getEntries=()=>[{weight:activeDraftId==='tabA'?'10':'25',reps:'8',assistance:'0',
 series:'Serie 1',sub:'-',unit:'kg'}];
const toast=value=>messages.push(value);
const renderSeries=()=>{cleared++};
const drawRecent=()=>{redraws++},drawHistory=()=>{redraws++},drawReports=()=>{redraws++};
${saving}
({
 save:()=>saveSeries(),changeAccount:()=>{
  session='cuenta-B:2';activeDraftId='tabB';elements.observaciones.value='notas B';
  model.records=[{id:'B-original'}];invalidatePendingSave()
 },
 releaseSave:()=>resolveSave?.(),releaseHistory:()=>resolveHistory?.(),
 state:()=>({saves,loads,redraws,cleared,messages,records:model.records,notes:elements.observaciones.value,
  button:elements.saveRecords,feedback:elements.saveFeedback,tabs:draftTabs})
});
`;
 return runInNewContext(code);
}

test('Un guardado tardío de A no borra borradores ni historial de B',async()=>{
 const h=fixture({delaySave:true}),old=h.save();
 h.changeAccount();h.releaseSave();await old;
 const state=h.state();
 assert.equal(state.records[0].id,'B-original');
 assert.equal(state.tabs[1].rows[0].weight,'25');
 assert.equal(state.notes,'notas B');
 assert.equal(state.loads,0);
 assert.equal(state.cleared,0);
 assert.equal(state.button.disabled,false);
 assert.equal(state.button.textContent,'Guardar series');
});

test('La descarga tardía de A no sobrescribe el historial de B',async()=>{
 const h=fixture({delayHistory:true}),old=h.save();
 await Promise.resolve();
 assert.equal(h.state().loads,1);
 h.changeAccount();h.releaseHistory();await old;
 assert.equal(h.state().records[0].id,'B-original');
 assert.equal(h.state().button.disabled,false);
 assert.equal(h.state().redraws,0);
});

test('El error de una petición antigua no aparece en la nueva sesión',async()=>{
 const h=fixture({delaySave:true,failSave:true}),old=h.save();
 h.changeAccount();h.releaseSave();await old;
 assert.equal(h.state().messages.length,0);
 assert.equal(h.state().button.disabled,false);
});

test('El guardado normal sigue funcionando si permanece la misma sesión',async()=>{
 const h=fixture();
 await h.save();
 assert.equal(h.state().records[0].id,'A-tardía');
 assert.equal(h.state().loads,1);
 assert.equal(h.state().cleared,1);
 assert.equal(h.state().button.disabled,false);
});
