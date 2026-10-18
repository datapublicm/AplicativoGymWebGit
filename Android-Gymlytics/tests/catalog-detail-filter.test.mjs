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
