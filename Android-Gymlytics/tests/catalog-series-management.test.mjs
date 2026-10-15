import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../web/index.html'),app=read('../web/app.js'),cloud=read('../web/auth-cloud.js'),css=read('../web/styles.css');

test('Catálogos concentra la administración; se retira el panel inicial duplicado',()=>{
 assert.doesNotMatch(html,/<h2>Catálogo de entrenamiento<\/h2>/);
 assert.match(html,/class="gym-mock-header gym-catalog-header"/);
 assert.match(html,/<h1>Catálogos<\/h1>/);
 assert.match(html,/id="catalogCompactRows"/);
 for(const id of ['catalogRefresh','gymCount','siteCount','machineCount','optionCount','exerciseCount','muscleCount'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
test('Cada catálogo editable permite consultar, agregar y modificar',()=>{
 for(const id of ['gym','site','machine','option','exercise']){
  assert.ok(html.includes('id="'+id+'ExistingSelect"'),id);
  assert.ok(html.includes('id="'+id+'EditName"'),id);
  assert.ok(html.includes('data-catalog-modify="'+id+'"'),id);
 }
 assert.match(html,/id="muscleExistingSelect"/);
 assert.match(cloud,/\.from\('tbl_musculos'\)\.select\('id,nombre'\)/);
});
test('Las actualizaciones preservan la cuenta y comprueban exactamente una fila',()=>{
 assert.match(cloud,/async updateCatalogItem\(kind,itemId,newName\)/);
 assert.match(cloud,/\.update\(\{nombre\}\)\.eq\('id',id\)\.eq\('user_id',user_id\)\.select\('id'\)/);
 assert.match(cloud,/data\?\.length!==1/);
 assert.match(cloud,/assertCurrentSession\(user_id,epoch\)/);
});
test('No se crean nombres repetidos en las listas personales',()=>{
 assert.match(cloud,/normalizeCatalogName/);
 assert.match(cloud,/Ese elemento ya existe\. Selecciónalo en la lista desplegable/);
 assert.match(cloud,/Ya existe un ejercicio con ese nombre en tu catálogo/);
});
test('Las series pueden volver a sin subdivisiones, con confirmación si hay datos',()=>{
 assert.match(html,/id="resetSubdivisions"[^>]*hidden/);
 assert.match(app,/resetSubdivisions'\)\.addEventListener\('click',\(\)=>changeSeriesMode\('normal'\)\)/);
 assert.match(app,/hasSeriesData\(\).*confirm\('Cambiar el tipo de subdivisión borrará/);
 assert.match(app,/mode==='normal'\?4:3/);
 assert.match(css,/\.series-reset-division\[hidden\]\{display:none!important\}/);
});
test('Dashboard permanece en una página independiente sin cambios de flujo',()=>{
 assert.match(html,/id="page-dashboard"/);
 assert.match(app,/if\(page==='dashboard'\)drawReports\(\)/);
});
