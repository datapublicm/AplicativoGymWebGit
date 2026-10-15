import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const js=readFileSync(new URL('../web/dashboard.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');

function fixture(){
 const window={};
 const document={getElementById:()=>null,querySelectorAll:()=>[]};
 runInNewContext(js,{window,document,Date,Number,Math,Set,Map,String,Array});
 return window.GymDashboard;
}
const d=fixture();
const row=(date,weight,reps,more={})=>({id:date+weight+reps,date,exercise:'Press banca',gym:'Gym',sede:'Centro',
 equipment:'Banco',grip:'Prono',accessory:'Barra',series:'Serie 1',
 subdivision:'Sin subdivisiones',technique:'Controlado (3-5 seg)',unit:'kg',weight,reps,...more});

test('Comparación de mismo peso y más repeticiones indica mejora',()=>{
 assert.equal(d.classify(row('2026-10-02',80,12),row('2026-09-29',80,10)),'mejora');
});
test('Comparación de más peso e iguales repeticiones indica mejora',()=>{
 assert.equal(d.classify(row('2026-10-02',85,10),row('2026-09-29',80,10)),'mejora');
});
test('No se interpreta pérdida de peso con mayor repetición como retroceso',()=>{
 assert.equal(d.classify(row('2026-10-02',75,14),row('2026-09-29',85,9)),'mixto');
});
test('Un cambio de técnica no demuestra retroceso aunque baje peso',()=>{
 assert.equal(d.classify(row('2026-10-02',75,10,{technique:'Controlado (6-7 seg)'}),row('2026-09-29',85,10)),'no-comparable');
});
test('Distinta subdivisión o instrumento no es comparable',()=>{
 assert.equal(d.classify(row('2026-10-02',80,10,{subdivision:'Derecha'}),row('2026-09-29',80,10,{subdivision:'Izquierda'})),'no-comparable');
 assert.equal(d.classify(row('2026-10-02',80,10,{equipment:'Otra máquina'}),row('2026-09-29',80,10)),'no-comparable');
});
test('Serie 1 y Serie 2 no se mezclan, aunque sus pesos coincidan',()=>{
 assert.equal(d.classify(row('2026-10-02',80,10,{series:'Serie 1'}),row('2026-09-29',80,10,{series:'Serie 2'})),'no-comparable');
});
test('Con 4 series nuevas y 3 anteriores, cuarta es no comparable',()=>{
 const a=[1,2,3,4].map(i=>row('2026-10-02',70+i*5,10,{id:'new'+i,series:'Serie '+i}));
 const b=[1,2,3].map(i=>row('2026-09-29',65+i*5,10,{id:'old'+i,series:'Serie '+i}));
 const compared=d.pickPairs([...a,...b]);
 assert.equal(compared.pairs.length,4);
 assert.equal(compared.pairs.filter(p=>p.state==='mejora').length,3);
 assert.equal(compared.pairs.at(-1).state,'no-comparable');
});
test('Distingue técnica y evita clasificar mejora si cambia la ejecución',()=>{
 const x=d.exerciseStatus([row('2026-10-02',70,10,{technique:'Lento (5-7 seg)'}),row('2026-09-29',80,10)]);
 assert.equal(x.state,'sin datos comparables');
 assert.match(x.message,/series equivalentes/i);
});
test('Distinta unidad convertida a kg con tolerancia conserva equivalencia',()=>{
 assert.equal(d.classify(row('2026-10-02',100,10,{unit:'kg'}),row('2026-09-29',220.462262,10,{unit:'lb'})),'mantiene');
});
test('La mejoría por grupo tiene que surgir de series realmente equivalentes',()=>{
 const x=d.exerciseStatus([row('2026-10-02',85,10),row('2026-09-29',80,10)]);
 assert.equal(x.state,'mejora');
 assert.equal(x.pairs.length,1);
});
test('Tabs y filtros reales se encuentran en HTML',()=>{
 for(const id of ['dash-resumen','dash-progreso','dash-analisis','dashGym','dashSede','dashRange',
 'dashTechnique','dashExercise','dashEquipment','dashAccessory','dashSubdivision','dashSeries',
 'dashTrend','dashSeriesChart','dashSeriesTable','dashStates','dashSides','dashTechniqueChanges'])
 assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/src="\.\/dashboard\.js"/);
 assert.match(app,/window\.GymDashboard\?\.render\(rows\)/);
});
test('No presenta puntuaciones de técnica, RPE ni calorías inventadas',()=>{
 assert.doesNotMatch(js,/estimateCalories|techniqueScore|estimatedRPE|RPE\s*[=:]/);
 assert.match(html,/Sin RPE, calorías, puntuaciones de técnica/);
});
test('Los paneles ocultos y el diseño móvil están previstos en CSS',()=>{
 assert.match(css,/\.dash-pane\[hidden\]/);
 assert.match(css,/\.dash-heatmap/);
 assert.match(css,/@media\(max-width:380px\)/);
});
