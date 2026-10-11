import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const start=app.indexOf('function drawProgressChart(records){'),end=app.indexOf('function download(name,content,mime)',start);
assert.ok(start>=0&&end>start,'El gráfico utiliza el código real de Gymlytics');
const draw=app.slice(start,end);
function fixture(records=[]){
 const code=[
 "const records="+JSON.stringify(records)+";",
 "const elements={progressChart:{innerHTML:''},progressSummary:{textContent:''},progressExercise:{value:'',disabled:false,options:[],replaceChildren(...opts){this.options=opts}},progressMetric:{value:'weight',disabled:false}};",
 "const $=id=>elements[id];",
 "const Option=function(text,value){this.text=text;this.value=value};",
 "const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');",
 draw,
 "({draw:()=>drawProgressChart(records),metric:m=>{elements.progressMetric.value=m;drawProgressChart(records)},state:()=>({svg:elements.progressChart.innerHTML,summary:elements.progressSummary.textContent,selected:elements.progressExercise.value,exercises:elements.progressExercise.options,disabled:elements.progressMetric.disabled})});"
 ].join('\n');
 return runInNewContext(code);
}
const sample=[
 {exercise:'Remo',date:'2026-10-09',weight:5,reps:12,unit:'kg'},
 {exercise:'Remo',date:'2026-10-10',weight:10,reps:8,unit:'kg'},
 {exercise:'Remo',date:'2026-10-10',weight:22.0462262,reps:10,unit:'lb'}
];
test('Muestra gráfica SVG de progreso real por fecha sin librerías externas',()=>{
 const h=fixture(sample);h.draw();const state=h.state();
 assert.match(state.svg,/<svg/);
 assert.match(state.svg,/<polyline/);
 assert.match(state.svg,/09\/10/);
 assert.match(state.svg,/10\/10/);
 assert.match(state.summary,/2 fechas/);
 assert.match(state.summary,/10 kg/);
});
test('Repeticiones y cantidad de series se agregan correctamente por fecha',()=>{
 const h=fixture(sample);h.draw();h.metric('reps');
 assert.match(h.state().summary,/18 rep\./);
 h.metric('series');assert.match(h.state().summary,/2 series/);
});
test('Convierte peso y volumen desde libras a kilogramos sin mezclar unidades',()=>{
 const h=fixture(sample);h.draw();h.metric('volume');
 assert.match(h.state().summary,/180 kg × rep\./);
});
test('El selector de ejercicio cambia según lo cargado',()=>{
 const h=fixture([...sample,{exercise:'Sentadilla',date:'2026-10-10',weight:70,reps:8,unit:'kg'}]);
 h.draw();assert.equal(h.state().exercises.length,2);
 assert.equal(h.state().selected,'Remo');
 assert.equal(h.state().exercises[1].value,'Sentadilla');
});
test('Solo muestra diez fechas recientes para mantener legible el gráfico',()=>{
 const dates=Array.from({length:14},(_,i)=>({exercise:'Remo',date:'2026-09-'+String(i+1).padStart(2,'0'),weight:5+i,reps:8,unit:'kg'}));
 const h=fixture(dates);h.draw();
 assert.match(h.state().summary,/10 fechas/);
 assert.doesNotMatch(h.state().svg,/>01\/09</);
 assert.match(h.state().svg,/>14\/09</);
});
test('Sin datos muestra estado vacío sin inventar estadísticas',()=>{
 const h=fixture();h.draw();assert.match(h.state().svg,/No hay entrenamientos/);
 assert.equal(h.state().disabled,true);
});
test('No inyecta etiquetas HTML dentro del texto del gráfico',()=>{
 const h=fixture([{exercise:'<img src=x onerror=alert(1)>',date:'2026-10-10',weight:10,reps:8,unit:'kg'}]);
 h.draw();assert.doesNotMatch(h.state().svg,/<img/);
 assert.match(h.state().svg,/&lt;img/);
});
test('El HTML ofrece filtros reales y el CSS contempla márgenes de Android y controles de 320 px',()=>{
 for(const id of ['progressChart','progressMetric','progressExercise','progressSummary'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/\$\('progressExercise'\)\.addEventListener\('change'/);
 assert.match(app,/\$\('progressMetric'\)\.addEventListener\('change'/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/@media\(max-width:400px\)/);
 assert.match(css,/\.history-tools\{grid-template-columns:1fr\}/);
 assert.match(css,/\.progress-filters\{grid-template-columns:1fr\}/);
});

test('Las acciones de recuperación respetan el ancho en móviles de 320 px',()=>{
 assert.match(css,/\.catalog-main-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:380px\)\{\s*\.catalog-main-actions\{grid-template-columns:1fr\}/);
 assert.match(css,/\.catalog-main-actions button\{min-width:0/);
 assert.match(html,/id="catalogRefresh"[^>]*disabled/);
});
test('El cuadro de detalle y la barra inferior respetan los márgenes físicos del dispositivo',()=>{
 assert.match(css,/\.detail-modal\{width:calc\(100vw - max\(12px,env\(safe-area-inset-left/);
 assert.match(css,/max-height:calc\(100dvh - env\(safe-area-inset-top/);
 assert.match(css,/\.bottom-nav\{padding-left:env\(safe-area-inset-left/);
 assert.match(css,/\.content\{width:100%;max-width:100%;padding-left:max\(12px,env\(safe-area-inset-left/);
});

test('Cabecera de series permite que Editar ejercicio salte de línea sin desbordar 390 px',()=>{
 assert.match(css,/@media\(max-width:760px\)\{\s*\.series-head\{flex-wrap:wrap/);
 assert.match(css,/\.series-head>div\{flex:1 1 155px;min-width:0\}/);
 assert.match(css,/\.series-head \.series-back\{max-width:100%;white-space:normal/);
});
test('La CI comprueba la interfaz real en Chrome y no compila Android',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/validar-android-gymlytics.yml',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../tools/verificar-layout-mobile.mjs',import.meta.url),'utf8');
 assert.match(workflow,/run: node tools\/verificar-layout-mobile\.mjs/);
 assert.match(browser,/for\(const width of \[320,360,390,412\]\)/);
 assert.match(browser,/Page\.captureScreenshot/);
 assert.doesNotMatch(workflow,/assembleDebug|gradlew|npx cap|npm run build:web/);
});
