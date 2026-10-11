import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
const begin=src.indexOf('async loadInitialCatalog(){'),end=src.indexOf('async loadOwnCatalog(){',begin);
assert.ok(begin>=0&&end>begin,'Se encuentra el cargador del catálogo');
const method=src.slice(begin,end);

function fixture(mode='correcto',total=242){
 const lines=[
  "let signedIn={id:'A'},authEpoch=7,requests=0;",
  "const owns=()=>!!signedIn?.id;",
  "const must=(v,error)=>{if(error)throw error;return v};",
  "const assertCurrentSession=(id,epoch)=>{if(!signedIn||id!==signedIn.id||epoch!==authEpoch)throw Error('La sesión cambió');};",
  "const mode="+JSON.stringify(mode)+",total="+total+";",
  "const source=Array.from({length:total},(_,i)=>({id:'ref-'+i,gimnasio:'Smart Fit',sede:'Centro',instrumento:'Máquina de polea alta',ejercicio:'Jalón '+i,zona_entrenamiento:'Espalda',tecnica_actualizada:'Base'}));",
  "const db={from(name){if(name!=='tbl_catalogo_predeterminado')throw Error('Tabla inesperada');return {select(_fields,opts={}){let active=false;const q={",
  "eq(k,v){if(k!=='activo'||v!==true)throw Error('El filtro de catálogo activo es obligatorio');active=true;return opts.head?Promise.resolve({count:mode==='sin-recuento'?null:total,error:null}):q},",
  "order(){return q},async range(start,end){requests++;if(!active)throw Error('Falta filtro activo');",
  "let data=source.slice(start,end+1).map(row=>({...row}));",
  "if(mode==='corte'&&start>=700)data.pop();",
  "if(mode==='duplicado'&&data.length>1)data[1]={...data[0]};",
  "if(mode==='sesion'&&start===0)authEpoch++;",
  "if(mode==='rest-falla')return {data:null,error:Error('Error del servidor')};",
  "return {data,error:null};",
  "}};return q;}}}};",
  "const cloud={"+method+"};",
  "({run:()=>cloud.loadInitialCatalog(),getRequests:()=>requests});"
 ];
 return runInNewContext(lines.join('\n'));
}
test('Carga los 242 ejercicios activos del Excel desde Supabase y conserva su orden',async()=>{
 const h=fixture(),rows=await h.run();
 assert.equal(rows.length,242);
 assert.equal(rows[0].cloud_base_id,'ref-0');
 assert.equal(rows[241].cloud_base_id,'ref-241');
 assert.equal(rows[0].kind,'Máquina');
 assert.equal(rows[0].g,'Smart Fit');
 assert.equal(h.getRequests(),1);
});
test('La carga paginada recupera todas las filas si el catálogo supera 700 elementos',async()=>{
 const h=fixture('correcto',1432),rows=await h.run();
 assert.equal(rows.length,1432);
 assert.equal(h.getRequests(),3);
 assert.equal(new Set(rows.map(r=>r.cloud_base_id)).size,1432);
});
test('El catálogo realmente vacío es válido',async()=>{
 const h=fixture('correcto',0),rows=await h.run();
 assert.equal(rows.length,0);assert.equal(h.getRequests(),0);
});
test('No presenta un catálogo incompleto si falta el recuento exacto',async()=>{
 await assert.rejects(fixture('sin-recuento').run(),/No se pudo comprobar/);
});
test('Rechaza una página incompleta en lugar de cargar información parcialmente',async()=>{
 await assert.rejects(fixture('corte',1401).run(),/incompleta/);
});
test('Rechaza identificadores duplicados del Excel',async()=>{
 await assert.rejects(fixture('duplicado').run(),/repetidas/);
});
test('Una descarga antigua no publica catálogo después de cambiar de sesión',async()=>{
 await assert.rejects(fixture('sesion').run(),/sesión cambió/);
});
test('Propaga el error de Supabase y no lo interpreta como catálogo vacío',async()=>{
 await assert.rejects(fixture('rest-falla').run(),/Error del servidor/);
});
