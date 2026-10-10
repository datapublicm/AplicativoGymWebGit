import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('Nuevo gimnasio, sede, máquina y ejercicio se vinculan solo en Registro',()=>{
  const a=app.indexOf('function allCatalog(){');
  const b=app.indexOf('function techniqueDescription(',a);
  assert.ok(a>=0&&b>a);
  const logic=app.slice(a,b);
  const setup=`
const FLOW=[['g','gimnasio'],['s','sede'],['z','zona'],['kind','tipo'],['i','instrumento'],['a','implemento'],['gr','agarre'],['e','ejercicio'],['t','tecnica']];
const names={g:'',s:'',z:'',kind:'',i:'',a:'',gr:'',e:'',t:''},available={};
const window={
 GymBaseCatalog:[{g:'Smart Fit',s:'Sede histórica',z:'Espalda',kind:'Máquina',
 i:'Polea',a:'No especificado',gr:'No especificado',e:'Jalón',t:['Base'],m:'Dorsal',ms:'Braquial',n:4,last:null}],
 GymCustomCatalog:[],
 GymEntities:{gyms:[{id:'g-1',nombre:'Gimnasio nuevo'}],
 sites:[{gimnasio_id:'g-1',nombre:'Sede nueva'}],
 machines:[{tipo_equipo:'Máquina',nombre:'Máquina nueva'}],
 options:[{tipo:'zona',nombre:'Zona adicional'},{tipo:'accesorio',nombre:'Accesorio nuevo'},
 {tipo:'agarre',nombre:'Agarre nuevo'},{tipo:'tecnica',nombre:'Técnica nueva'}]},
 GymExerciseLibrary:[{nombre:'Ejercicio nuevo',zona_entrenamiento:'Brazo',
 tecnica_actualizada:'Ejecución base',musculos_principales:[],musculos_secundarios:[]}]
};
const uniq=arr=>[...new Set(arr.filter(Boolean))];
const getValue=k=>names[k];
const fillSelect=(id,choices,preferred)=>{const key=FLOW.find(v=>v[1]===id)[0];available[key]=choices;names[key]=
 [preferred,names[key],choices[0]].find(v=>choices.includes(v))||''};
const fillTypes=(choices,preferred)=>{available.kind=choices;names.kind=[preferred,names.kind,choices[0]].find(v=>choices.includes(v))||''};
const updateDetailState=()=>{};
`;
  const m=runInNewContext(setup+logic+`({cascade,chosenRow,names,available})`);
  m.cascade(0,{g:'Gimnasio nuevo',s:'Sede nueva',z:'Brazo',kind:'Máquina',i:'Máquina nueva',a:'No especificado',gr:'No especificado',e:'Ejercicio nuevo',t:'Ejecución base'});
  const v=m.chosenRow();
  assert.equal(v.g,'Gimnasio nuevo');
  assert.equal(v.s,'Sede nueva');
  assert.equal(v.i,'Máquina nueva');
  assert.equal(v.e,'Ejercicio nuevo');
  assert.equal(v.z,'Brazo');
  assert.ok(m.available.e.includes('Ejercicio nuevo'));
  m.cascade(0,{g:'Gimnasio nuevo',s:'Sede nueva',z:'Zona adicional',kind:'Máquina',
    i:'Máquina nueva',a:'Accesorio nuevo',gr:'Agarre nuevo',e:'Ejercicio nuevo',t:'Técnica nueva'});
  assert.equal(m.chosenRow().a,'Accesorio nuevo');
  assert.equal(m.chosenRow().gr,'Agarre nuevo');
  assert.equal(m.chosenRow().t[0],'Técnica nueva');
});
test('El usuario puede seleccionar sede No registrado sin crearla en Catálogos',()=>{
 const a=app.indexOf('function allCatalog(){');
 const b=app.indexOf('function techniqueDescription(',a);
 assert.ok(a>=0&&b>a);
 const source=app.slice(a,b);
 assert.ok(source.includes("'No registrado'"));
});
