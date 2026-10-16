import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const old=read('../../.github/workflows/compilar-gymlytics-debug.yml');
const next=read('../../.github/workflows/compilar-gymlytics-01.06-pruebas.yml');
const settings=JSON.parse(read('../capacitor.config.json'));
const pkg=JSON.parse(read('../package.json'));

test('01.06 solo admite ejecución manual o cambio explícito de su propio workflow',()=>{
 assert.match(next,/on:\n  workflow_dispatch:/);
 assert.match(next,/\n  push:\n    branches:\n      - apk\/pruebas\n    paths:\n      - '\.github\/workflows\/compilar-gymlytics-01\.06-pruebas\.yml'/);
 assert.match(next,/refs\/heads\/apk\/pruebas/);
 assert.match(next,/test ! -d android\/app/);
});
test('01.06 corregida se instala en paralelo sin reemplazar 01.05 ni 01.06 previa',()=>{
 assert.equal(settings.appId,'com.datapublicm.gymlytics');
 assert.equal(pkg.version,'0.1.6');
 assert.match(next,/config\.appId='com\.datapublicm\.gymlytics\.pruebas\.corregida'/);
 assert.match(next,/config\.appName='Gymlytics Corregida'/);
 assert.match(next,/name='com\.datapublicm\.gymlytics\.pruebas\.corregida'/);
 assert.match(next,/versionCode 6/);
 assert.match(next,/01\.06/);
 assert.match(next,/Verificar APK y firma digital/);
 assert.match(next,/getWriteStatus:writeStatus/);
 assert.match(next,/Gymlytics_01\.06_Pruebas_Corregida\.apk/);
});
test('La preparación nueva no sustituye el workflow o versión 01.05',()=>{
 assert.match(old,/0\.1\.5/);
 assert.match(old,/versionCode 5/);
 assert.match(old,/name='com\.datapublicm\.gymlytics'/);
 assert.doesNotMatch(old,/com\.datapublicm\.gymlytics\.pruebas/);
});
test('01.06 verifica previamente integridad offline antes de generar plataforma Android',()=>{
 assert.ok(next.indexOf('Verificar integridad web e IndexedDB')<next.indexOf('Crear plataforma Android temporal'));
 assert.match(next,/node tools\/verificar-integridad-offline\.mjs/);
 assert.match(next,/test -s android\/app\/src\/main\/assets\/public\/offline-first\.js/);
 assert.match(next,/test -s android\/app\/src\/main\/assets\/public\/legacy-compat\.js/);
});
