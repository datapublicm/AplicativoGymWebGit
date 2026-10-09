import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url));
function copyPreviewAssets(){return {name:'copy-gymlog-assets',closeBundle(){
 for(const name of ['app.js','catalogo.js','sw.js','manifest.webmanifest'])
   fs.copyFileSync(path.join(here,'web',name),path.join(here,'dist',name));
 for(const directory of ['assets','icons']) {
   fs.cpSync(path.join(here,'web',directory),path.join(here,'dist',directory),{recursive:true,force:true});
 }
}};}
export default defineConfig({root:'web',envDir:here,base:'./',plugins:[copyPreviewAssets()],build:{outDir:'../dist',emptyOutDir:true}});
