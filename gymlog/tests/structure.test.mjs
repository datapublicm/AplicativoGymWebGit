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
 for(const table of ['tbl_usuarios','vw_historial_series','tbl_ejercicio_musculos','tbl_musculos','tbl_musculo_imagenes','tbl_musculo_zonas3d','tbl_fotos'])
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
 assert.doesNotMatch(auth,/\bsb_secret_[A-Za-z0-9]+\b/);
 assert.doesNotMatch(auth,/\beyJ[A-Za-z0-9._-]{70,}\b/);
});


test('01.04: pestañas por ejercicio con borradores separados',()=>{
 for(const id of ['exerciseTabs','addExerciseTab'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const operation of ['storeActiveDraft','openDraft','newDraft','closeDraft','snapshotExerciseRows'])assert.ok(app.includes('function '+operation+'('),operation);
 for(const field of ['weight','reps','help','seriesMode','seriesGroups'])assert.ok(app.includes(field),field);
});
test('01.04: formularios independientes y máquina existente',()=>{
 for(const id of ['addGymForm','addSiteForm','addMachineForm','exerciseMachineSelect'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(auth.includes("async addIndependentItem("));
 assert.ok(auth.includes("maquina_id"));
 assert.ok(auth.includes('Primero registra la máquina'));
 assert.ok(app.includes('function renderExerciseMachineOptions()'));
});
test('01.04: catálogo descargado tras login, nunca embebido en la APK',()=>{
 assert.doesNotMatch(html,/catalogo\.js/);
 assert.doesNotMatch(read('vite.config.js'),/['"]catalogo\.js['"]/);
 assert.doesNotMatch(read('web/sw.js'),/['"]\.\/catalogo\.js['"]/);
 assert.match(app,/const base=window\.GymBaseCatalog\|\|\[\]/);
 assert.ok(auth.includes('cloud.loadInitialCatalog()'));
 assert.ok(auth.includes('cloud.loadOwnCatalog()'));
});
test('01.04: safe areas y CSS de pestañas',()=>{
 const css=read('web/styles.css');
 assert.ok(css.includes('safe-area-inset-top'));
 assert.ok(css.includes('safe-area-inset-bottom'));
 assert.ok(css.includes('.exercise-tabs-wrap'));
});


test('01.04 revisión 03: sesión sin cargas dobles ni redirecciones en refresh',()=>{
 assert.ok(auth.includes("pendingAuthPromise&&pendingAuthId===id"));
 assert.ok(auth.includes("signedIn?.id===id"));
 assert.ok(auth.includes("if(epoch!==authEpoch)return"));
 assert.ok(auth.includes("showPage('registro')"));
});
test('01.04 revisión 03: historial completo paginado y catálogo ampliable',()=>{
 assert.ok(auth.includes("const uid=signedIn.id, pageSize=700, parallel=4;"));
 assert.ok(auth.includes("count:'exact',head:true"));
 assert.ok(auth.includes("offset+pageSize-1"));
 assert.ok(auth.includes("const all=[],pageSize=700;"));
 assert.doesNotMatch(auth,/\.limit\(1000\)/);
});
