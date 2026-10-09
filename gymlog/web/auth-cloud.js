import { createClient } from '@supabase/supabase-js';

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  schema: import.meta.env.VITE_SUPABASE_SCHEMA || 'sch_android_gymlog',
  environment: import.meta.env.VITE_GYMLOG_ENVIRONMENT || 'pruebas'
};
const ready = !!config.url && !!config.key && !config.key.includes('COLOCA_AQUI');
const client = ready ? createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
const db = client?.schema(config.schema);
let signedIn = null;
const $ = id => document.getElementById(id);
const setStatus = message => { $('authStatus').textContent = message; };
const must = (data,error) => { if(error) throw error; return data; };
const owns = () => !!signedIn?.id;

async function assertGymLogAccess(user) {
  const {data,error} = await db.from('tbl_usuarios').select('id,usuario,nombre,rol,activo').eq('id',user.id).maybeSingle();
  if(error) throw new Error('GymLog no está disponible en la API del proyecto: '+error.message);
  if(!data?.activo) throw new Error('Tu cuenta no tiene acceso activo a GymLog.');
  return data;
}
async function updateState(session) {
  const user=session?.user || null;
  signedIn = null;
  if(user) {
    try { const profile=await assertGymLogAccess(user); signedIn={...user,gymlog:profile}; }
    catch(error){setStatus(error.message);}
  }
  document.body.classList.toggle('auth-locked',!owns());
  document.querySelectorAll('[data-page]').forEach(b=>{
    if(b.dataset.page!=='sesion'){b.disabled=!owns();b.setAttribute('aria-disabled',String(!owns()));}
  });
  const logged=owns();$('authForm').hidden=logged;$('authRegister').hidden=logged;$('authRecovery').hidden=logged;
  $('authProfile').hidden=!logged;
  if(logged){
    $('loggedUser').textContent=signedIn.gymlog.nombre||signedIn.gymlog.usuario;
    $('loggedEmail').textContent=signedIn.email;
    setStatus('Sesión activa · Supabase '+config.environment);
    try {
      window.GymCustomCatalog=await cloud.loadOwnCatalog();
      if(typeof cascade==='function')cascade(0);
      if(typeof renderOwnCatalog==='function')renderOwnCatalog();
      model.records=await cloud.loadHistory();drawRecent();drawHistory();drawReports();
      await cloud.loadCatalogStats();
    }
    catch(error){setStatus('Sesión activa; error al cargar datos: '+error.message);}
  } else {window.GymCustomCatalog=[];model.records=[];model.photos={};drawRecent();drawHistory();drawReports();}
  showPage('sesion');
}
async function findOrCreate(table,fields,insertExtra={}) {
  let q=db.from(table).select('id');
  Object.entries(fields).forEach(([k,v])=>{q=v===null?q.is(k,null):q.eq(k,v);});
  const {data,error}=await q.limit(1).maybeSingle();
  if(error) throw error;
  if(data?.id)return data.id;
  const {data:newRow,error:insertErr}=await db.from(table).insert({...fields,...insertExtra}).select('id').single();
  if(insertErr) throw insertErr;
  return newRow.id;
}
const cloud={
 canWrite:()=>owns(),
 async ensureExercise(exercise,technique=''){
  if(!owns())throw Error('La sesión no está autorizada');
  const user_id=signedIn.id;
  const gimnasio_id=await findOrCreate('tbl_gimnasios',{user_id,nombre:exercise.g});
  const sede_id=await findOrCreate('tbl_sedes',{user_id,gimnasio_id,nombre:exercise.s});
  const fields={user_id,origen:'usuario',gimnasio_id,sede_id,nombre:exercise.e,
    instrumento:exercise.i,tecnica_actualizada:technique||exercise.t?.[0]||'Ejecución base'};
  const ejercicio_id=await findOrCreate('tbl_ejercicios',fields,{
    tipo_equipo:exercise.kind||'Otro',zona_entrenamiento:exercise.z||'',accesorio:exercise.a||'',
    agarre:exercise.gr||'',implemento:exercise.a||''});
  return {user_id,gimnasio_id,sede_id,ejercicio_id};
 },
 async saveWorkout({exercise,date,technique,notes,entries}) {
  const ids=await this.ensureExercise(exercise,technique);
  const p_series=entries.map(x=>({
   numero_serie:Number(x.series.match(/\d+/)?.[0]||0),
   subdivision:x.sub==='-'?null:x.sub,unidad:x.unit,
   peso:Number(x.weight),repeticiones:Number(x.reps),asistencias:Number(x.assistance||0)
  }));
  must(null,(await db.rpc('guardar_entrenamiento',{
   p_fecha:date,p_gimnasio_id:ids.gimnasio_id,p_sede_id:ids.sede_id,
   p_ejercicio_id:ids.ejercicio_id,p_tecnica:technique,p_observaciones:notes,p_series
  })).error);
 },
 async deleteSeries(id){if(!owns())throw Error('Sin sesión');must(null,(await db.from('tbl_series').delete().eq('id',id).eq('user_id',signedIn.id)).error);},
 async loadHistory(){
  if(!owns())return [];
  const user_id=signedIn.id;
  const tables=['tbl_reportes','tbl_series','tbl_ejercicios','tbl_gimnasios','tbl_sedes'];
  const results=await Promise.all(tables.map(t=>{
   const q=db.from(t).select('*');return t==='tbl_ejercicios'?q:q.eq('user_id',user_id);
  }));
  results.forEach(r=>must(r.data,r.error));
  const [reportes,series,ejercicios,gimnasios,sedes]=results.map(r=>r.data||[]);
  const index=values=>new Map(values.map(v=>[v.id,v]));
  const rm=index(reportes),em=index(ejercicios),gm=index(gimnasios),sm=index(sedes);
  return series.flatMap(s=>{
   const r=rm.get(s.reporte_id);if(!r)return [];
   const e=em.get(r.ejercicio_id),gym=gm.get(r.gimnasio_id),sede=sm.get(r.sede_id);
   return [{id:s.id,date:r.fecha,gym:gym?.nombre||'',sede:sede?.nombre||'',
    zone:e?.zona_entrenamiento||'',type:e?.tipo_equipo||'',equipment:e?.instrumento||'',
    accessory:e?.accesorio||'',grip:e?.agarre||'',exercise:e?.nombre||'Ejercicio',
    technique:r.tecnica_registrada||e?.tecnica_actualizada||'',
    series:'Serie '+s.numero_serie,subdivision:s.subdivision||'-',unit:s.unidad,
    weight:Number(s.peso||0),reps:Number(s.repeticiones||0),assistance:s.asistencias,
    notes:r.observaciones||'',createdAt:s.created_at}];
  });
 },
 async loadOwnCatalog(){
  if(!owns())return [];
  const uid=signedIn.id;
  const [ex,gy,sd]=await Promise.all([
   db.from('tbl_ejercicios').select('*').eq('user_id',uid),
   db.from('tbl_gimnasios').select('id,nombre').eq('user_id',uid),
   db.from('tbl_sedes').select('id,nombre').eq('user_id',uid)
  ]);
  [ex,gy,sd].forEach(x=>must(x.data,x.error));
  const g=new Map(gy.data.map(x=>[x.id,x.nombre])),s=new Map(sd.data.map(x=>[x.id,x.nombre]));
  return ex.data.filter(x=>x.gimnasio_id&&x.sede_id).map(x=>({
   cloud_id:x.id,g:g.get(x.gimnasio_id)||'',s:s.get(x.sede_id)||'',
   z:x.zona_entrenamiento||'Sin clasificar',kind:x.tipo_equipo||'Otro',
   i:x.instrumento||'Sin equipo',a:x.accesorio||x.implemento||'No especificado',
   gr:x.agarre||'No especificado',e:x.nombre,t:[x.tecnica_actualizada||'Ejecución base'],
   m:'Pendiente de asignación',ms:'Pendiente de asignación',n:0,last:null
  }));
 },
 async saveCustomExercise(values){
  if(!owns())throw Error('Inicia sesión para editar tu catálogo');
  const value={...values,t:[values.tecnica]};
  await this.ensureExercise(value,values.tecnica);
  return this.loadOwnCatalog();
 },
 async loadCatalogStats(){
  if(!owns())return;
  for(const [t,id] of [['tbl_gimnasios','gymCount'],['tbl_ejercicios','exerciseCount'],['tbl_musculos','muscleCount']]){
   let q=db.from(t).select('*',{head:true,count:'exact'});
   if(t!=='tbl_musculos')q=q.eq('user_id',signedIn.id);
   const {count,error}=await q;
   $(id).textContent=error?'Sin conexión':String(count??0);
  }
 },
 async signedPath(bucket,path){
  if(!path)return null;
  const {data,error}=await client.storage.from(bucket).createSignedUrl(path,3600);
  return error?null:data.signedUrl;
 },
 async loadAnatomy(exercise){
  const result={id:null,primary:[],secondary:[],images:{},zones3d:[],photos:{}};
  if(!owns())return result;
  let record=null;
  if(exercise.cloud_id){const r=await db.from('tbl_ejercicios').select('id').eq('id',exercise.cloud_id).maybeSingle();
   record=must(r.data,r.error);}
  if(!record){const r=await db.from('tbl_ejercicios').select('id')
   .eq('user_id',signedIn.id).eq('nombre',exercise.e).eq('instrumento',exercise.i)
   .limit(1).maybeSingle();record=must(r.data,r.error);}
  if(!record){const r=await db.from('tbl_ejercicios').select('id')
   .eq('origen','base').eq('nombre',exercise.e).limit(1).maybeSingle();record=must(r.data,r.error);}
  if(!record)return result;
  result.id=record.id;
  const {data:rel,error:e}=await db.from('tbl_ejercicio_musculos')
   .select('musculo_id,tipo,lado,tbl_musculos(id,nombre,grupo_muscular)').eq('ejercicio_id',record.id);
  must(rel,e);
  for(const r of rel){const name=r.tbl_musculos?.nombre;if(name)result[r.tipo==='principal'?'primary':'secondary'].push(name);}
  const ids=[...new Set(rel.map(r=>r.musculo_id))];
  if(ids.length){
   const [imageRows,zones]=await Promise.all([
    db.from('tbl_musculo_imagenes').select('musculo_id,vista,imagen_path,orden').in('musculo_id',ids).order('orden'),
    db.from('tbl_musculo_zonas3d').select('musculo_id,modelo_codigo,modelo_path,parte_id,vista_preferida').in('musculo_id',ids)
   ]);
   must(imageRows.data,imageRows.error);must(zones.data,zones.error);
   result.zones3d=zones.data||[];
   for(const row of imageRows.data||[]){
    if(!result.images[row.vista])result.images[row.vista]=await this.signedPath('gymlog-anatomia',row.imagen_path);
   }
  }
  const personal=await db.from('tbl_fotos').select('tipo_referencia,vista,storage_path,created_at')
   .eq('user_id',signedIn.id).eq('ejercicio_id',record.id).order('created_at',{ascending:false});
  must(personal.data,personal.error);
  for(const row of personal.data||[]){const key=row.tipo_referencia+':'+(row.vista||'general');
   if(!result.photos[key])result.photos[key]=await this.signedPath('gymlog-usuarios',row.storage_path);
  }
  return result;
 },
 async uploadUserPhoto({exercise,technique,type,side,blob}){
  if(!owns())throw Error('Necesitas iniciar sesión para añadir fotografías');
  if(!['maquina','ejercicio','musculos'].includes(type))throw Error('Tipo de foto incorrecto');
  const {ejercicio_id}=await this.ensureExercise(exercise,technique);
  const path=signedIn.id+'/'+crypto.randomUUID()+'.jpg';
  const {error}=await client.storage.from('gymlog-usuarios').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(error)throw error;
  const saved=await db.from('tbl_fotos').insert({user_id:signedIn.id,ejercicio_id,
   storage_path:path,tipo_referencia:type,vista:side||null,descripcion:'Fotografía GymLog'});
  if(saved.error){await client.storage.from('gymlog-usuarios').remove([path]);throw saved.error;}
  return path;
 }
};
window.GymCloud=cloud;
$('catalogForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!owns())return setStatus('Inicia sesión para modificar tu catálogo.');
  const values=Object.fromEntries(new FormData(event.currentTarget).entries());
  const button=$('catalogSubmit');button.disabled=true;
  try{
   window.GymCustomCatalog=await cloud.saveCustomExercise(values);
   if(typeof cascade==='function')cascade(0,{g:values.g,s:values.s,z:values.z,kind:values.kind,
    i:values.i,a:values.a,gr:values.gr,e:values.e,t:values.tecnica});
   if(typeof renderOwnCatalog==='function')renderOwnCatalog();
   await cloud.loadCatalogStats();
   event.currentTarget.reset();
   $('catalogFeedback').textContent='Ejercicio guardado en tu catálogo de Supabase.';
  }catch(error){$('catalogFeedback').textContent='No se pudo guardar: '+error.message;}
  finally{button.disabled=false;}
});
// Bloquear navegación antes de que cualquier controlador del mockup la procese.
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',event=>{
  if(b.dataset.page!=='sesion'&&!owns()){
    event.stopImmediatePropagation();event.preventDefault();setStatus('Inicia sesión para acceder a GymLog');showPage('sesion');
  }
},true));
$('authForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!client){setStatus('Falta configurar Supabase: copia .env.example como .env y añade tu clave publicable.');return;}
  $('authSubmit').disabled=true;
  try{
    const email=$('authEmail').value.trim();const password=$('authPassword').value;
    must(null,(await client.auth.signInWithPassword({email,password})).error);
    $('authPassword').value='';
  }catch(error){setStatus('No fue posible iniciar sesión: '+error.message);}
  finally{$('authSubmit').disabled=false;}
});
$('authRegister').addEventListener('click',async()=>{
  if(!client)return setStatus('Configura Supabase antes de registrar cuentas.');
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(!email||password.length<6)return setStatus('Introduce correo y contraseña válida.');
  const {data,error}=await client.auth.signUp({email,password});
  if(error)return setStatus(error.message);
  setStatus(data.session?'Sesión iniciada; un administrador debe habilitar tu acceso a GymLog.':'Revisa tu correo para confirmar la cuenta. Un administrador deberá habilitar tu acceso a GymLog.');
});
$('authRecovery').addEventListener('click',async()=>{
  if(!client)return setStatus('Configura Supabase antes de recuperar acceso.');
  const email=$('authEmail').value.trim();if(!email)return setStatus('Indica tu correo electrónico.');
  const {error}=await client.auth.resetPasswordForEmail(email);
  setStatus(error?'No se pudo enviar la solicitud: '+error.message:'Si existe una cuenta, recibirás las instrucciones de recuperación.');
});
$('authLogout').addEventListener('click',async()=>{if(client)await client.auth.signOut();});
if(client){
  client.auth.onAuthStateChange((_,session)=>{queueMicrotask(()=>updateState(session));});
  client.auth.getSession().then(({data})=>updateState(data.session)).catch(e=>setStatus(e.message));
}else {setStatus('Proyecto preparado. Configura URL y clave publicable de Supabase para iniciar sesión.');updateState(null);}
