import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
function extract(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Falta la sección '+start);
 return app.slice(a,b);
}
const deletion=extract('async function deleteRecord(id){','function drawReports(){');
const upload=extract('async function uploadPhoto(event){','function photoCanvas(file,maxSize){');
const anatomy=extract('async function gymlyticsAnatomyUpload(event){',"document.querySelectorAll('[data-anatomy-side]')");

function deletionFixture({pendingDelete=false,pendingHistory=false}={}){
 const code=`
let session='A',resolveDelete,resolveHistory,deletes=0,loads=0,redraws=0;
let model={records:[{id:'a1',series:'Serie 1',exercise:'Remo'}]};
const messages=[],window={GymCloud:{
 canWrite:()=>true,getSessionStamp:()=>session,
 deleteSeries:async()=>{deletes++;if(${pendingDelete})await new Promise(r=>resolveDelete=r)},
 loadHistory:async()=>{loads++;if(${pendingHistory})await new Promise(r=>resolveHistory=r);
  return [{id:'a-recargada'}]}
}};
const confirm=()=>true,toast=x=>messages.push(x);
const drawRecent=()=>{redraws++},drawHistory=()=>{redraws++},drawReports=()=>{redraws++};
${deletion}
({run:()=>deleteRecord('a1'),switchAccount:()=>{session='B';model.records=[{id:'b1'}]},
 releaseDelete:()=>resolveDelete?.(),releaseHistory:()=>resolveHistory?.(),
 state:()=>({records:model.records,deletes,loads,redraws,messages})});
`;
 return runInNewContext(code);
}

test('Eliminar A: respuesta tardía nunca borra historial de B',async()=>{
 const h=deletionFixture({pendingDelete:true}),run=h.run();
 h.switchAccount();h.releaseDelete();await run;
 assert.equal(h.state().records[0].id,'b1');
 assert.equal(h.state().loads,0);
 assert.equal(h.state().redraws,0);
});
test('Eliminar A: historial descargado después del cambio no reemplaza el de B',async()=>{
 const h=deletionFixture({pendingHistory:true}),run=h.run();
 await Promise.resolve();
 assert.equal(h.state().loads,1);
 h.switchAccount();const before=h.state().redraws;h.releaseHistory();await run;
 assert.equal(h.state().records[0].id,'b1');
 assert.equal(h.state().redraws,before);
});
test('Eliminar en la misma sesión recarga el historial correctamente',async()=>{
 const h=deletionFixture();await h.run();
 assert.equal(h.state().records[0].id,'a-recargada');
 assert.equal(h.state().deletes,1);
 assert.equal(h.state().loads,1);
});

function photoFixture({mode='equipo',pendingCanvas=false,pendingUpload=false}={}){
 const script=mode==='anatomia'?anatomy:upload;
 const code=`
let session='A',resolveCanvas,resolveUpload,uploadStarted,uploads=0,draws=0;
const uploadRequested=new Promise(resolve=>uploadStarted=resolve);
const messages=[],model={photos:{persisted:'B'}};
const window={GymCloud:{
 canWrite:()=>true,getSessionStamp:()=>session,
 uploadUserPhoto:async()=>{uploads++;uploadStarted();if(${pendingUpload})await new Promise(r=>resolveUpload=r)}
}};
const chosenRow=()=>({g:'Pruebas',s:'Centro',i:'Equipo',e:'Ejercicio'});
const getValue=()=> 'Base',gymlyticsAnatomySide='frontal';
const toast=x=>messages.push(x),detailOpenAfterUpload=()=>{draws++},gymlyticsAnatomyDraw=()=>{draws++};
const photoCanvas=async()=>{if(${pendingCanvas})await new Promise(r=>resolveCanvas=r);
 return {toBlob(cb){cb({})},toDataURL(){return 'data:image/jpeg;base64,demo'}};};
${script}
({run:()=>{
 const target={files:[{type:'image/png'}],dataset:{upload:'equipo'},value:'seleccionada'};
 const result=${mode==='anatomia'?'gymlyticsAnatomyUpload':'uploadPhoto'}({target});
 return {result,target};
 },switchAccount:()=>{session='B';model.photos={persisted:'B'}},
 releaseCanvas:()=>resolveCanvas?.(),releaseUpload:()=>resolveUpload?.(),waitUpload:()=>uploadRequested,
 state:()=>({photos:model.photos,uploads,draws,messages})});
`;
 return runInNewContext(code);
}
test('Foto: cambio de sesión durante el redimensionado impide subir imagen',async()=>{
 const h=photoFixture({pendingCanvas:true}),{result}=h.run();
 h.switchAccount();h.releaseCanvas();await result;
 assert.equal(h.state().uploads,0);
 assert.equal(h.state().photos.persisted,'B');
});
test('Foto: respuesta de subida anterior no modifica previsualizaciones de B',async()=>{
 const h=photoFixture({pendingUpload:true}),{result}=h.run();
 await h.waitUpload();
 h.switchAccount();h.releaseUpload();await result;
 assert.equal(h.state().uploads,1);
 assert.equal(h.state().draws,0);
 assert.deepEqual(Object.keys(h.state().photos),['persisted']);
});
test('Foto anatómica: respuesta anterior no cambia la vista de B',async()=>{
 const h=photoFixture({mode:'anatomia',pendingUpload:true}),{result}=h.run();
 await h.waitUpload();
 h.switchAccount();h.releaseUpload();await result;
 assert.equal(h.state().draws,0);
 assert.equal(h.state().photos.persisted,'B');
});
test('Foto: subida normal mantiene previsualización en sesión propia',async()=>{
 const h=photoFixture(),{result}=h.run();await result;
 assert.equal(h.state().uploads,1);
 assert.equal(h.state().draws,1);
 assert.ok(h.state().messages.some(m=>m.includes('guardada')));
});
