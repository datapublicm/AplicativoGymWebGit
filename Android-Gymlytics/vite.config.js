import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url));
function copyPreviewAssets(){return {name:'copy-gymlytics-assets',closeBundle(){
 const required=['app.js','dashboard.js','sw.js','manifest.webmanifest','styles.css'];
 for(const name of required)fs.copyFileSync(path.join(here,'web',name),path.join(here,'dist',name));
 for(const directory of ['assets','icons']){
  const from=path.join(here,'web',directory),to=path.join(here,'dist',directory);
  fs.cpSync(from,to,{recursive:true,force:true});
 }
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
