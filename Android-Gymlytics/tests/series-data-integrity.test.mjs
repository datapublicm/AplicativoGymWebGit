import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const auth=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
function extract(src,start,end){
 const i=src.indexOf(start),j=src.indexOf(end,i);
 assert.ok(i>=0&&j>i,'No se encuentra '+start);
 return src.slice(i,j);
}
const decimalCode=extract(app,'function validSeriesDecimal(value,limit){','function updateSeriesCount(){');
const decimals=runInNewContext(decimalCode+'({validSeriesDecimal,validSeriesEntry})');

const input=(weight,reps,assistance='',unit='kg')=>({weight,reps,assistance,unit,series:'Serie 1',sub:'-'});
test('Admite series fraccionarias válidas, incluidos peso cero y valores .5',()=>{
 for(const v of [input('0','6.5','1.25'),input('.5','10','.5','lb'),
  input('9999999999.99','99999999.99','99999999.99')])
  assert.equal(decimals.validSeriesEntry(v),true,JSON.stringify(v));
});
test('Rechaza decimales imprecisos, no finitos, negativos y fuera del rango NUMERIC de Supabase',()=>{
 const invalid=[
  input('1.234','8'),input('25','6.123'),input('25','8','1.999'),
  input('NaN','8'),input('Infinity','8'),input('1e309','8'),
  input('-1','8'),input('2','-4'),input('2','0'),input('2','4','-1'),
  input('10000000000','4'),input('2','100000000'),input('2','8','100000000'),
  input('2','4','0','oz'),input('2',''),input('','8'),input('1,5','8')
 ];
 for(const v of invalid)assert.equal(decimals.validSeriesEntry(v),false,JSON.stringify(v));
});
const workout=extract(auth,'async saveWorkout({exercise,date,technique,notes,entries}) {','async deleteSeries(id){');
function workoutFixture(){
 const code=`
let signedIn={id:'user-A'},authEpoch=1,created=0,rpcCalls=0;
const owns=()=>!!signedIn?.id;
const assertCurrentSession=(uid,epoch)=>{
 if(!owns()||signedIn.id!==uid||authEpoch!==epoch)throw Error('La sesión cambió');
};
const must=(_,error)=>{if(error)throw error;};
const db={rpc:async()=>{rpcCalls++;return {error:null}}};
const cloud={
 ensureExercise:async()=>{created++;return {gimnasio_id:'g',sede_id:'s',ejercicio_id:'e'};},
 ${workout}
};
({
 run:entries=>cloud.saveWorkout({exercise:{e:'Test'},date:'2026-10-10',technique:'Base',notes:'',entries}),
 state:()=>({created,rpcCalls})
});
`;
 return runInNewContext(code);
}
test('Capa Supabase rechaza una serie inválida ANTES de crear gimnasio o invocar RPC',async()=>{
 const h=workoutFixture();
 await assert.rejects(h.run([input('25','9.333')]),/Serie inválida/);
 await assert.rejects(h.run([input('1e309','8')]),/Serie inválida/);
 await assert.rejects(h.run([]),/Serie inválida/);
 assert.equal(h.state().created,0);
 assert.equal(h.state().rpcCalls,0);
});
test('Capa Supabase permite los decimales válidos y continúa el guardado',async()=>{
 const h=workoutFixture();
 await h.run([input('25.5','6.5','1.25')]);
 assert.equal(h.state().created,1);
 assert.equal(h.state().rpcCalls,1);
});
const csvCode=extract(app,'function exportCsv(){','function exportJson(){');
test('CSV neutraliza fórmulas en ejercicios, agarres y observaciones sin afectar números',()=>{
 const code=`
let result=null,notice='';
const orderedRecords=()=>[{
 date:'2026-10-10',gym:'Test',sede:'Centro',exercise:'=HYPERLINK("https://test.invalid","abrir")',
 grip:'-CMD',notes:' \\t@SUM(1,1)',unit:'kg',weight:25.5,reps:6.5,assistance:1.25
}];
const download=(name,body,mime)=>{result={name,body,mime}};
const dateNow=()=> '2026-10-10';
const toast=text=>{notice=text};
${csvCode}
({run:()=>exportCsv(),out:()=>({result,notice})});
`;
 const h=runInNewContext(code);h.run();
 const out=h.out();
 assert.equal(out.result.name,'Gymlytics_series_2026-10-10.csv');
 assert.ok(out.result.body.startsWith('\ufeff'));
 assert.ok(out.result.body.includes('"'+"'"+'=HYPERLINK('));
 assert.ok(out.result.body.includes('"'+"'"+'-CMD"'));
 assert.ok(out.result.body.includes('"'+"'"+' \\t@SUM(1,1)"'.replace('\\t','\t')));
 assert.ok(out.result.body.includes('"25.5"'));
 assert.ok(out.result.body.includes('"6.5"'));
 assert.match(out.notice,/CSV exportado/);
});
