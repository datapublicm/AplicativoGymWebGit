import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const start=app.indexOf('const HISTORY_FIELDS=['),end=app.indexOf('async function deleteRecord(id)',start);
assert.ok(start>=0&&end>start,'La tabla dinámica utiliza la lógica real del historial');
const method=app.slice(start,end);

const fields=['historyGym','historySede','historyZone','historyEquipment','historyExercise',
 'historyAccessory','historyTechnique','historySeries','historySubdivision'];

function fixture(records){
 const elements=Object.fromEntries(fields.map(id=>[id,{value:'',options:[],replaceChildren(...x){this.options=x;this.value=x[0]?.value||'';},add(option){this.options.push(option)}}]));
 Object.assign(elements,{
  historyView:{value:'short'},historyDateFrom:{value:''},historyDateTo:{value:''},
  historyRecords:{innerHTML:''},historyPagination:{hidden:true},historyPageInfo:{textContent:''},
  historyFilterSummary:{textContent:''}
 });
 const code=[
  'const records='+JSON.stringify(records)+';',
  'const elements={};',
  'const keys='+JSON.stringify(fields)+';',
  'for(const id of keys)elements[id]={value:"",options:[],replaceChildren(...x){this.options=x;this.value=x[0]?.value||""},add(option){this.options.push(option)}};',
  'Object.assign(elements,{historyView:{value:"short"},historyDateFrom:{value:""},historyDateTo:{value:""},historyRecords:{innerHTML:""},historyPagination:{hidden:true},historyPageInfo:{textContent:""},historyFilterSummary:{textContent:""}});',
  'const $=id=>elements[id];',
  'const Option=function(text,value){this.text=text;this.value=value};',
  'const esc=s=>String(s??"").replace(/[&<>"\x27]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",\x27"\x27":"&#39;"}[ch]));',
  'const fmtDate=s=>s?.split("-").reverse().join("/")||"—";',
  'const uniq=a=>[...new Set(a)].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"es"));',
  'const orderedRecords=()=>records;',
  method,
  '({draw:()=>drawHistory(),filter:(id,value)=>{elements[id].value=value;drawHistory(true)},view:v=>{elements.historyView.value=v;drawHistory(true)},clear:()=>{resetHistoryFilters();drawHistory(true)},showMore:()=>{historyVisible+=60;drawHistory()},detail:id=>{expandedHistoryId=id;drawHistory()},state:()=>({html:elements.historyRecords.innerHTML,page:elements.historyPageInfo.textContent,summary:elements.historyFilterSummary.textContent,hidden:elements.historyPagination.hidden,exercise:elements.historyExercise.value,from:elements.historyDateFrom.value,to:elements.historyDateTo.value})})'
 ].join('\n');
 return runInNewContext(code);
}
const sample=[
 {id:'a',gym:'A',sede:'Norte',zone:'Espalda',equipment:'Polea',exercise:'Remo',accessory:'Barra',grip:'Prono',technique:'03 - Controlado',series:'Serie 1',subdivision:null,date:'2026-10-09',weight:20,reps:10,unit:'kg'},
 {id:'b',gym:'A',sede:'Sur',zone:'Espalda',equipment:'Polea',exercise:'Remo',accessory:'Barra',grip:'Prono',technique:'03 - Controlado',series:'Serie 2',subdivision:'Derecha',date:'2026-10-10',weight:22.0462262,reps:10,unit:'lb'},
 {id:'c',gym:'B',sede:'Centro',zone:'Piernas',equipment:'Máquina',exercise:'Sentadilla',accessory:'',grip:'',technique:'01 - Base',series:'Serie 1',subdivision:null,date:'2026-10-10',weight:40,reps:8,unit:'kg'},
 {id:'d',gym:'A',sede:'Norte',zone:'Espalda',equipment:'Polea',exercise:'Remo',accessory:'Barra',grip:'Prono',technique:'03 - Controlado',series:'Serie 3',subdivision:'Izquierda',date:'2026-10-11',weight:30,reps:6,unit:'kg'}
];
test('Versión corta: cinco columnas y todos los registros sin filtros',()=>{
 const f=fixture(sample);f.draw();const s=f.state();
 assert.equal((s.html.match(/data-history-row=/g)||[]).length,4);
 for(const h of ['Fecha','Número de serie','Subdivisión','Peso','Repeticiones'])assert.ok(s.html.includes('<th scope="col">'+h+'</th>'));
 assert.doesNotMatch(s.html,/<th scope="col">Gimnasio</);
 assert.match(s.summary,/4 de 4 series/);
 assert.match(s.summary,/3 fechas/);
 assert.match(s.summary,/800 kg × rep\./);
});
test('Versión extensa contiene doce columnas y oculta exclusivamente las ya filtradas',()=>{
 const f=fixture(sample);f.draw();f.view('extended');
 assert.equal((f.state().html.match(/<th scope="col">/g)||[]).length,12);
 f.filter('historyGym','A');
 assert.doesNotMatch(f.state().html,/<th scope="col">Gimnasio</);
 assert.match(f.state().html,/<th scope="col">Sede</);
 assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,3);
 f.filter('historySede','Norte');
 assert.doesNotMatch(f.state().html,/<th scope="col">Sede</);
 assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,2);
 assert.match(f.state().summary,/2 de 4 series/);
});
test('Los nueve filtros son combinables y las fechas inclusivas',()=>{
 const f=fixture(sample);f.draw();f.view('extended');
 f.filter('historyGym','A');f.filter('historyExercise','Remo');
 f.filter('historyDateFrom','2026-10-10');f.filter('historyDateTo','2026-10-10');
 assert.match(f.state().html,/data-history-row="b"/);
 assert.doesNotMatch(f.state().html,/data-history-row="a"/);
 assert.match(f.state().summary,/100 kg × rep\./);
 f.filter('historySubdivision','Derecha');
 assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,1);
});
test('La tabla corta mantiene sus cinco columnas aunque se elijan filtros',()=>{
 const f=fixture(sample);f.draw();f.filter('historyGym','A');
 assert.equal((f.state().html.match(/<th scope="col">/g)||[]).length,5);
});
test('Rango inverso muestra error; limpiar devuelve todos los datos',()=>{
 const f=fixture(sample);f.draw();f.filter('historyDateFrom','2026-10-11');
 f.filter('historyDateTo','2026-10-09');assert.match(f.state().html,/Revisa las fechas/);
 f.clear();assert.equal(f.state().from,'');assert.equal(f.state().to,'');
 assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,4);
});
test('Se muestran 60 series, con paginación ampliable y reinicio por filtro',()=>{
 const all=Array.from({length:125},(_,i)=>({...sample[0],id:String(i)}));
 const f=fixture(all);f.draw();assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,60);
 assert.equal(f.state().hidden,false);
 f.showMore();assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,120);
 f.filter('historyGym','A');assert.equal((f.state().html.match(/data-history-row=/g)||[]).length,60);
});
test('Las acciones de eliminación y progreso se conservan al expandir una fila',()=>{
 const f=fixture(sample);f.draw();f.detail('a');
 assert.match(f.state().html,/data-delete="a"/);
 assert.match(f.state().html,/data-progress="Remo"/);
 assert.match(app,/data-progress="\$\{esc\(r.exercise\)\}"/);
 assert.match(app,/orderedRecords\(\)\.map\(r=>fields\.map/);
});
test('La interfaz ofrece nueve filtros y tablas responsivas',()=>{
 for(const id of [...fields,'historyDateFrom','historyDateTo','historyView','historyClearFilters'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(css,/\.history-table-scroll\{width:100%/);
 assert.match(css,/@media\(max-width:380px\)\{\.history-filters\{grid-template-columns:1fr\}/);
});
