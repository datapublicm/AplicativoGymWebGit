import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const real=get('../tools/validar-data-api.mjs');
const publicCheck=get('../tools/verificar-salud-supabase.mjs');

test('La verificación real solo acepta la URL exacta y el esquema de ProyectosPrueba',()=>{
 assert.match(real,/const project='jasuqnxrskhqfobsazwd'/);
 assert.match(real,/const schema='sch_android_gymlytics'/);
 assert.match(real,/if\(host!==endpoint\)throw Error/);
 assert.match(real,/VITE_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(real,/sb_secret_/);
});
test('La key y Auth deben superar health 200 antes de interpretar el rechazo de RLS',()=>{
 const healthPos=real.indexOf("const health=await request('/auth/v1/health')");
 const anonPos=real.indexOf("const anon=await request('/rest/v1/tbl_usuarios");
 assert.ok(healthPos>0&&anonPos>healthPos);
 assert.ok(real.includes('if(health.status!==200'));
 assert.ok(real.includes("if(![200,401,403].includes(anon.status))"));
});
test('Health anónimo solo acredita respuesta del gateway, no autenticación funcional',()=>{
 assert.match(publicCheck,/response\.status===401\|\|response\.status===403/);
 assert.match(publicCheck,/no se confirma salud de Auth ni inicio de sesión/);
 assert.match(publicCheck,/\/auth\/v1\/health/);
});
