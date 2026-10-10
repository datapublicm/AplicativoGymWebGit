import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function makeHarness(){
  const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('let draftTabs=[]');
  const end=source.indexOf('function hasSeriesData(){',start);
  assert.ok(start>=0&&end>start,'Se encontró el controlador de pestañas');
  const functions=source.slice(start,end);
  const fixture=`
let seriesMode='normal',seriesGroups=4,seriesCustomized=false;
const FLOW=[['g','gimnasio'],['s','sede'],['z','zona'],['kind','tipo'],['i','instrumento'],['a','implemento'],['gr','agarre'],['e','ejercicio'],['t','tecnica']];
const selected={g:'Smart Fit',s:'La Rambla',z:'Brazos',kind:'Implemento libre',i:'Mancuerna',a:'Sin accesorio',gr:'Neutro',e:'Curl bíceps',t:'Base'};
let table=[];
const row=(n)=>({dataset:{serie:'Serie '+n,sub:'-'},values:{unit:'kg',weight:'',reps:'',help:''},
  querySelector(selector){
    const key=selector==='select'?'unit':selector==='.weight'?'weight':selector==='.reps'?'reps':'help';
    const current=this;
    return {get value(){return current.values[key]},set value(v){current.values[key]=v}};
  }
});
const elements={
  seriesRows:{querySelectorAll(){return table}},
  exerciseTabs:{innerHTML:''},
  fecha:{value:'2026-10-10'},
  observaciones:{value:''},
  'page-registro':{classList:{contains(){return false}}}
};
const $=id=>elements[id];
const getValue=key=>selected[key];
const esc=value=>String(value??'');
const dateNow=()=>elements.fecha.value;
function cascade(_,values){Object.assign(selected,values)}
function renderSeries(){table=Array.from({length:seriesGroups},(_,i)=>row(i+1))}
function setMobileStep(){}
function updateSeriesCount(){}
function allCatalog(){return [{...selected,t:[selected.t]}]}
function confirm(){return true}
`;
  return runInNewContext(fixture+functions+`
({resetExerciseTabs,newDraft,openDraft,closeDraft,storeActiveDraft,selected,elements,
  getRows:()=>table,getTabs:()=>draftTabs,getActiveId:()=>activeDraftId})
`);
}
test('Dos ejercicios conservan pesos, repeticiones y notas independientes',()=>{
 const m=makeHarness();m.resetExerciseTabs();
 m.selected.e='Curl bíceps';
 m.getRows()[0].values.weight='12';m.getRows()[0].values.reps='10';
 m.elements.observaciones.value='primera serie';
 const first=m.getActiveId();
 m.newDraft();
 m.selected.e='Curl martillo';
 m.getRows()[0].values.weight='20';m.getRows()[0].values.reps='8';
 m.elements.observaciones.value='segunda serie';
 const second=m.getActiveId();
 m.openDraft(first);
 assert.equal(m.selected.e,'Curl bíceps');
 assert.equal(m.getRows()[0].values.weight,'12');
 assert.equal(m.getRows()[0].values.reps,'10');
 assert.equal(m.elements.observaciones.value,'primera serie');
 m.openDraft(second);
 assert.equal(m.selected.e,'Curl martillo');
 assert.equal(m.getRows()[0].values.weight,'20');
 assert.equal(m.getRows()[0].values.reps,'8');
 assert.equal(m.elements.observaciones.value,'segunda serie');
});
test('Al cerrar una pestaña no se elimina ni modifica la otra',()=>{
 const m=makeHarness();m.resetExerciseTabs();
 const first=m.getActiveId();
 m.getRows()[0].values.weight='15';
 m.newDraft();
 const second=m.getActiveId();
 m.getRows()[0].values.weight='22';
 m.closeDraft(second);
 assert.equal(m.getTabs().length,1);
 assert.equal(m.getActiveId(),first);
 assert.equal(m.getRows()[0].values.weight,'15');
});
