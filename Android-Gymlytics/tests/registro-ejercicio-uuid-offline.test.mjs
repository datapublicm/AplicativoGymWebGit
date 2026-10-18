import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=n=>readFileSync(new URL('../web/'+n,import.meta.url),'utf8');
test('Ejercicio homónimo conserva UUID en Registro y perfil local',()=>{
 assert.match(f('app.js'),/if\(variants\.length>1&&!library\)return null/);
 assert.match(f('app.js'),/exerciseId:library\?\.id\|\|null/);
 assert.match(f('offline-first.js'),/exerciseId:exercise\.exerciseId\|\|null/);
 assert.match(f('index.html'),/id="registroVariante"/);
});
test('Modo alternativo Agrupación y Anotación',()=>{
 const t=f('catalog-offline-enhancements.js');
 assert.match(t,/detail\(e,'Agrupación'\)/);assert.match(t,/detail\(e,'Anotación'\)/);
 assert.match(t,/window\.GymSelectedExerciseId=variant\.value\|\|null/);
});
