import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const old=read('../../.github/workflows/compilar-gymlytics-debug.yml');
const next=read('../../.github/workflows/compilar-gymlytics-01.06-pruebas.yml');
const settings=JSON.parse(read('../capacitor.config.json'));
const pkg=JSON.parse(read('../package.json'));

test('01.06 queda preparada solo para disparo manual y nunca por push',()=>{
 assert.match(next,/on:\n  workflow_dispatch:/);
 assert.doesNotMatch(next,/\n  push:/);
 assert.match(next,/refs\/heads\/apk\/pruebas/);
 assert.match(next,/test ! -d android\/app/);
});
test('01.06 se instala en paralelo sin reemplazar ni desinstalar 01.05',()=>{
 assert.equal(settings.appId,'com.datapublicm.gymlytics');
 assert.equal(pkg.version,'0.1.6');
 assert.match(next,/config\.appId='com\.datapublicm\.gymlytics\.pruebas'/);
 assert.match(next,/config\.appName='Gymlytics Pruebas'/);
 assert.match(next,/name='com\.datapublicm\.gymlytics\.pruebas'/);
 assert.match(next,/versionCode 6/);
 assert.match(next,/01\.06/);
 assert.match(next,/Verificar APK y firma digital/);
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
