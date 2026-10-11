import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const start=app.indexOf('let historyVisible=60;');
const end=app.indexOf('async function deleteRecord(id)',start);
assert.ok(start>=0&&end>start,'Los filtros ejecutan la función real del historial');
const method=app.slice(start,end);

function fixture(records){
 const input={value:''};
 const elements={
  historySearch:{...input},historyExercise:{...input,innerHTML:''},
  historyDateFrom:{...input},historyDateTo:{...input},
  historyRecords:{innerHTML:''},historyPagination:{hidden:true},
  historyPageInfo:{textContent:''},historyFilterSummary:{textContent:''}
 };
 const source=[
  'const records='+JSON.stringify(records)+';',
  'const elements='+JSON.stringify(elements)+';',
  'const $=id=>elements[id];',
  'const esc=s=>String(s??"").replace(/[&<>"\\x27]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\\x27":"&#39;"}[ch]));',
  'const uniq=values=>[...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));',
  'const orderedRecords=()=>records;',
  'const recordHtml=r=>"<article>"+r.id+"</article>";',
  method,
  '({draw:()=>drawHistory(),filter:(id,value)=>{elements[id].value=value;drawHistory(true)},clear:()=>{resetHistoryFilters();drawHistory(true)},showMore:()=>{historyVisible+=60;drawHistory()},state:()=>({html:elements.historyRecords.innerHTML,page:elements.historyPageInfo.textContent,summary:elements.historyFilterSummary.textContent,hidden:elements.historyPagination.hidden,exercise:elements.historyExercise.value,from:elements.historyDateFrom.value,to:elements.historyDateTo.value,search:elements.historySearch.value})})'
 ].join('\n');
 return runInNewContext(source);
}
const sample=[
 {id:'a',exercise:'Remo',date:'2026-10-09',weight:20,reps:10,unit:'kg',gym:'A'},
 {id:'b',exercise:'Remo',date:'2026-10-10',weight:22.0462262,reps:10,unit:'lb',gym:'A'},
 {id:'c',exercise:'Sentadilla',date:'2026-10-10',weight:40,reps:8,unit:'kg',gym:'B'},
 {id:'d',exercise:'Remo',date:'2026-10-11',weight:30,reps:6,unit:'kg',gym:'A'}
];
test('La tabla presenta series completas con resumen de volumen y fechas',()=>{
 const f=fixture(sample);f.draw();const s=f.state();
 assert.equal((s.html.match(/<article>/g)||[]).length,4);
 assert.match(s.page,/4 de 4 series/);
 assert.match(s.summary,/4 de 4 series/);
 assert.match(s.summary,/3 fechas/);
 assert.match(s.summary,/800 kg × rep\./);
});
test('Filtro por ejercicio conserva únicamente las series de ese ejercicio',()=>{
 const f=fixture(sample);f.draw();f.filter('historyExercise','Remo');
 const s=f.state();assert.equal((s.html.match(/<article>/g)||[]).length,3);
 assert.doesNotMatch(s.html,/<article>c<\/article>/);
 assert.match(s.summary,/3 de 4 series/);
 assert.equal(s.exercise,'Remo');
});
test('Los límites de fecha son inclusivos y combinables con el ejercicio',()=>{
 const f=fixture(sample);f.draw();
 f.filter('historyDateFrom','2026-10-10');f.filter('historyDateTo','2026-10-10');
 f.filter('historyExercise','Remo');
 const s=f.state();
 assert.equal(s.html,'<article>b</article>');
 assert.match(s.summary,/1 de 4 series/);
 assert.match(s.summary,/100 kg × rep\./);
});
test('Rango invertido informa error, no exporta ni presenta registros engañosos',()=>{
 const f=fixture(sample);f.draw();
 f.filter('historyDateFrom','2026-10-11');
 f.filter('historyDateTo','2026-10-09');
 assert.match(f.state().html,/Revisa las fechas/);
 assert.match(f.state().summary,/Rango de fechas incorrecto/);
});
test('Limpiar filtros devuelve la totalidad del historial',()=>{
 const f=fixture(sample);f.draw();
 f.filter('historyDateTo','2026-10-09');f.filter('historyExercise','Remo');
 f.filter('historySearch','A');
 f.clear();
 assert.equal(f.state().from,'');
 assert.equal(f.state().to,'');
 assert.equal(f.state().exercise,'');
 assert.equal(f.state().search,'');
 assert.equal((f.state().html.match(/<article>/g)||[]).length,4);
});
test('Filtrar no cambia la paginación inicial de 60 registros',()=>{
 const records=Array.from({length:125},(_,i)=>({id:String(i),exercise:'Remo',date:'2026-10-10',weight:15,reps:10,unit:'kg'}));
 const f=fixture(records);f.draw();
 assert.equal((f.state().html.match(/<article>/g)||[]).length,60);
 assert.equal(f.state().hidden,false);
 f.showMore();assert.equal((f.state().html.match(/<article>/g)||[]).length,120);
 f.filter('historyDateFrom','2026-10-10');
 assert.equal((f.state().html.match(/<article>/g)||[]).length,60);
});
test('El historial y la vista de progreso están conectados y no alteran el respaldo completo',()=>{
 for(const id of ['historyExercise','historyDateFrom','historyDateTo','historyClearFilters','historyFilterSummary'])
  assert.match(html,new RegExp('id="'+id+'"'),id);
 assert.match(app,/data-progress="\$\{esc\(r.exercise\)\}"/);
 assert.match(app,/const progress=e.target.closest\('\[data-progress\]'\)/);
 assert.match(app,/\$\('progressExercise'\)\.value=exercise/);
 assert.match(app,/orderedRecords\(\)\.map\(r=>fields\.map/);
 assert.match(css,/\.history-filters\{display:grid/);
 assert.match(css,/@media\(max-width:380px\)\{\.history-filters\{grid-template-columns:1fr\}/);
});
