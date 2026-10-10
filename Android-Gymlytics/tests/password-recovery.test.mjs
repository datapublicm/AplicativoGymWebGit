import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function harness({native=false}={}){
 const src=readFileSync(new URL('../web/auth-cloud.js',import.meta.url),'utf8');
 const from=src.indexOf('let recoveryMode=false;');
 const until=src.indexOf("$('authLogout').addEventListener",from);
 assert.ok(from>=0&&until>from,'Se encuentra el flujo de recuperación');
 const logic=src.slice(from,until);
 const setup=`
let authEpoch=7,pendingAuthId='old',pendingAuthPromise=Promise.resolve(),signedIn={id:'old'};
let emailCalls=[],passwordCalls=[],statuses=[],pages=[],resumed=0;
const model={records:[{id:'old'}],photos:{old:'photo'}};
const drawRecent=()=>{},drawHistory=()=>{},drawReports=()=>{};
const listeners={};
const elements={};
const $=id=>(elements[id]??=( {hidden:false,disabled:false,value:'',
 textContent:'',addEventListener(type,fn){listeners[id+':'+type]=fn;} }));
$('authEmail').value='persona@example.test';
$('passwordResetNew').value='ClaveSuperSegura2026!';
$('passwordResetConfirm').value='ClaveSuperSegura2026!';
const config={recoveryUrl:${native?'null':"'https://gym.example.test/app/'"}};
const resolveRecoveryUrl=v=>v;
const window={location:{protocol:'https:',hostname:'${native?'localhost':'gym.example.test'}',
 origin:'https://${native?'localhost':'gym.example.test'}',pathname:'/app/'}};
const client={auth:{
 resetPasswordForEmail:async(email,options)=>{emailCalls.push({email,options});return {error:null};},
 updateUser:async(value)=>{passwordCalls.push(value);return {error:null};},
 getSession:async()=>({data:{session:{user:{id:'test-id'}}}})}};
const document={body:{classList:{add(){}}},querySelectorAll(){return [{dataset:{page:'sesion'},setAttribute(){}},{dataset:{page:'registro'},setAttribute(){}}]}};
const setStatus=msg=>statuses.push(msg);
const showPage=page=>pages.push(page);
const updateState=async()=>{resumed++;};
`;
 return runInNewContext(setup+logic+`({
  elements,listeners,enterPasswordResetMode,values:()=>({emailCalls,passwordCalls,statuses,pages,resumed,recoveryMode}),
  setPasswords:(a,b)=>{$('passwordResetNew').value=a;$('passwordResetConfirm').value=b;},
  clickRecovery:()=>listeners['authRecovery:click'](),
  submitPassword:()=>listeners['passwordResetForm:submit']({preventDefault(){}})
 })`);
}
test('Solicitar recuperación no envía correos por sí sola',()=>{
 const h=harness();
 assert.equal(h.values().emailCalls.length,0);
 assert.equal(h.values().passwordCalls.length,0);
});
test('Recuperación web pide enlace al origen HTTPS, sin revelar cuentas',async()=>{
 const h=harness();
 await h.clickRecovery();
 assert.equal(h.values().emailCalls.length,1);
 assert.equal(h.values().emailCalls[0].options.redirectTo,'https://gym.example.test/app/');
 assert.ok(h.values().statuses.at(-1).startsWith('Si el correo corresponde'));
});
test('APK sin URL de retorno HTTPS configurada no envía enlaces',async()=>{
 const h=harness({native:true});
 await h.clickRecovery();
 assert.equal(h.values().emailCalls.length,0);
 assert.ok(h.values().statuses.at(-1).includes('aún no está configurada'));
});
test('Enlace de recuperación: se valida confirmación antes de cambiar contraseña',async()=>{
 const h=harness();
 h.enterPasswordResetMode();
 assert.equal(h.elements.passwordResetPanel.hidden,false);
 assert.equal(h.elements.authForm.hidden,true);
 h.setPasswords('ClaveSuperSegura2026!','Distinta1234!!');
 await h.submitPassword();
 assert.equal(h.values().passwordCalls.length,0);
 h.setPasswords('ClaveSuperSegura2026!','ClaveSuperSegura2026!');
 await h.submitPassword();
 assert.equal(h.values().passwordCalls.length,1);
 assert.equal(h.values().resumed,1);
 assert.equal(h.values().recoveryMode,false);
 assert.equal(h.elements.passwordResetPanel.hidden,true);
});
