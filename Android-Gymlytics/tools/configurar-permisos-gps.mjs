import fs from 'node:fs';
const file='android/app/src/main/AndroidManifest.xml';
if(!fs.existsSync(file))throw Error('AndroidManifest.xml no generado');
let manifest=fs.readFileSync(file,'utf8');
if(!manifest.includes('<manifest')||!manifest.includes('<application'))throw Error('Manifest inválido');
for(const name of ['android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION']){
 if(!manifest.includes(name))
  manifest=manifest.replace('<application','<uses-permission android:name="'+name+'"/><application');
}
fs.writeFileSync(file,manifest);
for(const name of ['android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION'])
 if(!fs.readFileSync(file,'utf8').includes(name))throw Error('Permiso GPS ausente: '+name);
console.log('Manifest GPS preparado (fino y aproximado).');
