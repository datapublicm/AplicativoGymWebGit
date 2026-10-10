import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>readFileSync(path.join(root,f),'utf8');
const files=dir=>readdirSync(dir).flatMap(n=>{
  const p=path.join(dir,n);
  return statSync(p).isDirectory()?files(p):p.endsWith('.js')?[p]:[];
});

test('La web Hostinger posee entrada y hojas de estilo propias',()=>{
  const html=read('index.html');
  assert.match(html,/src=["']\.\/main\.js/);
  assert.match(html,/href=["']\.\/styles\.css/);
  assert.ok(existsSync(path.join(root,'main.js')));
  assert.ok(existsSync(path.join(root,'styles.css')));
});
test('Todos los imports relativos JavaScript resuelven dentro del proyecto web',()=>{
  let checked=0;
  for(const file of files(root)){
    const src=readFileSync(file,'utf8');
    const re=/\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g;
    for(const match of src.matchAll(re)){
      const relative=(match[1]||match[2]).split(/[?#]/)[0];
      const target=fileURLToPath(new URL(relative,pathToFileURL(file)));
      assert.ok(target.startsWith(path.resolve(root)+path.sep),'Import fuera de Web-Hostinger: '+relative);
      assert.ok(existsSync(target),'Import ausente: '+path.relative(root,file)+' => '+relative);
      checked++;
    }
  }
  assert.ok(checked>5,'No se inspeccionaron suficientes imports');
});
test('Los modelos 3D están referenciados, pero su entrega requiere un paso adicional',()=>{
  const variants=read('domain/bodyVariants.js');
  assert.match(variants,/models\/human-muscle-male-v05\.glb/);
  assert.match(variants,/models\/human-muscle-female-v05\.glb/);
  // Su ausencia no es un fallo de sintaxis: se necesita un proceso de generación antes de publicar.
});
