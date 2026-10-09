import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir=new URL('../',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,dir),'utf8');
const html=read('web/index.html'),app=read('web/app.js'),auth=read('web/auth-cloud.js');
const schema='sch_android_gymlog';
test('Cinco pestañas del proyecto',()=>{
 for(const page of ['sesion','catalogos','registro','tablas','dashboard']){
  assert.match(html,new RegExp('id="page-'+page+'"'));
  assert.match(html,new RegExp('data-page="'+page+'"'));
 }
});
test('Visor anatómico con dos formatos y marcadores vacíos',()=>{
 for(const id of ['anatomyPhotosTab','anatomy3dTab','anatomyCloudState','anatomy3dPlaceholder','anatomyPrimary','anatomySecondary'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
test('Las tablas y bucket privados de GymLog están referenciados',()=>{
 for(const table of ['tbl_usuarios','tbl_reportes','tbl_series','tbl_ejercicio_musculos','tbl_musculos','tbl_musculo_imagenes','tbl_musculo_zonas3d','tbl_fotos'])
  assert.ok(auth.includes(table),table);
 assert.ok(auth.includes('gymlog-usuarios'));
 assert.ok(auth.includes('gymlog-anatomia'));
 assert.ok(auth.includes('guardar_entrenamiento'));
 assert.ok(read('.env.example').includes(schema));
});
test('La navegación se bloquea sin sesión; catálogo personal presente',()=>{
 assert.ok(auth.includes('assertGymLogAccess'));
 assert.ok(auth.includes('signedIn'));
 assert.ok(html.includes('id="catalogForm"'));
 assert.ok(app.includes('allCatalog()'));
});
test('Estructura Android preparada, sin binarios generados',()=>{
 const config=JSON.parse(read('capacitor.config.json'));
 assert.equal(config.appName,'GymLog');assert.equal(config.appId,'com.datapublicm.gymlog');
 assert.ok(!fs.existsSync(new URL('android/app/',dir)));
 assert.ok(!fs.existsSync(new URL('dist/',dir)));
 assert.ok(!fs.existsSync(new URL('node_modules/',dir)));
});
test('No se adjuntan claves administrativas al código cliente',()=>{
 assert.doesNotMatch(auth,/sb_secret_[A-Za-z0-9]+/);
 assert.doesNotMatch(auth,/eyJ[A-Za-z0-9._-]{70,}/);
});
