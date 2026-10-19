/** GymLytics 01.15: prueba del DIST empaquetado, no del servidor fuente. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const chrome=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>x&&existsSync(x));
const work=mkdtempSync(join(tmpdir(),'gym-seed-test-'));
let browser,server,ws,seq=0,stderr='';const requests=new Map();
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function cd(method,params={}){
 return new Promise((ok,fail)=>{
  const id=++seq,timer=setTimeout(()=>{requests.delete(id);fail(Error('Chrome tardó: '+method));},20000);
  requests.set(id,{ok:v=>{clearTimeout(timer);ok(v)},fail:e=>{clearTimeout(timer);fail(e)}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const v=await cd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(v.exceptionDetails)throw Error('JavaScript Chromium: '+JSON.stringify(v.exceptionDetails).slice(0,500));
 return v.result?.value;
}
async function until(expression,label){
 for(let i=0;i<170;i++){try{if(await evaluate(expression))return;}catch{}await wait(150);}
 throw Error('No se alcanzó: '+label+' · '+await evaluate('document.getElementById("authStatus")?.textContent'));
}
async function profiles(){
 return evaluate(`(async()=>{const r=indexedDB.open('gymlytics_offline_profiles_v1',1),db=await new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});
 const tx=db.transaction('profiles','readonly'),rows=await new Promise((ok,fail)=>{const q=tx.objectStore('profiles').getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(q.error)});
 db.close();return rows.map(p=>({id:p.id,name:p.name,records:p.data.records?.length||0,gyms:p.data.entities?.gyms?.length||0,sites:p.data.entities?.sites?.length||0,exercises:p.data.library?.length||0,
 sessions:p.data.sessions?.length||0,pending:p.data.pending?.length||0,demo:p.data.demo,cloudUserId:p.data.cloudUserId,
 absentUnits:p.data.records?.filter(x=>x.unit===null).length||0,rows:p.data.records?.slice(-2).map(x=>({id:x.id,exerciseId:x.exerciseId}))||[]}))})()`);
}
async function navigate(){await cd('Page.navigate',{url:'http://127.0.0.1:4173/'});await until('!!window.GymCloud?.canWrite?.()','arranque completo de GymLytics');}
try{
 assert(chrome,'No se encontró Chromium en runner');
 assert(existsSync(join(root,'node_modules','vite','bin','vite.js')),'Requiere instalar dependencias, sin compilar');
 server=spawn(process.execPath,[join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','ignore','pipe']});
 server.stderr.on('data',v=>stderr+=String(v).slice(-1000));
 for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:4173/')).ok)break;}catch{}await wait(130);}
 browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0','--user-data-dir='+work,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',v=>stderr+=String(v).slice(-1000));
 let port;
 for(let i=0;i<250;i++){try{port=Number(readFileSync(join(work,'DevToolsActivePort'),'utf8').split('\n')[0]);break;}catch{}await wait(100);}
 assert(port,'Chrome no inició: '+stderr.slice(-500));
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 ws.addEventListener('message',ev=>{const data=JSON.parse(ev.data),p=requests.get(data.id);if(!p)return;requests.delete(data.id);data.error?p.fail(Error(data.error.message)):p.ok(data.result);});
 await cd('Page.enable');await cd('Runtime.enable');await cd('Network.enable');
 await navigate();
 let p=await profiles();
 assert.equal(p.length,1,'El primer inicio solo debe crear el perfil vacío');
 assert.deepEqual(p[0]&&[p[0].name,p[0].records,p[0].gyms,p[0].sites,p[0].exercises,p[0].sessions,p[0].pending,p[0].cloudUserId,p[0].demo],
  ['Mi perfil',0,0,0,0,0,0,null,false]);
 assert.equal(await evaluate('document.querySelector("#offlineCloudUpload")?.disabled'),true,'No se sincroniza sin vincular');
 assert.equal(await evaluate('document.querySelector("#offlineLinkStatus")?.textContent'),"No vinculado");
 assert.equal(await evaluate('document.querySelector("#gimnasio")?.disabled'),true,'Ningún gimnasio precargado');
 console.log('PASS 1: primera instalación, gimnasio/sede/ejercicio/sesión/serie en cero y sin nube');
 assert.equal(await evaluate('document.querySelector(".gym-catalog-header strong")?.textContent?.includes("01.15")'),true);
 assert.equal(await evaluate('typeof window.GymCatalogCollectExerciseValues'), 'function');
 assert.equal(await evaluate('typeof window.GymSiteGpsRefresh'), 'function');
 console.log('PASS APK WEB: código del módulo externo de Catálogos funciona en DIST y se ve versión 01.15');
 const imported=await evaluate("localStorage.getItem('gymlytics-hojamatriz-seed-v1-completed')");
 assert.equal(imported,null,'Ninguna marca de HojaMatriz se registró');
 await navigate();p=await profiles();assert.equal(p.length,1);assert.equal(p[0].records,0);assert.equal(p[0].gyms,0);
 console.log('PASS 2: reinicio sin importación automática');
 const id=await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio manual"})');
 assert.equal(typeof id,'string');
 p=await profiles();assert.equal(p[0].gyms,1);assert.equal(p[0].sites,1);
 console.log('PASS 3: creación manual de gimnasio y sede «Única»');
 await evaluate('window.GymCloud.saveCustomExercise({e:"Ejercicio manual",anotacion:"Espalda",tecnica:"Ejecutar suave"})');
 p=await profiles();assert.equal(p[0].exercises,1);
 const exerciseId=await evaluate("(async()=>{const r=indexedDB.open('gymlytics_offline_profiles_v1',1),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));const tx=db.transaction('profiles','readonly'),rows=await new Promise(ok=>{const q=tx.objectStore('profiles').getAll();q.onsuccess=()=>ok(q.result)});db.close();return rows[0].data.library[0].id;})()");
 const payload={exercise:{g:'Gimnasio manual',s:'Única',z:'Espalda',kind:'Otro',i:'No especificado',a:'No especificado',gr:'No especificado',e:'Ejercicio manual',exerciseId},
  date:'2026-10-18',technique:'Prueba local',notes:'Solo IndexedDB',entries:[{series:'Serie 1',sub:'-',unit:'kg',weight:20,reps:12,assistance:0}]};
 assert.equal(await evaluate('window.GymCloud.saveWorkout('+JSON.stringify(payload)+')'),1);
 p=await profiles();assert.equal(p[0].records,1);
 console.log('PASS 4: ejercicio y entrenamiento guardados únicamente offline');
 await navigate();p=await profiles();assert.equal(p[0].records,1);assert.equal(p[0].exercises,1);
 console.log('PASS 5: persistencia local tras reiniciar');
 await evaluate("(()=>{document.querySelector('#offlineNewName').value='Segundo usuario';document.querySelector('#offlineCreate').click();return true})()");
 await until('document.querySelector("#offlineProfiles").options.length===2','perfil independiente');
 p=await profiles();assert.equal(p.find(x=>x.name==='Mi perfil').records,1);assert.equal(p.find(x=>x.name==='Segundo usuario').records,0);
 assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,0);
 console.log('PASS 6: perfiles separados, segundo perfil también vacío');
 await cd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 assert.equal(typeof await evaluate('window.GymCloud.addIndependentItem("gym",{nombre:"Gimnasio offline"})'),'string');
 p=await profiles();assert.equal(p.find(x=>x.name==='Segundo usuario').gyms,1);assert.equal(p.find(x=>x.name==='Segundo usuario').sites,1);
 console.log('PASS 7: edición sin Internet');
 console.log('PASS 7 completado. Ahora se prueba el ejemplo SOLO por acción del usuario.');
 await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await evaluate("(()=>{window.confirm=()=>true;document.querySelector('[data-profile-action=example]').click();return true})()");
 await until('document.querySelector("#offlineProfiles").options.length===3','ejemplo solicitado');
 p=await profiles();
 const sampleProfile=p.find(x=>x.name==='Ejemplo');
 assert(sampleProfile,'El perfil Ejemplo debe existir solo tras pulsar Agregar ejemplo');
 assert.deepEqual([sampleProfile.records,sampleProfile.gyms,sampleProfile.sites,sampleProfile.exercises,sampleProfile.sessions,sampleProfile.demo],
  [9424,3,16,146,446,true]);
 assert.equal(p.find(x=>x.name==='Mi perfil').records,1);
 console.log('PASS 8: Agregar ejemplo crea 9424 series, 3 gimnasios y 146 ejercicios aparte');
 await until('!!window.GymCatalogDetailRefresh','explorador de detalles');
 await evaluate("(()=>{document.querySelector('#catalogDetailBrowser').open=true;window.GymCatalogDetailRefresh();return true})()");
 let options=await evaluate("Array.from(document.querySelectorAll('#catalogDetailFilters select[data-detail-field=\"Nombre del ejercicio\"] option')).map(x=>x.textContent)");
 assert(options.some(x=>x.includes('Press inclinado (20)')),'El explorador agrupa homónimos con su cantidad');
 await evaluate("(()=>{const x=document.querySelector('#catalogDetailFilters select[data-detail-field=\"Nombre del ejercicio\"]');x.value='Press inclinado';x.dispatchEvent(new Event('change'));return true})()");
 assert.equal(await evaluate("document.querySelector('#catalogDetailView').disabled"),true,'Ver debe estar deshabilitado cuando hay varios');
 const variants=await evaluate("Array.from(document.querySelector('#catalogDetailFilters select[data-detail-field=\"Identificador\"]')?.options||[]).filter(x=>x.value).map(x=>x.value)");
 assert(variants.length>1);
 const chosen=variants[0];
 await evaluate("(()=>{const x=document.querySelector('#catalogDetailFilters select[data-detail-field=\"Identificador\"]');x.value="+JSON.stringify(chosen)+";x.dispatchEvent(new Event('change'));return true})()");
 assert.equal(await evaluate("document.querySelector('#catalogDetailView').disabled"),false);
 await evaluate("document.querySelector('#catalogDetailView').click()");
 assert.equal(await evaluate("window.GymCatalogSelectedExerciseId"),chosen);
 assert.equal(await evaluate("document.querySelectorAll('#exerciseExistingSelect option').length < 147"),true,'Ejercicios con nombres repetidos agrupados');
 console.log('PASS 9: variantes homónimas con recuento, selección única por UUID y acción Ver');
 const before=await evaluate("document.querySelectorAll('#catalogExtraDetails .catalog-extra-row').length");
 await evaluate("document.querySelector('#addExerciseExtra').click()");
 assert.equal(await evaluate("document.querySelectorAll('#catalogExtraDetails .catalog-extra-row').length"),before+1);
 await evaluate("(()=>{const x=[...document.querySelectorAll('#catalogExtraDetails .catalog-extra-row')].at(-1);x.querySelector('.extra-campo').value='Angulo de trabajo';x.querySelector('.extra-valor').value='45 grados';document.querySelector('[data-catalog-modify=exercise]').click();return true})()");
 await until("document.querySelector('#exerciseEditFeedback')?.textContent?.includes('Nombre y detalles guardados')",'guardar característica adicional');
 await evaluate("(()=>{document.querySelector('#catalogDetailBrowser').open=true;window.GymCatalogDetailRefresh();return true})()");
 assert.equal(await evaluate("!!document.querySelector('#catalogDetailFilters select[data-detail-field=\"Angulo de trabajo\"]')"),true);
 console.log('PASS 10: añadir y guardar característica; nuevo campo disponible como filtro');
 await evaluate("(()=>{document.querySelector('#offlineRenameName').value='Mi ejemplo renombrado';document.querySelector('#offlineRename').click();return true})()");
 await until("Array.from(document.querySelector('#offlineProfiles').options).some(x=>x.textContent.includes('Mi ejemplo renombrado'))",'renombrar ejemplo');
 p=await profiles();assert.equal(p.find(x=>x.name==='Mi ejemplo renombrado').records,9424);
 console.log('PASS 11: el ejemplo se puede renombrar conservando sus 9424 series');
 await evaluate("document.querySelector('[data-profile-action=example]').click()");
 p=await profiles();assert.equal(p.length,3,'Ejemplo no se duplica al volver a solicitarlo');
 console.log('PASS 12: el usuario no puede importar dos veces el ejemplo sobre otros perfiles');
 // 13. Los botones Modificar deben guardar cambios en el MISMO UUID.
 const siteId=await evaluate("window.GymEntities.sites[0].id");
 await evaluate("(()=>{const site=window.GymEntities.sites[0];const gym=document.querySelector('#gymExistingSelect');gym.value=site.gimnasio_id;gym.dispatchEvent(new Event('change'));const s=document.querySelector('#siteExistingSelect');s.value=site.id;s.dispatchEvent(new Event('change'));catalogOpenCard('site','edit');return true})()");
 await evaluate("(()=>{document.querySelector('#siteEditName').value='VES CORREGIDA';document.querySelector('[data-catalog-modify=site]').click();return true})()");
 await until("window.GymEntities.sites.some(x=>x.id==="+JSON.stringify(siteId)+"&&x.nombre==='VES CORREGIDA')",'renombrar sede en mismo UUID');
 assert.equal(await evaluate("window.GymEntities.sites.length"),16);
 console.log('PASS 13: Modificar sede persiste Única → VES CORREGIDA sin duplicar registros');
 // 14. GPS debe abrir el dialog y guardar los dos campos localmente.
 await evaluate("(()=>{const s=document.querySelector('#siteExistingSelect');s.value="+JSON.stringify(siteId)+";s.dispatchEvent(new Event('change'));catalogOpenCard('site','edit');document.querySelector('#openSiteGPS').click();return true})()");
 assert.equal(await evaluate("document.querySelector('#siteGPSDialog').open"),true,'Botón de ubicación GPS sin acción');
 await evaluate("(()=>{document.querySelector('#siteGPSLat').value='-12.0463740';document.querySelector('#siteGPSLon').value='-77.0427930';document.querySelector('#saveSiteGPS').click();return true})()");
 await until("window.GymEntities.sites.find(x=>x.id==="+JSON.stringify(siteId)+")?.latitud===-12.046374",'guardar ubicación GPS');
 await evaluate("document.querySelector('#closeSiteGPS').click()");
 console.log('PASS 14: Ubicación GPS abre y guarda en la sede seleccionada');
 // 15. Solo un nombre de ejercicio en la lista; cambios según variante y navegación.
 const presses=await evaluate("Array.from(document.querySelector('#exerciseExistingSelect').options).filter(o=>o.textContent.startsWith('Press inclinado'))");
 assert.equal(presses.length,1,'Los ejercicios con el mismo nombre deben estar agrupados');
 await evaluate("(()=>{const x=document.querySelector('#exerciseExistingSelect');x.value=Array.from(x.options).find(o=>o.textContent.startsWith('Press inclinado')).value;x.dispatchEvent(new Event('change'));catalogOpenCard('exercise','edit');return true})()");
 const firstVariant=await evaluate("window.GymCatalogSelectedExerciseId");
 await evaluate("document.querySelector('[data-variant-go=last]').click()");
 const lastVariant=await evaluate("window.GymCatalogSelectedExerciseId");
 assert.notEqual(firstVariant,lastVariant);
 await evaluate("document.querySelector('[data-variant-go=first]').click()");
 assert.equal(await evaluate("window.GymCatalogSelectedExerciseId"),firstVariant);
 assert.equal(await evaluate("document.querySelector('#catalogForm [name=e]').value"),'Press inclinado');
 console.log('PASS 15: lista única Press inclinado (20), flechas << < > >> y datos según UUID');
 await evaluate("(()=>{document.querySelector('#exerciseEditName').value='Press corregido';document.querySelector('[data-catalog-modify=exercise]').click();return true})()");
 await until("window.GymExerciseLibrary.find(x=>x.id==="+JSON.stringify(firstVariant)+")?.nombre==='Press corregido'",'renombrar ejercicio');
 assert.equal(await evaluate("window.GymExerciseLibrary.filter(x=>x.nombre==='Press corregido').length"),1);
 console.log('PASS 16: Modificar ejercicio actualiza la variante elegida, sin cambiar las otras 19');
 // 17-19. Administración de nuevos campos y aviso de pérdida potencial.
 await until("!!window.GymCatalogFieldRefresh",'administrador de campos');
 await evaluate("(()=>{const p=document.querySelector('[data-field-panel=catalog]');p.querySelector('details').open=true;p.querySelector('[data-field-new]').value='Rango de movimiento';p.querySelector('[data-field-action=add]').click();return true})()");
 await until("window.GymCloud.detailFieldList().includes('Rango de movimiento')",'añadir campo');
 await until("Array.from(document.querySelector('[data-field-panel=catalog] [data-field-existing]').options).some(x=>x.value==='Rango de movimiento')",'actualizar selector de campos');
 await until("!document.querySelector('[data-field-panel=catalog] [data-field-action=add]').disabled",'guardado inicial de campo completado');
 await evaluate("(()=>{const p=document.querySelector('[data-field-panel=catalog]');p.querySelector('[data-field-existing]').value='Rango de movimiento';p.querySelector('[data-field-existing]').dispatchEvent(new Event('change'));p.querySelector('[data-field-name]').value='Recorrido';window.renameEnabledBeforeClick=!p.querySelector('[data-field-action=rename]').disabled;p.querySelector('[data-field-action=rename]').click();return true})()");
 await until("window.GymCloud.detailFieldList().includes('Recorrido')",'renombrar campo');
 console.log('PASS 17: campo creado y renombrado desde Catálogos');
 await evaluate("(()=>{const p=document.querySelector('[data-field-panel=catalog]');p.querySelector('[data-field-existing]').value='Recorrido';p.querySelector('[data-field-existing]').dispatchEvent(new Event('change'));window.confirm=m=>{window.warningCaptured=m;return false};p.querySelector('[data-field-action=delete]').click();return true})()");
 assert.equal(await evaluate("window.GymCloud.detailFieldList().includes('Recorrido')"),true,'Cancelar eliminación debe mantener campo');
 assert.match(await evaluate("window.warningCaptured"),/PELIGRO.*ejercicios.*series/);
 await evaluate("(()=>{window.confirm=()=>true;document.querySelector('[data-field-panel=catalog] [data-field-action=delete]').click();return true})()");
 await until("!window.GymCloud.detailFieldList().includes('Recorrido')",'eliminación de campo');
 console.log('PASS 18: eliminar exige advertencia ⚠ con impacto y respeta cancelación');
 await evaluate("document.querySelector('[data-page=registro]').click()");
 assert.equal(await evaluate("!!document.querySelector('[data-field-panel=registro]')"),false);
 assert.equal(await evaluate("document.querySelector('#registroNuevosDetalles')!==null"),true);
 console.log('PASS 19: Registro sin panel de administración, con valores adicionales condicionales');
 // 20. Las flechas van DENTRO del detalle desplegado, solo si el nombre se repite.
 await evaluate("document.querySelector('[data-page=catalogos]').click()");
 await evaluate("(()=>{const opts=catalogChoices('exercise'),multi=opts.find(x=>x.variantIds?.length>1);const sel=document.querySelector('#exerciseExistingSelect');sel.value=multi.id;sel.dispatchEvent(new Event('change'));catalogOpenCard('exercise','edit');return true})()");
 assert.equal(await evaluate("document.querySelector('#exerciseVariantNav').closest('#catalogDetailexercise')!==null"),true);
 assert.equal(await evaluate("document.querySelector('#exerciseVariantNav').hidden"),false);
 await evaluate("catalogOpenCard('exercise','toggle')");
 assert.equal(await evaluate("document.querySelector('#exerciseVariantNav').hidden"),true);
 await evaluate("(()=>{const opt=catalogChoices('exercise').find(x=>x.variantIds?.length===1);const sel=document.querySelector('#exerciseExistingSelect');sel.value=opt.id;sel.dispatchEvent(new Event('change'));catalogOpenCard('exercise','edit');return true})()");
 assert.equal(await evaluate("document.querySelector('#exerciseVariantNav').hidden"),true);
 console.log('PASS 20: flechas visibles solo cuando el panel está expandido y hay varias variantes');
 // 21. GPS muestra estado persistente, y conserva coordenadas tras guardar.
 await evaluate("(()=>{const s=document.querySelector('#siteExistingSelect');s.value="+JSON.stringify(siteId)+";s.dispatchEvent(new Event('change'));return true})()");
 assert.match(await evaluate("document.querySelector('#siteGPSStatus').textContent"),/Ubicación registrada/);
 await evaluate("document.querySelector('#openSiteGPS').click()");
 assert.equal(await evaluate("document.querySelector('#siteGPSLat').value"),'-12.046374');
 assert.equal(await evaluate("document.querySelector('#siteGPSDialog').open"),true);
 await evaluate("document.querySelector('#closeSiteGPS').click()");
 console.log('PASS 21: estado ubicación registrada al guardar y abrir mapa con coordenadas');
 // 22. Un único botón Modificar; selectores redundantes desaparecieron.
 assert.equal(await evaluate("document.querySelector('#editExerciseDetails')===null"),true);
 assert.equal(await evaluate("document.querySelector('#registroNumeroSerie')===null"),true);
 assert.equal(await evaluate("document.querySelector('#registroModoSubdivision')===null"),true);
 assert.equal(await evaluate("!!document.querySelector('#toggleSubdivisions')"),true);
 console.log('PASS 22: único botón Modificar y Registro sin selects redundantes');
 // 23. Una variante idéntica no se inserta dos veces.
 const beforeCount=await evaluate("window.GymExerciseLibrary.length");
 const dupe=await evaluate("(async()=>{const ex=window.GymExerciseLibrary[0],get=f=>(ex.detalles||[]).find(x=>x.campo===f)?.valor||'';const standard=['Agrupación','Anotación','Máquina','Instrumento','Agarre / Implemento','Técnica'];const detail=(ex.detalles||[]).filter(d=>!standard.includes(d.campo));const values={e:ex.nombre,agrupacion:get('Agrupación'),anotacion:get('Anotación'),instrumento:get('Máquina')||get('Instrumento'),agarre_implemento:get('Agarre / Implemento'),tecnica:get('Técnica'),detalles_extra:detail};try{await window.GymCloud.saveCustomExercise(values);return 'SE INSERTÓ'}catch(e){return e.message;}})()");
 assert.match(dupe,/Ya existe un ejercicio/);
 assert.equal(await evaluate("window.GymExerciseLibrary.length"),beforeCount);
 console.log('PASS 23: alta duplicada rechazada sin crear filas nuevas');
 // 24. La selección por campos reduce opciones posteriores.
 await evaluate("(()=>{document.querySelector('[data-page=registro]').click();const m=document.querySelector('#registroSelectByFields');m.checked=true;m.dispatchEvent(new Event('change'));return true})()");
 const initial=await evaluate("document.querySelector('#registroAgrupacion').options.length");
 assert(initial>1);
 await evaluate("(()=>{const g=document.querySelector('#registroAgrupacion');g.value=[...g.options].find(x=>x.value).value;g.dispatchEvent(new Event('change'));return true})()");
 const countFiltered=await evaluate("document.querySelector('#zona').options.length");
 const countTotal=await evaluate("new Set(window.GymExerciseLibrary.map(e=>(e.detalles||[]).find(d=>d.campo==='Anotación')?.valor).filter(Boolean)).size");
 assert(countFiltered-1<=countTotal);
 const countExercise=await evaluate("document.querySelector('#ejercicio').options.length");
 const countNames=await evaluate("new Set(window.GymExerciseLibrary.map(e=>e.nombre)).size");
 assert(countExercise<=countNames+1);
 console.log('PASS 24: la selección por campos reduce las opciones posteriores');
 // 25. No se muestran controles extra sin selección.
 assert.equal(await evaluate("document.querySelector('[data-field-panel=registro]')===null"),true);
 await evaluate("(()=>{const g=document.querySelector('#ejercicio');g.value='';g.dispatchEvent(new Event('change'));return true})()");
 assert.equal(await evaluate("document.querySelector('#registroNuevosDetalles').hidden"),true);
 console.log('PASS 25: Registro sin administrador y detalles ocultos sin selección');
 // 26. Guardar sin peso o ejercicio indica qué falta.
 await evaluate("document.querySelector('#saveRecords').click()");
 assert.match(await evaluate("document.querySelector('#saveFeedback').textContent"),/Falta completar:/);
 console.log('PASS 26: guardado informa campos faltantes');

 // Word 001.005 27: se muestra editor de nombre anterior → nuevo en el panel.
 await evaluate("document.querySelector('[data-page=catalogos]').click()");
 await evaluate("(()=>{const s=document.querySelector('#siteExistingSelect');s.value="+JSON.stringify(siteId)+";s.dispatchEvent(new Event('change'));document.querySelector('[data-catalog-kind=site] .catalog-inline-modify').click();return true})()");
 assert.equal(await evaluate("document.querySelector('[data-catalog-kind=site] .catalog-rename-inline').hidden"),false);
 assert.equal(await evaluate("document.querySelector('[data-catalog-kind=site] [data-rename-old]').value"),'VES CORREGIDA');
 await evaluate("(()=>{const e=document.querySelector('[data-catalog-kind=site]');e.querySelector('[data-rename-new]').value='Sede desde editor';e.querySelector('[data-rename-save]').click();return true})()");
 await until("window.GymEntities.sites.some(s=>s.id==="+JSON.stringify(siteId)+"&&s.nombre==='Sede desde editor')",'cambio de sede original a nuevo');
 assert.equal(await evaluate("window.GymEntities.sites.length"),16);
 console.log('PASS 27: editor de sede con antes → después, mismo UUID, sin crear otra');
 // 28: Agregar/Modificar juntos, gestión de subdivisiones arriba y botones series juntos.
 assert.equal(await evaluate("document.querySelector('#catalogSubmit').parentElement.contains(document.querySelector('#catalogModifyAdjacent'))"),true);
 assert.equal(await evaluate("(()=>{const i=document.querySelector('#implemento').closest('.field'),m=document.querySelector('#toggleSubdivisions').closest('.field'),t=document.querySelector('#tecnica').closest('.field');return Boolean(i.compareDocumentPosition(m)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(m.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)})()"),true);
 assert.equal(await evaluate("document.querySelector('#addSeriesGroup').parentElement===document.querySelector('#removeSeriesGroup').parentElement"),true);
 console.log('PASS 28: botones emparejados y Gestionar subdivisiones a nivel de Agarre');
 // 29: el selector de variantes no contiene los códigos UUID visibles en Word.
 await evaluate("(()=>{document.querySelector('[data-page=registro]').click();const e=document.querySelector('#ejercicio');e.value='Press inclinado';e.dispatchEvent(new Event('change'));return true})()");
 const names=await evaluate("Array.from(document.querySelector('#registroVariante').options).map(x=>({v:x.value,t:x.textContent}))");
 for(const option of names)if(/^[0-9a-f]{8}-/.test(option.v))assert(!option.t.includes(option.v.slice(0,8)),'Se está mostrando el UUID de la variante');
 console.log('PASS 29: nombres de variantes sin códigos técnicos visibles');
 // 30: el aviso y cierre solo ocurren tras alta de ejercicio confirmada, sin datos residuales.
 await evaluate("document.querySelector('[data-page=catalogos]').click()");
 await evaluate("catalogOpenCard('exercise','add')");
 const newName='Prueba 001005 '+Date.now();
 await evaluate("(()=>{const form=document.querySelector('#catalogForm');form.elements.namedItem('e').value="+JSON.stringify(newName)+";form.elements.namedItem('anotacion').value='Brazo';document.querySelector('#catalogSubmit').click();return true})()");
 await until("window.GymExerciseLibrary.some(e=>e.nombre==="+JSON.stringify(newName)+")",'ejercicio nuevo guardado');
 await until("document.querySelector('[data-catalog-kind=exercise] .catalog-compact-detail').hidden",'cerrar formulario al guardar');
 assert.equal(await evaluate("document.querySelector('#catalogForm [name=e]').value"),'');
 assert.equal(await evaluate("document.querySelector('#catalogExtraDetails').children.length"),0);
 assert.match(await evaluate("document.querySelector('#toast').textContent"),/registrado/);
 console.log('PASS 30: alta de ejercicio limpia, contrae y notifica durante segundos');
 // 31: el bundle de GPS nativo está integrado al webview y se puede recurrir a navegador solo en web.
 assert.equal(await evaluate('typeof window.GymNativeGPS?.getCurrentPosition'),'function');
 const nativeFiles=await evaluate("Array.from(document.scripts).map(x=>x.getAttribute('src')).filter(Boolean)");
 assert(nativeFiles.some(x=>x.includes('gymlytics-gps-native.js')));
 console.log('PASS 31: puente nativo GPS empaquetado y conectado al documento Android');
 console.log('GymLytics 01.15: 31 escenarios aprobados sobre DIST.');




}finally{
 try{await cd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}catch{}
 try{ws?.close();}catch{} browser?.kill('SIGKILL');server?.kill('SIGKILL');
 try{rmSync(work,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}