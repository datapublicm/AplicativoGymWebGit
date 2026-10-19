import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cascadeVariants,availableFields,filterVariants} from '../web/catalog-detail-filter.mjs';
const make=(id,nombre,values)=>({id,nombre,detalles:Object.entries(values).map(([campo,valor])=>({campo,valor}))});
const a=make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Press inclinado',{'Agrupación':'Superior','Anotación':'Pecho','Instrumento':'Smith','Técnica':'Lenta'});
const b=make('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Press inclinado',{'Agrupación':'Superior','Anotación':'Pecho','Máquina':'Mancuerna','Técnica':'Lenta'});
const c=make('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Press inclinado',{'Agrupación':'Superior','Anotación':'Pecho','Máquina':'Mancuerna','Técnica':'Lenta'});
test('Se contabilizan ejercicios homónimos, sin fusionar UUID',()=>{
 const r=cascadeVariants([a,b,c],{'Nombre del ejercicio':'Press inclinado'});
 assert.equal(r.matches.length,3);assert.equal(r.unique,null);
 const m=r.selectors.find(x=>x.field==='Máquina');
 assert.deepEqual(m.options.map(x=>[x.value,x.count]),[['Mancuerna',2],['Smith',1]]);
});
test('Filtrado progresivo habilita Ver solo con identidad única',()=>{
 const r=cascadeVariants([a,b,c],{'Nombre del ejercicio':'Press inclinado','Máquina':'Smith'});
 assert.equal(r.unique.id,a.id);
});
test('Homónimos idénticos pueden diferenciarse por su UUID sin suposiciones',()=>{
 const r=cascadeVariants([a,b,c],{'Nombre del ejercicio':'Press inclinado','Máquina':'Mancuerna'});
 assert.equal(r.matches.length,2);
 assert(r.selectors.some(x=>x.field==='Identificador'));
 const s=cascadeVariants([a,b,c],{'Nombre del ejercicio':'Press inclinado','Máquina':'Mancuerna','Identificador':c.id});
 assert.equal(s.unique.id,c.id);
});
test('Campos adicionales aparecen dinámicamente para buscar variantes',()=>{
 const d=make('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Jalón',{Ángulo:'45 grados'});
 assert(availableFields([d]).includes('Ángulo'));
 assert.equal(filterVariants([a,d],{Ángulo:'45 grados'}).length,1);
});
test('Instrumento histórico es tratado como Máquina sin perder datos',()=>{
 assert.equal(cascadeVariants([a,b],{Máquina:'Smith'}).unique.id,a.id);
});

test('recuento vivo 8 → 7 → 3: TODOS los filtros elegidos muestran el total restante',()=>{
 const data=[
  ...Array.from({length:3},(_,i)=>make('m-'+i,'Curl martillo',{Agrupación:'Tren superior 1',Máquina:'Mancuerna',Técnica:'Neutra'})),
  ...Array.from({length:4},(_,i)=>make('b-'+i,'Curl martillo',{Agrupación:'Tren superior 1',Máquina:'Barra',Técnica:'Neutra'})),
  make('o-1','Curl martillo',{Agrupación:'Tren superior 2',Máquina:'Polea',Técnica:'Neutra'})
 ];
 const counts=r=>Object.fromEntries(r.selectors.filter(x=>x.selected)
  .map(x=>[x.field,x.options.find(o=>o.value===x.selected)?.count]));
 const one=cascadeVariants(data,{'Nombre del ejercicio':'Curl martillo'});
 assert.equal(one.matches.length,8);
 assert.deepEqual(counts(one),{'Nombre del ejercicio':8});
 const two=cascadeVariants(data,{'Nombre del ejercicio':'Curl martillo',Agrupación:'Tren superior 1'});
 assert.equal(two.matches.length,7);
 assert.deepEqual(counts(two),{'Nombre del ejercicio':7,Agrupación:7});
 const three=cascadeVariants(data,{'Nombre del ejercicio':'Curl martillo',Agrupación:'Tren superior 1',Máquina:'Mancuerna'});
 assert.equal(three.matches.length,3);
 assert.deepEqual(counts(three),{'Nombre del ejercicio':3,Agrupación:3,Máquina:3});
 const machine=three.selectors.find(x=>x.field==='Máquina');
 assert.deepEqual(machine.options.map(o=>[o.value,o.count]),[['Barra',4],['Mancuerna',3]]);
});
test('después de filtrar 3, elegir una técnica reduce a 1 y actualiza los demás contadores',()=>{
 const data=[
 make('1','Curl martillo',{Agrupación:'Tren superior 1',Máquina:'Mancuerna',Técnica:'Prono'}),
 make('2','Curl martillo',{Agrupación:'Tren superior 1',Máquina:'Mancuerna',Técnica:'Neutro'}),
 make('3','Curl martillo',{Agrupación:'Tren superior 1',Máquina:'Mancuerna',Técnica:'Neutro'})
 ];
 const result=cascadeVariants(data,{'Nombre del ejercicio':'Curl martillo',Agrupación:'Tren superior 1',Máquina:'Mancuerna',Técnica:'Prono'});
 assert.equal(result.matches.length,1);
 assert.equal(result.unique.id,'1');
 for(const f of ['Nombre del ejercicio','Agrupación','Máquina','Técnica']){
  const sel=result.selectors.find(x=>x.field===f);
  assert.equal(sel.options.find(x=>x.value===sel.selected)?.label.endsWith('(1)'),true,f);
 }
});
