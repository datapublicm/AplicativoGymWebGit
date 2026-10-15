import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=file('../web/index.html'),css=file('../web/styles.css'),app=file('../web/app.js');
const vite=file('../vite.config.js'),sw=file('../web/sw.js');
test('Catálogos utiliza la cabecera GYMLYTICS y las nueve filas del diseño aprobado',()=>{
 assert.match(html,/id="page-catalogos"><header class="gym-mock-header gym-catalog-header"/);
 assert.match(html,/id="catalogCompactRows"/);
 for(const kind of ['gym','site','zone','machine','exercise','grip','technique','series','subdivision'])
  assert.match(app,new RegExp("kind:'"+kind+"'"),kind);
 for(const id of ['catalogSearchToggle','catalogMenuToggle','catalogQuickPanel','catalogQuickFeedback'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
test('Registro incluye fecha, pestañas paralelas y tabla en el mismo flujo visual',()=>{
 assert.match(html,/id="page-registro"><header class="gym-mock-header gym-reg-header"/);
 for(const id of ['recordDateDisplay','fecha','exerciseTabs','addExerciseTab','registroModoSubdivision',
  'registroNumeroSerie','seriesRows','addSeriesGroup','clearSeries','saveRecords'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/function resetExerciseTabs/);
 assert.match(app,/function openDraft/);
 assert.match(app,/function saveSeries/);
});
test('La tipografía de los controles móviles no queda reducida a 8 píxeles',()=>{
 assert.match(css,/#page-registro \.registro-field-grid label>span\{font-size:12px!important/);
 assert.match(css,/#page-registro \.registro-field-grid \.field>select,[\s\S]*?min-height:43px!important/);
 assert.match(css,/#page-catalogos \.catalog-compact-label\{font-size:12px!important/);
 assert.match(css,/#page-catalogos \.catalog-compact-bar\{min-height:54px!important/);
 assert.doesNotMatch(css,/Ajuste final de densidad: Registro debe mostrar tabla y acciones cuanto antes/);
});
test('La compilación web verifica que empaquete los archivos reales del mockup',()=>{
 for(const id of ['gym-mock-header','mockup-catalog','catalogCompactRows','registro-compact-panel','exerciseTabs','seriesRows'])
  assert.ok(vite.includes("'"+id+"'"),id);
 assert.match(vite,/source\.equals\(output\)/);
 assert.match(vite,/throw Error\('El APK empaquetaría una versión antigua/);
 assert.match(sw,/catalogos-registro-funcional-20261015-v03/);
});
test('Se mantienen Tablas y Dashboard independientes, sin cambiar su vista',()=>{
 assert.match(html,/id="page-tablas"/);
 assert.match(html,/id="page-dashboard"/);
 assert.match(html,/id="dash-resumen"/);
});
