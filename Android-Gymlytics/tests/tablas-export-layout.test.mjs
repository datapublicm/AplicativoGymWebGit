import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const start=html.indexOf('<section class="page" id="page-tablas">');
const end=html.indexOf('<section class="page" id="page-dashboard">',start);
const tablas=html.slice(start,end);
const at=id=>tablas.indexOf('id="'+id+'"');

test('Tablas: filtros, controles superiores, tabla y exportaciones debajo de paginación',()=>{
 assert.ok(start>=0&&end>start);
 for(const id of ['historyGym','historySubdivision','historyDateFrom','historyDateTo','historyRefresh','historyClearFilters','historyView','historyRecords','historyPagination','exportCsv','exportJson']){
  assert.equal((tablas.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'ID único '+id);
 }
 assert.ok(at('historyGym')<at('historySubdivision'));
 assert.ok(at('historySubdivision')<at('historyDateFrom'));
 assert.ok(at('historyDateTo')<at('historyRefresh'));
 assert.ok(at('historyRefresh')<at('historyClearFilters'));
 assert.ok(at('historyClearFilters')<at('historyView'));
 assert.ok(at('historyView')<at('historyRecords'));
 assert.ok(at('historyRecords')<at('historyPagination'));
 assert.ok(at('historyPagination')<at('exportCsv'));
 assert.ok(at('exportCsv')<at('exportJson'));
 assert.match(tablas,/id="exportCsv"[^>]*disabled>↓ Exportar CSV<\/button>/);
 assert.match(tablas,/id="exportJson"[^>]*disabled>↓ Exportar JSON<\/button>/);
});
test('Subdivisión ocupa una columna y Desde/Hasta comparten la segunda',()=>{
 assert.match(tablas,/class="history-subdivision"[^>]*>Subdivisión/);
 assert.match(tablas,/class="history-dates"[^>]*>[\s\S]*?id="historyDateFrom"[\s\S]*?id="historyDateTo"/);
 const rules=css.slice(css.lastIndexOf('/* GymLytics · Tablas:'));
 assert.match(rules,/#page-tablas \.history-filters\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(rules,/#page-tablas \.history-filters>label\.history-subdivision\{\s*grid-column:auto!important/);
 assert.match(rules,/#page-tablas \.history-dates\{\s*grid-column:auto!important;display:grid!important;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});
test('No se cambian las funciones CSV/JSON ni el respaldo de Perfil',()=>{
 assert.match(app,/function exportCsv\(\)/);
 assert.match(app,/function exportJson\(\)/);
 assert.equal((app.match(/\$\('exportCsv'\)\.addEventListener\('click',exportCsv\)/g)||[]).length,1);
 assert.equal((app.match(/\$\('exportJson'\)\.addEventListener\('click',exportJson\)/g)||[]).length,1);
});
