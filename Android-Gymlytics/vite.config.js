import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url));
function copyPreviewAssets(){return {name:'copy-gymlytics-assets',closeBundle(){
 const required=['app.js','dashboard.js','offline-first.js','gymlytics-seed-offline.mjs','offline-catalog-download.js','catalog-sync-engine.js','reference-overrides.js','photo-sync-engine.js','profile-policy.js','cloud-sync.js','sync-engine.js','legacy-compat.js','sw.js','manifest.webmanifest','styles.css'];
 for(const name of required)fs.copyFileSync(path.join(here,'web',name),path.join(here,'dist',name));
 for(const directory of ['assets','icons','data']){
  const from=path.join(here,'web',directory),to=path.join(here,'dist',directory);
  fs.cpSync(from,to,{recursive:true,force:true});
 }
 const seed=JSON.parse(fs.readFileSync(path.join(here,'dist','data','hojamatriz-offline-20261018.json'),'utf8'));
 if(seed?.tables?.series?.length!==9424||seed?.tables?.session?.length!==446)
  throw Error('La importación HojaMatriz no coincide con los 9424 registros aprobados');
 // Incluir en la caché inicial los bundles con hash generados por Vite.
 // De otro modo, tras instalar y perder Internet antes del segundo arranque
 // IndexedDB seguiría intacta, pero no se podría ejecutar la interfaz.
 const dist=path.join(here,'dist'),assetDir=path.join(dist,'assets');
 const chunks=fs.readdirSync(assetDir)
  .filter(name=>['js','css'].includes(name.split('.').pop()))
  .map(name=>'./assets/'+name);
 if(!chunks.length||!chunks.some(name=>name.endsWith('.js')))
  throw Error('No se generaron scripts aptos para funcionar offline');
 const swPath=path.join(dist,'sw.js'),worker=fs.readFileSync(swPath,'utf8');
 if(!worker.includes('const STATIC_URLS='))throw Error('Falta el manifiesto de Service Worker');
 fs.writeFileSync(swPath,worker.replace('const STATIC_URLS=',
  'ASSETS.push(...'+JSON.stringify(chunks)+');'+String.fromCharCode(10)+'const STATIC_URLS='));
 // No entregar otra APK con una interfaz distinta a la aprobada en apk/pruebas.
 const page=fs.readFileSync(path.join(here,'dist','index.html'),'utf8');
 for(const marker of ['gym-mock-header','mockup-catalog','catalogCompactRows','registro-compact-panel','exerciseTabs','seriesRows','dash-resumen']){
  if(!page.includes(marker))throw Error('La web empaquetada no incluye la pantalla aprobada: '+marker);
 }
 for(const name of ['app.js','dashboard.js','styles.css']){
  const source=fs.readFileSync(path.join(here,'web',name));
  const output=fs.readFileSync(path.join(here,'dist',name));
  if(!source.equals(output))throw Error('El APK empaquetaría una versión antigua de '+name);
 }
}};}
export default defineConfig({root:'web',envDir:here,base:'./',plugins:[copyPreviewAssets()],build:{outDir:'../dist',emptyOutDir:true}});
