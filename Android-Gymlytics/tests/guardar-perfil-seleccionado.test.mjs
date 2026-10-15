import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../web/'+name,import.meta.url),'utf8');
const offline=read('offline-first.js'),app=read('app.js');
test('Perfil editable y prueba tienen mensajes diferentes al guardar',()=>{
 assert.match(offline,/const writeStatus=\(\)=>\{/);
 assert.match(offline,/code:'read_only'/);
 assert.match(offline,/code:'ready'/);
 assert.match(offline,/code:'loading'/);
 assert.match(offline,/code:'switching'/);
 assert.match(offline,/code:'error'/);
 assert.match(offline,/const state=writeStatus\(\)/);
 assert.match(offline,/if\(state.code!=='ready'\)throw Error\(state.message\)/);
});
test('Guardar muestra el estado real y un aviso persistente',()=>{
 assert.match(app,/window.GymCloud\?\.getWriteStatus\?\.\(\)\?\.message/);
 assert.match(app,/feedback.textContent=message;feedback.hidden=false/);
 assert.doesNotMatch(app,/Selecciona un perfil local para guardar/);
});
test('Un error en función opcional no inutiliza un perfil ya activado',()=>{
 assert.match(offline,/if\(activeId&&latest&&!transitioning\)\{/);
 assert.match(offline,/window.GymCloud=api;/);
 assert.match(offline,/No se pudo abrir el almacenamiento local/);
});
