// Verificación HTTP pública de Supabase Pruebas desde GitHub Actions.
// Solo comprueba salud de Auth; NO autentica usuarios ni consulta sus datos.
const endpoint='https://jasuqnxrskhqfobsazwd.supabase.co/auth/v1/health';
try{
 const response=await fetch(endpoint,{
  method:'GET',headers:{Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(12000)
 });
 if(response.status===401||response.status===403){
  console.log('✓ HTTP '+response.status+': gateway de Supabase Pruebas alcanzable.');
  console.log('— La solicitud no contiene API key; no se confirma salud de Auth ni inicio de sesión.');
 }else if(response.status!==200){
  console.error('Gateway respondió HTTP '+response.status+'; conectividad o salud no confirmadas.');
  process.exitCode=1;
 }else{
  const body=await response.json();
  if(!body||typeof body!=='object'||!['GoTrue','Auth'].includes(body.name)){
   console.error('Health respondió 200 pero sin identidad de servicio conocida.');
   process.exitCode=1;
  }else{
   console.log('✓ HTTP 200: servicio Auth de ProyectosPrueba responde correctamente.');
   console.log('— No se intentó iniciar sesión ni leer información de usuarios.');
  }
 }
}catch(error){
 console.error('Salud Auth no verificada: '+String(error.name||error).slice(0,100));
 process.exitCode=1;
}
