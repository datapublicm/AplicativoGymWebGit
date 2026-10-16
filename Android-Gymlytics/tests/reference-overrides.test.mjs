import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceId,parseReferenceId,referenceKey,listReferenceChoices,materializeReferenceCatalog,setReferenceOverride} from '../web/reference-overrides.js';
const rows=[
 {cloud_base_id:'a',g:'Smart Fit',s:'La Rambla',z:'Espalda',kind:'Máquina',i:'Polea',a:'Cable',gr:'Prono',e:'Jalón al pecho',t:['Controlado'],m:'Dorsal',ms:'Bíceps'},
 {cloud_base_id:'b',g:'Smart Fit',s:'Plaza Norte',z:'Brazo',kind:'Implemento libre',i:'Mancuerna',a:'Mancuerna',gr:'Neutro',e:'Curl martillo',t:['Controlado'],m:'Braquial',ms:'Antebrazo'},
 {cloud_base_id:'c',g:'Evolution',s:'La Rambla',z:'Espalda',kind:'Máquina',i:'Polea',a:'Cable',gr:'Prono',e:'Jalón al pecho',t:['Controlado'],m:'Dorsal',ms:'Bíceps'}
];
const gym=referenceId('gym','Smart Fit'),site=referenceId('site','La Rambla','Smart Fit');
test('Cada referencia usa ID estable de origen',()=>{
 assert.equal(parseReferenceId(gym).kind,'gym');
 assert.equal(parseReferenceId(site).gym,'Smart Fit');
 assert.equal(parseReferenceId(site).key,referenceKey('site','La Rambla','Smart Fit'));
 assert.equal(parseReferenceId('base:invalido'),null);
});
test('Renombrar un gimnasio reemplaza su nombre en vista local y conserva sedes',()=>{
 const map=setReferenceOverride(rows,{},gym,{name:'Smart Fit Gold'});
 const current=materializeReferenceCatalog(rows,map);
 assert.deepEqual(current.map(x=>x.g),['Smart Fit Gold','Smart Fit Gold','Evolution']);
 assert.deepEqual(current.filter(x=>x.g==='Smart Fit Gold').map(x=>x.s),['La Rambla','Plaza Norte']);
 assert.equal(rows[0].g,'Smart Fit');
 const choices=listReferenceChoices(rows,map,'gym');
 assert.equal(choices.find(x=>x.id===gym).name,'Smart Fit Gold');
});
test('Seleccionar un gimnasio muestra sólo sus sedes, aunque cambió de nombre',()=>{
 const map=setReferenceOverride(rows,{},gym,{name:'Smart Fit Gold'});
 assert.deepEqual(listReferenceChoices(rows,map,'site',{gymId:gym}).map(x=>x.name),['La Rambla','Plaza Norte']);
 assert.deepEqual(listReferenceChoices(rows,map,'site',{gymName:'Evolution'}).map(x=>x.name),['La Rambla']);
});
test('Modificar una sede sólo afecta al gimnasio asociado',()=>{
 const map=setReferenceOverride(rows,{},site,{name:'Rambla Nueva'});
 const current=materializeReferenceCatalog(rows,map);
 assert.equal(current.find(x=>x.g==='Smart Fit'&&x.e==='Jalón al pecho').s,'Rambla Nueva');
 assert.equal(current.find(x=>x.g==='Evolution').s,'La Rambla');
 assert.equal(listReferenceChoices(rows,map,'site',{gymId:gym}).find(x=>x.name==='Rambla Nueva').id,site);
});
test('Eliminar una sede no borra otras sedes ni modifica el catálogo base',()=>{
 const map=setReferenceOverride(rows,{},site,{deleted:true});
 const current=materializeReferenceCatalog(rows,map);
 assert.equal(current.length,2);
 assert.equal(current.some(x=>x.g==='Evolution'&&x.s==='La Rambla'),true);
 assert.equal(rows.length,3);
});
test('Eliminar gimnasio oculta sus referencias descendientes',()=>{
 const map=setReferenceOverride(rows,{},gym,{deleted:true});
 const current=materializeReferenceCatalog(rows,map);
 assert.equal(current.length,1);
 assert.equal(current[0].g,'Evolution');
 assert.equal(listReferenceChoices(rows,map,'site',{gymId:gym}).length,0);
});
test('Instrumento y ejercicio se modifican sin alterar identificadores',()=>{
 let map=setReferenceOverride(rows,{},referenceId('machine','Polea'),{name:'Máquina polea nueva'});
 map=setReferenceOverride(rows,map,referenceId('exercise','Jalón al pecho'),{name:'Jalón prono'});
 const current=materializeReferenceCatalog(rows,map);
 assert.equal(current[0].i,'Máquina polea nueva');
 assert.equal(current[2].e,'Jalón prono');
 assert.equal(rows[2].e,'Jalón al pecho');
 assert.equal(listReferenceChoices(rows,map,'exercise').find(x=>x.name==='Jalón prono').id,referenceId('exercise','Jalón al pecho'));
});
test('Técnicas y agarres reemplazan su texto de origen sólo en vista',()=>{
 let map=setReferenceOverride(rows,{},referenceId('technique','Controlado'),{name:'Lento (3 seg)'});
 map=setReferenceOverride(rows,map,referenceId('grip','Prono'),{name:'Prono ancho'});
 const current=materializeReferenceCatalog(rows,map);
 assert.deepEqual(current[0].t,['Lento (3 seg)']);
 assert.equal(current[0].gr,'Prono ancho');
 assert.equal(rows[0].t[0],'Controlado');
});
test('No permite duplicar dos referencias al modificar',()=>{
 assert.throws(()=>setReferenceOverride(rows,{},gym,{name:'Evolution'}),/Ya existe/);
});
test('Cada perfil mantiene sus reglas independientes',()=>{
 const a=setReferenceOverride(rows,{},gym,{name:'Uno'});
 const b=setReferenceOverride(rows,{},gym,{name:'Dos'});
 assert.equal(materializeReferenceCatalog(rows,a)[0].g,'Uno');
 assert.equal(materializeReferenceCatalog(rows,b)[0].g,'Dos');
});
test('Volver al nombre original retira la sustitución',()=>{
 const modified=setReferenceOverride(rows,{},gym,{name:'Temporal'});
 const restored=setReferenceOverride(rows,modified,gym,{name:'Smart Fit'});
 assert.deepEqual(restored,{});
 assert.equal(materializeReferenceCatalog(rows,restored)[0].g,'Smart Fit');
});
test('Identificadores invalidos o ajenos no se modifican',()=>{
 assert.throws(()=>setReferenceOverride(rows,{},referenceId('site','No existe','Smart Fit'),{deleted:true}),/no pertenece/);
 assert.throws(()=>setReferenceOverride(rows,{},'base:abc',{name:'Otro'}),/no pertenece/);
});
