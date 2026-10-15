import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url));
function copyPreviewAssets(){return {name:'copy-gymlytics-assets',closeBundle(){
 for(const name of ['app.js','dashboard.js','sw.js','manifest.webmanifest','styles.css'])fs.copyFileSync(path.join(here,'web',name),path.join(here,'dist',name));
 for(const directory of ['assets','icons']){
  const from=path.join(here,'web',directory),to=path.join(here,'dist',directory);
  fs.cpSync(from,to,{recursive:true,force:true});
 }
}};}
export default defineConfig({root:'web',envDir:here,base:'./',plugins:[copyPreviewAssets()],build:{outDir:'../dist',emptyOutDir:true}});
