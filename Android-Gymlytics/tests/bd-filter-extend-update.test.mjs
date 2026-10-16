import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDownloadedCatalog,mergeDownloadedCatalog,emptyCatalogue} from '../web/offline-catalog-download.js';
import {referenceId,setReferenceOverride} from '../web/reference-overrides.js';
const row=(id,zone='Espalda alta y media',technique='01 - Ejecución base')=>({
 id,gimnasio:'Evolution',sede:'VES',instrumento:'Máquina Barra T',
 ejercicio:'Remo en barra T - Agarre prono',accesorio_implemento:'-',
 zona_entrenamiento:zone,tecnica_actualizada:technique,
 musculos_principales:'Dorsal ancho',musculos_secundarios:'Romboides',activo:true
});
const full=base=>prepareDownloadedCatalog({base});
const local=baseCatalog=>({...emptyCatalogue(),baseCatalog,pending:[],
 tombstones:[],conflicts:[],referenceOverrides:{}});
test('La nueva anotación/zona se actualiza automáticamente cuando la referencia no fue editada',()=>{
 const before=full([row('id-1','Espalda media')]),after=full([row('id-1','Espalda alta y media')]);
 const updated=mergeDownloadedCatalog(local(before.baseCatalog),after);
 assert.equal(updated.baseCatalog.length,1);
 assert.equal(updated.baseCatalog[0].z,'Espalda alta y media');
 assert.equal(updated.baseCatalog[0].cloud_base_id,'id-1');
});
test('No modificar músculos al renovar solo BD_Filter_Extend',()=>{
 const before=full([row('id-1','Zona antigua')]),after=full([row('id-1','Zona nueva')]);
 const updated=mergeDownloadedCatalog(local(before.baseCatalog),after);
 assert.equal(updated.baseCatalog[0].m,'Dorsal ancho');
 assert.equal(updated.baseCatalog[0].ms,'Romboides');
});
test('Las variantes de técnica nuevas no se pierden aunque coincida todo lo demás',()=>{
 const before=full([row('id-1')]);
 const after=full([row('id-1'),row('id-2','Espalda alta y media','06 - Controlado (Nivel A, 8-10 seg)')]);
 const updated=mergeDownloadedCatalog(local(before.baseCatalog),after);
 assert.equal(updated.baseCatalog.length,2);
 assert.ok(updated.baseCatalog.some(x=>x.t[0].startsWith('06 -')));
});
test('Una referencia antigua desactivada desaparece de selecciones sin borrar entrenamientos',()=>{
 const before=full([row('id-retirado'),row('id-conservado','Pectoral')]);
 const after=full([row('id-conservado','Pectoral')]);
 const profile=local(before.baseCatalog);
 profile.records=[{id:'serie-1',exercise:'Remo en barra T - Agarre prono'}];
 const merged=mergeDownloadedCatalog(profile,after);
 assert.deepEqual(merged.baseCatalog.map(x=>x.cloud_base_id),['id-conservado']);
 assert.equal(profile.records[0].id,'serie-1');
});
test('Un cambio local de referencia se conserva incluso cuando la nube la retira',()=>{
 const before=full([row('id-retirado')]);
 const profile=local(before.baseCatalog);
 profile.referenceOverrides=setReferenceOverride(profile.baseCatalog,{},
  referenceId('zone','Espalda alta y media'),{name:'Mi zona'});
 const merged=mergeDownloadedCatalog(profile,full([]));
 assert.equal(merged.baseCatalog.length,1);
 assert.equal(merged.catalogWarnings[0].kind,'reference_conflict');
});
test('La modificación directa heredada de ejercicio no se sobrescribe',()=>{
 const before=full([row('id-1','Zona anterior')]),after=full([row('id-1','Zona nueva')]);
 const profile=local(before.baseCatalog);
 profile.baseCatalog[0].e='Ejercicio personalizado heredado';
 const merged=mergeDownloadedCatalog(profile,after);
 assert.equal(merged.baseCatalog[0].e,'Ejercicio personalizado heredado');
 assert.equal(merged.catalogWarnings[0].kind,'reference_conflict');
});
test('Fila con guion como ejercicio no se importa a los selectores',()=>{
 const parsed=full([{...row('id-guion'),ejercicio:'-'}]);
 assert.equal(parsed.baseCatalog.length,0);
});
test('No se pierde una referencia creada solamente en el perfil offline',()=>{
 const before=local([{g:'Personal',s:'Casa',e:'Ejercicio personal',i:'Mancuerna',z:'Brazo',t:['Base']}]);
 const merged=mergeDownloadedCatalog(before,full([row('id-1')]));
 assert.equal(merged.baseCatalog.length,2);
});
