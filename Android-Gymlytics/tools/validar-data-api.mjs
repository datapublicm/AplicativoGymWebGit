// Prueba de solo lectura contra Supabase Pruebas. Node 22+, sin instalar paquetes.
// Las credenciales de cuentas de prueba se proporcionan por variables de entorno.
const project='jasuqnxrskhqfobsazwd';
const endpoint='https://'+project+'.supabase.co';
const schema='sch_android_gymlytics';
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
const host=process.env.VITE_SUPABASE_URL||endpoint;
if(host!==endpoint)throw Error('Bloqueado: únicamente se permite ProyectosPrueba');
if(!key || !(/^(sb_publishable_|eyJ)/.test(key)))throw Error('Falta clave publicable de Pruebas');
if(process.env.VITE_SUPABASE_SCHEMA && process.env.VITE_SUPABASE_SCHEMA!==schema)throw Error('Esquema incorrecto');

async function request(path,{method='GET',token=null,body,profile=false,preferCount=false}={}){
 const headers={apikey:key,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(profile)headers['Accept-Profile']=schema;
 if(preferCount)headers.Prefer='count=exact';
 const response=await fetch(endpoint+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 let data=null;try{data=await response.json()}catch{}
 if(data?.code==='PGRST106')throw Error('El esquema Gymlytics NO está expuesto en PostgREST');
 return {status:response.status,data,range:response.headers.get('content-range')};
}
function success(r,operation){
 if(r.status!==200&&r.status!==206)throw Error(operation+': HTTP '+r.status);
 if(!Array.isArray(r.data))throw Error(operation+': respuesta inesperada');
}
async function login(email,password){
 const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 if(r.status!==200 || !r.data?.access_token)throw Error('Login de correo: HTTP '+r.status);
 return r.data.access_token;
}
async function getUid(token){
 const r=await request('/auth/v1/user',{token});
 if(r.status!==200||!r.data?.id)throw Error('Identidad Auth no válida: HTTP '+r.status);
 return r.data.id;
}
async function ownHistory(token,uid){
 const p='/rest/v1/';
 const profile=await request(p+'tbl_usuarios?select=id,activo&id=eq.'+encodeURIComponent(uid),{token,profile:true});
 success(profile,'Perfil');
 if(profile.data.length!==1||profile.data[0].activo!==true)throw Error('Perfil Gymlytics no autorizado');
 const h=await request(p+'vw_historial_series?select=user_id&user_id=eq.'+encodeURIComponent(uid)+'&limit=1',{token,profile:true,preferCount:true});
 success(h,'Historial');
 if(h.data.some(x=>x.user_id!==uid))throw Error('Filtración de historial');
 const total=Number(h.range?.split('/').at(-1));
 if(!Number.isFinite(total))throw Error('No se recibió recuento exacto');
 return total;
}
async function cannotReadOther(token,uid){
 const r=await request('/rest/v1/vw_historial_series?select=id&user_id=eq.'+encodeURIComponent(uid)+'&limit=1',{token,profile:true});
 success(r,'Aislamiento RLS');
 if(r.data.length)throw Error('ALERTA: una cuenta recuperó información de otra');
}
// Una API key inexistente o inválida no debe presentarse como éxito de RLS.
const health=await request('/auth/v1/health');
if(health.status!==200||!['GoTrue','Auth'].includes(health.data?.name))
 throw Error('Clave publicable no validada o Auth inaccesible: HTTP '+health.status);
console.log('✓ Servicio Auth respondió 200 con la clave publicable de Pruebas.');
const anon=await request('/rest/v1/tbl_usuarios?select=id&limit=1',{profile:true});
if(anon.status===200 && Array.isArray(anon.data)&&anon.data.length)throw Error('ALERTA: perfil accesible sin sesión');
if(![200,401,403].includes(anon.status))throw Error('Preflight Data API: HTTP '+anon.status);
console.log('✓ Configuración de acceso anónimo revisada (sin leer perfiles)');
const emailA=process.env.GYMLYTICS_TEST_EMAIL_A,passwordA=process.env.GYMLYTICS_TEST_PASSWORD_A;
if(Boolean(emailA)!==Boolean(passwordA))throw Error('Correo y contraseña A deben definirse juntos');
if(emailA){
 const tokenA=await login(emailA,passwordA),uidA=await getUid(tokenA);
 const totalA=await ownHistory(tokenA,uidA);
 console.log('✓ Cuenta A autenticada y recuento privado de series:',totalA);
 const username=process.env.GYMLYTICS_TEST_USERNAME_A;
 if(username){
  const u=await request('/functions/v1/gymlytics-login-usuario',{method:'POST',body:{username,password:passwordA}});
  if(u.status!==200||!u.data?.access_token)throw Error('Login por usuario: HTTP '+u.status);
  if(await getUid(u.data.access_token)!==uidA)throw Error('Login por usuario devolvió otra identidad');
  console.log('✓ Inicio de sesión por nombre de usuario');
 }
 const emailB=process.env.GYMLYTICS_TEST_EMAIL_B,passwordB=process.env.GYMLYTICS_TEST_PASSWORD_B;
 if(Boolean(emailB)!==Boolean(passwordB))throw Error('Correo y contraseña B deben definirse juntos');
 if(emailB){
  const tokenB=await login(emailB,passwordB),uidB=await getUid(tokenB);
  if(uidA===uidB)throw Error('A y B no son cuentas distintas');
  const totalB=await ownHistory(tokenB,uidB);
  await Promise.all([cannotReadOther(tokenA,uidB),cannotReadOther(tokenB,uidA)]);
  console.log('✓ Aislamiento cruzado comprobado, series cuenta B:',totalB);
 }else console.log('— Aislamiento entre dos cuentas pendiente: faltan credenciales B de prueba');
}else console.log('— Integración autenticada pendiente: sin cuentas de prueba configuradas');
console.log('✓ Verificación completada sin escribir registros ni compilar APK');
