import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const from=source.indexOf('async loadHistory(){');
const to=source.indexOf('async loadInitialCatalog(){',from);
assert.ok(from>=0&&to>from,'Método completo de descarga del historial');
const implementation=source.slice(from,to);

function fixture(mode='valid',length=1503){
 const code=[
  "let signedIn={id:'cuenta-A'},authEpoch=4;",
  "const owns=()=>!!signedIn?.id;",
  "const must=(data,error)=>{if(error)throw error;return data;};",
  "const assertCurrentSession=(uid,epoch)=>{if(!signedIn||signedIn.id!==uid||epoch!==authEpoch)throw Error('La sesión cambió durante la carga de datos.');};",
  "const mode="+JSON.stringify(mode)+",length="+length+";",
  "const original=Array.from({length},(_,i)=>({id:'serie-'+i,user_id:'cuenta-A',date:'2026-10-10',weight:'25.50',reps:'6.50',assistance:'1.25'}));",
  "let requests=0;",
  "const db={from(name){if(name!=='vw_historial_series')throw Error('Tabla incorrecta');return {select(_col,opts={}){",
  "let owner=null;",
  "return {eq(k,v){if(k!=='user_id')throw Error('Sin filtro de propietario');owner=v;return opts.head?Promise.resolve({count:mode==='null-count'?null:length,error:null}):this},",
  "order(){return this},async range(start,end){requests++;",
  "if(owner!=='cuenta-A')throw Error('Se consultó otra identidad');",
  "if(mode==='backend-error')return {data:null,error:Error('Falló REST')};",
  "if(mode==='non-array')return {data:null,error:null};",
  "let page=original.slice(start,end+1).map(r=>({...r}));",
  "if(mode==='short-page'&&start===700)page.pop();",
  "if(mode==='duplicate-id'&&start===700)page[0]={...original[0]};",
  "if(mode==='foreign-owner'&&start===0)page[0]={...page[0],user_id:'cuenta-B'};",
  "if(mode==='missing-id'&&start===0)page[0]={...page[0],id:null};",
  "return {data:page,error:null};",
  "}}}}}};",
  "const cloud={"+implementation+"};",
  "({run:()=>cloud.loadHistory(),requests:()=>requests});"
 ].join('\n');
 return runInNewContext(code);
}

test('Valida descarga completa en tres páginas, decimales conservados y 1.503 IDs únicos',async()=>{
 const h=fixture(),rows=await h.run();
 assert.equal(rows.length,1503);
 assert.equal(new Set(rows.map(r=>r.id)).size,1503);
 assert.equal(rows[0].weight,25.5);
 assert.equal(rows[0].reps,6.5);
 assert.equal(rows[0].assistance,1.25);
 assert.equal(h.requests(),3);
});
test('Cuenta cero es un historial íntegro vacío; no ejecuta peticiones de páginas',async()=>{
 const h=fixture('valid',0),rows=await h.run();
 assert.equal(rows.length,0);assert.equal(h.requests(),0);
});
test('Rechaza recuento HEAD ausente; nunca interpreta NULL como historial vacío',async()=>{
 const h=fixture('null-count');
 await assert.rejects(h.run(),/No se pudo verificar el total/);
 assert.equal(h.requests(),0);
});
test('Rechaza página corta aunque REST responda sin error',async()=>{
 await assert.rejects(fixture('short-page').run(),/incompleto/);
});
test('Rechaza identificadores duplicados entre páginas para no entregar un respaldo falso',async()=>{
 await assert.rejects(fixture('duplicate-id').run(),/repetidas o ajenas/);
});
test('Rechaza una fila de otro propietario incluso si llega dentro del filtro',async()=>{
 await assert.rejects(fixture('foreign-owner').run(),/repetidas o ajenas/);
});
test('Rechaza identificadores nulos',async()=>{
 await assert.rejects(fixture('missing-id').run(),/repetidas o ajenas/);
});
test('Rechaza contenido REST nulo sin interpretarlo como arreglo vacío',async()=>{
 await assert.rejects(fixture('non-array').run(),/incompleto/);
});
test('Propaga errores HTTP de REST',async()=>{
 await assert.rejects(fixture('backend-error').run(),/Falló REST/);
});
