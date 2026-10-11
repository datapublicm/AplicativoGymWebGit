import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const start=app.indexOf('function showHistoryLoadProgress(loaded,total){');
const end=app.indexOf('const esc=',start);
assert.ok(start>=0&&end>start,'El controlador de progreso debe existir antes de las vistas');
const implementation=app.slice(start,end);
function harness(){
 const fixture=[
  "const bar={value:0,max:100,indeterminate:false,removeAttribute(k){if(k==='value'){this.indeterminate=true;this.value=null;}}};",
  "const elements={historyLoadingStatus:{hidden:true},historyLoadingBar:bar,historyLoadingText:{textContent:''},historyLoadingPercent:{textContent:''}};",
  "const $=id=>elements[id];",
  implementation,
  "({update:showHistoryLoadProgress,state:()=>({hidden:elements.historyLoadingStatus.hidden,value:bar.value,max:bar.max,indeterminate:bar.indeterminate,text:elements.historyLoadingText.textContent,pct:elements.historyLoadingPercent.textContent})});"
 ].join('\n');
 return runInNewContext(fixture);
}
test('Al iniciar carga informa que está consultando el total sin inventar un porcentaje',()=>{
 const h=harness();h.update(0,null);
 const s=h.state();
 assert.equal(s.hidden,false);
 assert.equal(s.value,null);
 assert.equal(s.pct,'');
 assert.match(s.text,/Consultando el total/);
});
test('Con 2.800 de 9.263 series muestra 30% y mantiene el indicador visible',()=>{
 const h=harness();h.update(2800,9263);
 const s=h.state();
 assert.equal(s.hidden,false);
 assert.equal(s.max,9263);
 assert.equal(s.value,2800);
 assert.equal(s.pct,'30%');
 assert.match(s.text,/2.800 de 9.263/);
});
test('Tras la descarga completa muestra el total y se puede ocultar al salir',()=>{
 const h=harness();h.update(9263,9263);
 assert.equal(h.state().pct,'100%');
 h.update(null,null);
 assert.equal(h.state().hidden,true);
});
test('El historial de cero series es una carga terminada legítima',()=>{
 const h=harness();h.update(0,0);
 assert.equal(h.state().pct,'100%');
 assert.match(h.state().text,/Historial vacío/);
});
test('El progreso está disponible en el HTML sin ocupar pantalla mientras está oculto',()=>{
 for(const id of ['historyLoadingStatus','historyLoadingBar','historyLoadingText','historyLoadingPercent'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="historyLoadingStatus"[^>]*hidden/);
 assert.match(css,/\.history-loading\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:760px\)\{\.history-loading\{margin:4px 0 12px/);
});
test('El progreso no borra los datos del usuario ni desbloquea los respaldos hasta terminar',()=>{
 const auth=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
 assert.match(auth,/async loadHistory\(onProgress\)/);
 assert.match(auth,/onProgress\(rows\.length,count\)/);
 assert.match(auth,/assertCurrentSession\(uid,epoch\);\s*for\(const batch/);
 assert.match(auth,/if\(epoch===authEpoch\)\{[\s\S]*?progress\(null,null\)/);
 assert.match(app,/const latest=await window\.GymCloud\.loadHistory\(\(loaded,total\)=>/);
 assert.match(app,/setHistoryReady\(true\)/);
});
