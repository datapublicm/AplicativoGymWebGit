import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const cloudSource=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
function extract(text,a,b){
 const from=text.indexOf(a),to=text.indexOf(b,from);
 assert.ok(from>=0&&to>from,'No se encontró sección '+a);
 return text.slice(from,to);
}
const method=extract(cloudSource,'async deleteSeries(id){','async loadHistory(){');
const deletionUI=extract(appSource,'async function deleteRecord(id){','function drawReports(){');
const exportMethod=extract(appSource,'function exportJson(){','async function importJson(');

function deletionServiceFixture({rows=[{id:'serie-1'}],failure=null,late=false}={}){
 const failureExpr=failure?'new Error('+JSON.stringify(failure)+')':'null';
 const env=`
let signedIn={id:'cuenta-A'},authEpoch=5,requested=[],release,started;
const startedPromise=new Promise(r=>started=r);
const owns=()=>!!signedIn?.id;
const must=(_data,error)=>{if(error)throw error};
const assertCurrentSession=(uid,epoch)=>{
 if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió durante la carga de datos.');
};
const db={from(name){
 if(name!=='tbl_series')throw Error('Tabla incorrecta');
 const q={
  delete(){return q},
  eq(k,v){requested.push([k,v]);return q},
  async select(column){
   requested.push(['select',column]);started();
   if(${late})await new Promise(r=>release=r);
   return {data:${JSON.stringify(rows)},error:${failureExpr}};
  }
 };
 return q;
}};
const cloud={${method}};
({
 run:()=>cloud.deleteSeries('serie-1'),
 switch:()=>{signedIn={id:'cuenta-B'};authEpoch++},
 wait:()=>startedPromise,release:()=>release?.(),
 calls:()=>requested
});
`;
 return runInNewContext(env);
}
test('Eliminación exitosa: confirma la fila y su propietario',async()=>{
 const h=deletionServiceFixture(),id=await h.run();
 assert.equal(id,'serie-1');
 assert.deepEqual(h.calls().map(x=>x[0]),['id','user_id','select']);
 assert.equal(h.calls()[1][1],'cuenta-A');
});
test('Eliminación de registro inexistente NO se reporta como éxito',async()=>{
 const h=deletionServiceFixture({rows:[]});
 await assert.rejects(h.run(),/No se eliminó ninguna serie/);
});
test('Eliminación denegada por RLS NO se reporta como éxito',async()=>{
 const h=deletionServiceFixture({failure:'Violación de permisos',rows:[]});
 await assert.rejects(h.run(),/Violación de permisos/);
});
test('Respuesta de eliminación vieja no confirma operaciones de una nueva cuenta',async()=>{
 const h=deletionServiceFixture({late:true}),promise=h.run();
 await h.wait();h.switch();h.release();
 await assert.rejects(promise,/La sesión cambió durante la carga/);
 assert.equal(h.calls()[1][1],'cuenta-A');
});
test('La interfaz no elimina localmente cuando la API devuelve cero filas',async()=>{
 const fixture=`
const messages=[],model={records:[{id:'serie-1',series:'Serie 1',exercise:'Remo'}]};
const window={GymCloud:{
 canWrite:()=>true,getSessionStamp:()=> 'cuenta-A:5',
 deleteSeries:async()=>{throw Error('No se eliminó ninguna serie')},
 loadHistory:async()=>{throw Error('Nunca debe llamarse')}
}};
const confirm=()=>true,toast=x=>messages.push(x);
let redraws=0;
const drawRecent=()=>{redraws++},drawHistory=()=>{redraws++},drawReports=()=>{redraws++};
${deletionUI}
({run:()=>deleteRecord('serie-1'),state:()=>({model,messages,redraws})});
`;
 const h=runInNewContext(fixture);
 await h.run();
 assert.equal(h.state().model.records.length,1);
 assert.equal(h.state().redraws,0);
 assert.match(h.state().messages[0],/No se pudo eliminar/);
});
test('Exportar JSON guarda las series en un archivo y el botón tiene evento activo',()=>{
 const fixture=`
const model={records:[{id:'serie-1',weight:25.5,reps:6.5}],photos:{}};
let downloaded=null,message='';
const dateNow=()=> '2026-10-10';
const download=(name,body,mime)=>{downloaded={name,body,mime}};
const toast=x=>{message=x};
${exportMethod}
({run:()=>exportJson(),output:()=>({downloaded,message})});
`;
 const h=runInNewContext(fixture);h.run();
 const output=h.output();
 assert.equal(output.downloaded.name,'Gymlytics_respaldo_2026-10-10.json');
 assert.equal(JSON.parse(output.downloaded.body).records[0].weight,25.5);
 assert.equal(JSON.parse(output.downloaded.body).records[0].reps,6.5);
 assert.equal(output.downloaded.mime,'application/json');
 assert.match(output.message,/exportada/);
 assert.ok(appSource.includes("$('exportJson').addEventListener('click',exportJson)"));
});
