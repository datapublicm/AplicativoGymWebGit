import { createClient } from '@supabase/supabase-js';
import { resolveRecoveryUrl } from './recovery-url.js';

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  schema: import.meta.env.VITE_SUPABASE_SCHEMA || 'sch_android_gymlytics',
  environment: import.meta.env.VITE_GYMLYTICS_ENVIRONMENT || 'pruebas',
  recoveryUrl: import.meta.env.VITE_GYMLYTICS_RECOVERY_URL || ''
};
const ready = !!config.url && !!config.key && !config.key.includes('COLOCA_AQUI');
const client = ready ? createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
const db = client?.schema(config.schema);
let signedIn = null;
let lastDraftOwner = null;
const $ = id => document.getElementById(id);
const setStatus = message => {
 $('authStatus').textContent=message;
 const banner=$('syncBanner');
 if(banner){
  banner.textContent=message;
  banner.hidden=!owns()||message.startsWith('Sesión activa · ');
 }
};
const must = (data,error) => { if(error) throw error; return data; };
const owns = () => !!signedIn?.id;
// Las solicitudes iniciadas en una cuenta no pueden actualizar la vista de otra.
const assertCurrentSession = (uid, epoch) => {
 if(!owns() || signedIn.id!==uid || authEpoch!==epoch) throw Error('La sesión cambió durante la carga de datos.');
};

async function assertGymlyticsAccess(user) {
  const {data,error} = await db.from('tbl_usuarios').select('id,usuario,nombre,rol,activo').eq('id',user.id).maybeSingle();
  if(error) throw new Error('Gymlytics no está disponible en la API del proyecto: '+error.message);
  if(!data?.activo) throw new Error('Tu cuenta no tiene acceso activo a Gymlytics.');
  return data;
}
let authEpoch=0, pendingAuthId=null, pendingAuthPromise=null;
function updateState(session) {
  const id=session?.user?.id||null;
  // Restauración de sesión y evento de SIGNED_IN pueden llegar juntos.
  if(id&&pendingAuthPromise&&pendingAuthId===id)return pendingAuthPromise;
  if(id&&signedIn?.id===id)return Promise.resolve();
  const epoch=++authEpoch;
  pendingAuthId=id;
  const promise=applyState(session,epoch);
  pendingAuthPromise=promise.finally(()=>{
    if(epoch===authEpoch){pendingAuthId=null;pendingAuthPromise=null;}
  });
  return pendingAuthPromise;
}
async function applyState(session,epoch) {
  const user=session?.user||null;
  signedIn=null;
  // Bloquear inmediatamente toda navegación privada antes de verificar el nuevo perfil.
  document.body.classList.toggle('auth-locked',true);
  document.querySelectorAll('[data-page]').forEach(b=>{
    if(b.dataset.page!=='sesion'){b.disabled=true;b.setAttribute('aria-disabled','true');}
  });
  if(typeof setHistoryReady==='function')setHistoryReady(false);
  const historyRefresh=$('historyRefresh');
  if(historyRefresh)historyRefresh.disabled=true;
  const catalogRefresh=$('catalogRefresh');
  if(catalogRefresh)catalogRefresh.disabled=true;
  const catalogStatus=$('catalogStatus');
  if(catalogStatus)catalogStatus.textContent='';
  // Ocultar inmediatamente los datos de la sesión previa, incluso mientras se valida el nuevo perfil.
  if(typeof invalidatePendingSave==='function')invalidatePendingSave();
  window.GymBaseCatalog=[];window.GymCustomCatalog=[];window.GymExerciseLibrary=[];
  window.GymEntities={gyms:[],sites:[],machines:[],options:[]};
  model.records=[];model.photos={};
  if(lastDraftOwner!==null){lastDraftOwner=null;if(typeof resetExerciseTabs==='function')resetExerciseTabs();}
  if(typeof renderOwnCatalog==='function')renderOwnCatalog();
  if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
  drawRecent();drawHistory();drawReports();
  $('authProfile').hidden=true;
  $('authForm').hidden=!!user;
  $('authRegister').hidden=!!user;
  $('authRecovery').hidden=!!user;
  setStatus(user?'Verificando acceso a Gymlytics…':'Sesión cerrada.');
  showPage('sesion');
  let accessError=null;
  if(user){
    try {
      const profile=await assertGymlyticsAccess(user);
      if(epoch!==authEpoch)return;
      signedIn={...user,gymlytics:profile};
    }catch(error){accessError=error;}
  }
  if(epoch!==authEpoch)return;
  if(typeof invalidatePendingSave==='function')invalidatePendingSave();
  document.body.classList.toggle('auth-locked',!owns());
  document.querySelectorAll('[data-page]').forEach(b=>{
    if(b.dataset.page!=='sesion'){b.disabled=!owns();b.setAttribute('aria-disabled',String(!owns()));}
  });
  // Bloquear recargas paralelas hasta terminar la carga inicial.
  if(historyRefresh)historyRefresh.disabled=true;
  if(catalogRefresh)catalogRefresh.disabled=!owns();
  const logged=owns();
  $('authForm').hidden=logged;$('authRegister').hidden=logged;$('authRecovery').hidden=logged;
  $('authProfile').hidden=!logged;
  if(!logged){
    window.GymBaseCatalog=[];window.GymCustomCatalog=[];window.GymExerciseLibrary=[];
    window.GymEntities={gyms:[],sites:[],machines:[],options:[]};
    if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
    model.records=[];model.photos={};
    if(lastDraftOwner!==null){lastDraftOwner=null;if(typeof resetExerciseTabs==='function')resetExerciseTabs();}
    drawRecent();drawHistory();drawReports();
    if(accessError)setStatus(accessError.message);
    showPage('sesion');
    return;
  }
  $('loggedUser').textContent=signedIn.gymlytics.nombre||signedIn.gymlytics.usuario;
  $('loggedEmail').textContent=signedIn.email;
  let catalogLoaded=false,historyLoaded=false;
  setStatus('Cargando catálogos desde Supabase…');
  try{
    const [base,custom]=await Promise.all([cloud.loadInitialCatalog(),cloud.loadOwnCatalog()]);
    if(epoch!==authEpoch)return;
    window.GymBaseCatalog=base;
    window.GymCustomCatalog=custom;
    catalogLoaded=true;
    await cloud.loadIndependentCatalog();
    if(epoch!==authEpoch)return;
    if(typeof cascade==='function')cascade(0);
    if(lastDraftOwner!==signedIn.id){
      if(typeof resetExerciseTabs==='function')resetExerciseTabs();
      lastDraftOwner=signedIn.id;
    }
    if(typeof renderOwnCatalog==='function')renderOwnCatalog();
    setStatus('Cargando historial de entrenamientos…');
    const history=await cloud.loadHistory();
    if(epoch!==authEpoch)return;
    model.records=history;drawRecent();drawHistory();drawReports();
    historyLoaded=true;
    if(typeof setHistoryReady==='function')setHistoryReady(true);
    if(historyRefresh)historyRefresh.disabled=false;
    await cloud.loadCatalogStats();
    if(epoch!==authEpoch)return;
    setStatus('Sesión activa · '+base.length.toLocaleString('es-PE')+' ejercicios de referencia · '+history.length.toLocaleString('es-PE')+' series cargadas · '+config.environment);
  }catch(error){
    if(epoch!==authEpoch)return;
    let issue=error.message;
    // Un fallo de catálogo no debe dejar también vacíos el historial y el Dashboard.
    if(!historyLoaded){
      try{
        setStatus('Error en catálogo; recuperando el historial de entrenamientos…');
        const recovered=await cloud.loadHistory();
        if(epoch!==authEpoch)return;
        model.records=recovered;drawRecent();drawHistory();drawReports();
        historyLoaded=true;
        if(typeof setHistoryReady==='function')setHistoryReady(true);
      }catch(loadError){
        if(epoch!==authEpoch)return;
        issue+=' · Historial: '+loadError.message;
      }
    }
    if(!catalogLoaded&&catalogStatus)catalogStatus.textContent='No se cargó el catálogo. Pulsa Actualizar catálogo para reintentar.';
    setStatus('Sesión activa; error al cargar datos: '+issue);
    if(historyRefresh)historyRefresh.disabled=false;
  }
  if(epoch===authEpoch){
    if(catalogLoaded)showPage('registro');
    else showPage('catalogos');
  }
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
 getSessionStamp:()=>owns()?signedIn.id+':'+authEpoch:null,
 async refreshCatalog(){
  if(!owns())throw Error('Debes iniciar sesión para cargar tu catálogo.');
  const uid=signedIn.id,epoch=authEpoch;
  const [base,custom]=await Promise.all([this.loadInitialCatalog(),this.loadOwnCatalog()]);
  assertCurrentSession(uid,epoch);
  await this.loadIndependentCatalog();
  assertCurrentSession(uid,epoch);
  window.GymBaseCatalog=base;
  window.GymCustomCatalog=custom;
  if(typeof cascade==='function')cascade(0);
  if(typeof renderOwnCatalog==='function')renderOwnCatalog();
  await this.loadCatalogStats();
  assertCurrentSession(uid,epoch);
  return base.length;
 },
 async ensureExercise(exercise,technique=''){
  if(!owns())throw Error('La sesión no está autorizada');
  const user_id=signedIn.id,epoch=authEpoch;
  const gimnasio_id=await findOrCreate('tbl_gimnasios',{user_id,nombre:exercise.g});
  assertCurrentSession(user_id,epoch);
  const sede_id=await findOrCreate('tbl_sedes',{user_id,gimnasio_id,nombre:exercise.s});
  assertCurrentSession(user_id,epoch);
  const maquina_id=exercise.i?await findOrCreate('tbl_maquinas',{user_id,nombre:exercise.i},{tipo_equipo:exercise.kind||'Otro'}):null;
  assertCurrentSession(user_id,epoch);
  const fields={user_id,origen:'usuario',gimnasio_id,sede_id,nombre:exercise.e,
    instrumento:exercise.i,tecnica_actualizada:technique||exercise.t?.[0]||'Ejecución base'};
  const ejercicio_id=await findOrCreate('tbl_ejercicios',fields,{
    maquina_id,tipo_equipo:exercise.kind||'Otro',zona_entrenamiento:exercise.z||'',accesorio:exercise.a||'',
    agarre:exercise.gr||'',implemento:exercise.a||''});
  assertCurrentSession(user_id,epoch);
  if(maquina_id){const {error}=await db.from('tbl_ejercicios').update({maquina_id}).eq('id',ejercicio_id).eq('user_id',user_id);must(null,error);}
  assertCurrentSession(user_id,epoch);
  return {user_id,gimnasio_id,sede_id,ejercicio_id,maquina_id};
 },
 async saveWorkout({exercise,date,technique,notes,entries}) {
  if(!owns())throw Error('Inicia sesión antes de guardar');
  const valid=(value,limit)=>/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(String(value).trim())&&Number(value)<limit;
  if(!Array.isArray(entries)||!entries.length||entries.some(x=>
   !['kg','lb'].includes(x.unit)||!valid(x.weight,1e10)||!valid(x.reps,1e8)
   ||Number(x.reps)<=0||!valid(x.assistance||'0',1e8)
  ))throw Error('Serie inválida: solo números positivos con hasta dos decimales.');

  const uid=signedIn.id,epoch=authEpoch;
  const ids=await this.ensureExercise(exercise,technique);
  assertCurrentSession(uid,epoch);
  const p_series=entries.map(x=>({
   numero_serie:Number(x.series.match(/\d+/)?.[0]||0),
   subdivision:x.sub==='-'?null:x.sub,unidad:x.unit,
   peso:Number(x.weight),repeticiones:Number(x.reps),asistencias:Number(x.assistance||0)
  }));
  must(null,(await db.rpc('guardar_entrenamiento',{
   p_fecha:date,p_gimnasio_id:ids.gimnasio_id,p_sede_id:ids.sede_id,
   p_ejercicio_id:ids.ejercicio_id,p_tecnica:technique,p_observaciones:notes,p_series
  })).error);
  assertCurrentSession(uid,epoch);
 },
 async deleteSeries(id){
  if(!owns())throw Error('Sin sesión');
  const uid=signedIn.id,epoch=authEpoch;
  const {data,error}=await db.from('tbl_series').delete().eq('id',id).eq('user_id',uid).select('id');
  must(data,error);
  assertCurrentSession(uid,epoch);
  if(data?.length!==1)throw Error('No se eliminó ninguna serie. Actualiza el historial antes de reintentar.');
  return data[0].id;
 },
 async loadHistory(){
  if(!owns())return [];
  const uid=signedIn.id,epoch=authEpoch,pageSize=700,parallel=4;
  // Cargar todo el historial, sin tope de 1.000 filas del REST de Supabase.
  const {count,error:countError}=await db.from('vw_historial_series')
    .select('*',{count:'exact',head:true}).eq('user_id',uid);
  must(null,countError);
  assertCurrentSession(uid,epoch);
  if(!Number.isSafeInteger(count)||count<0)
    throw Error('No se pudo verificar el total del historial. Vuelve a actualizarlo.');
  const rows=[],ids=new Set();
  for(let start=0;start<count;start+=pageSize*parallel){
    const offsets=Array.from({length:parallel},(_,i)=>start+i*pageSize)
      .filter(offset=>offset<count);
    const batches=await Promise.all(offsets.map(async offset=>{
      const {data,error}=await db.from('vw_historial_series').select('*')
        .eq('user_id',uid).order('date',{ascending:false})
        .order('id',{ascending:true}).range(offset,offset+pageSize-1);
      must(data,error);
      if(!Array.isArray(data)||data.length!==Math.min(pageSize,count-offset))
        throw Error('El historial cambió durante la descarga o llegó incompleto. Actualízalo otra vez.');
      return data;
    }));
    assertCurrentSession(uid,epoch);
    for(const batch of batches){
      for(const r of batch){
        if(!r?.id||r.user_id!==uid||ids.has(r.id))
          throw Error('Se detectaron series repetidas o ajenas en el historial. Actualízalo otra vez.');
        ids.add(r.id);
        rows.push({...r,weight:Number(r.weight||0),reps:Number(r.reps||0),
          assistance:Number(r.assistance||0)});
      }
    }
  }
  if(rows.length!==count||ids.size!==count)
    throw Error('El historial no coincide con el recuento de Supabase. Actualízalo otra vez.');
  return rows;
 },
 async loadInitialCatalog(){
  if(!owns())return [];
  const uid=signedIn.id,epoch=authEpoch;
  const {count,error:countError}=await db.from('tbl_catalogo_predeterminado')
    .select('id',{count:'exact',head:true}).eq('activo',true);
  must(null,countError);
  assertCurrentSession(uid,epoch);
  if(!Number.isSafeInteger(count)||count<0)
   throw Error('No se pudo comprobar la cantidad de ejercicios del catálogo.');
  const all=[],pageSize=700;
  const ids=new Set();
  for(let offset=0;offset<count;offset+=pageSize){
   const {data,error}=await db.from('tbl_catalogo_predeterminado')
    .select('id,gimnasio,sede,anotacion,zona_entrenamiento,instrumento,ejercicio,accesorio_implemento,tecnica_actualizada,musculos_principales,musculos_secundarios')
    .eq('activo',true).order('fila_origen',{ascending:true}).order('id',{ascending:true})
    .range(offset,offset+pageSize-1);
   must(data,error);
   assertCurrentSession(uid,epoch);
   if(!Array.isArray(data)||data.length!==Math.min(pageSize,count-offset))
    throw Error('La carga del catálogo está incompleta. Vuelve a iniciar sesión.');
   for(const row of data){
    if(!row?.id||ids.has(row.id))
     throw Error('El catálogo contiene filas repetidas o sin identificación.');
    ids.add(row.id);
    all.push(row);
   }
  }
  if(all.length!==count)throw Error('La cantidad cargada no coincide con el catálogo.');
  return all.map(x=>{
    const equipment=x.instrumento||'';
    const kind=/máquina|maquina|freemotion|estación|polea|hack|peck deck/i.test(equipment)?'Máquina':
      /mancuerna|barra|disco|banca/i.test(equipment)?'Implemento libre':'Otro';
    return {cloud_base_id:x.id,g:x.gimnasio,s:x.sede,z:x.zona_entrenamiento||x.anotacion||'Sin clasificar',
      kind,i:equipment,e:x.ejercicio,a:x.accesorio_implemento&&x.accesorio_implemento!=='-'?x.accesorio_implemento:'No especificado',
      gr:'No especificado',t:[x.tecnica_actualizada||'01 - Ejecución base'],
      m:x.musculos_principales||'Pendiente de asignación',ms:x.musculos_secundarios||'Pendiente de asignación',n:0,last:null};
  });
 },
 async loadOwnCatalog(){
  if(!owns())return [];
  const uid=signedIn.id, epoch=authEpoch;
  const [ex,gy,sd]=await Promise.all([
   db.from('tbl_ejercicios').select('*').eq('user_id',uid),
   db.from('tbl_gimnasios').select('id,nombre').eq('user_id',uid),
   db.from('tbl_sedes').select('id,nombre').eq('user_id',uid)
  ]);
  [ex,gy,sd].forEach(x=>must(x.data,x.error));
  assertCurrentSession(uid,epoch);
  window.GymExerciseLibrary=ex.data.filter(x=>!x.gimnasio_id&&x.origen==='usuario');
  const g=new Map(gy.data.map(x=>[x.id,x.nombre])),s=new Map(sd.data.map(x=>[x.id,x.nombre]));
  return ex.data.filter(x=>x.gimnasio_id&&x.sede_id).map(x=>({
   cloud_id:x.id,g:g.get(x.gimnasio_id)||'',s:s.get(x.sede_id)||'',
   z:x.zona_entrenamiento||'Sin clasificar',kind:x.tipo_equipo||'Otro',
   i:x.instrumento||'Sin equipo',a:x.accesorio||x.implemento||'No especificado',
   gr:x.agarre||'No especificado',e:x.nombre,t:[x.tecnica_actualizada||'Ejecución base'],
   m:'Pendiente de asignación',ms:'Pendiente de asignación',n:0,last:null
  }));
 },
 async loadIndependentCatalog(){
  if(!owns()){window.GymEntities={gyms:[],sites:[],machines:[],options:[]};return window.GymEntities;}
  const uid=signedIn.id, epoch=authEpoch;
  const [gy,sd,mc,op]=await Promise.all([
    db.from('tbl_gimnasios').select('id,nombre').eq('user_id',uid).order('nombre'),
    db.from('tbl_sedes').select('id,gimnasio_id,nombre').eq('user_id',uid).order('nombre'),
    db.from('tbl_maquinas').select('id,nombre,tipo_equipo').eq('user_id',uid).order('nombre'),
    db.from('tbl_opciones_personales').select('id,tipo,nombre').eq('user_id',uid).eq('activo',true).order('nombre')
  ]);
  for(const x of [gy,sd,mc,op])must(x.data,x.error);
  assertCurrentSession(uid,epoch);
  window.GymEntities={gyms:gy.data||[],sites:sd.data||[],machines:mc.data||[],options:op.data||[]};
  if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
  return window.GymEntities;
 },
 async addIndependentItem(kind,values){
  if(!owns())throw Error('Inicia sesión antes de agregar elementos');
  const user_id=signedIn.id,epoch=authEpoch,nombre=(values.nombre||'').trim();
  if(!nombre)throw Error('Introduce un nombre válido');
  if(kind==='gym')await findOrCreate('tbl_gimnasios',{user_id,nombre});
  else if(kind==='site'){
   const gym=(window.GymEntities?.gyms||[]).find(g=>g.id===values.gimnasio_id);
   if(!gym)throw Error('Selecciona un gimnasio de tu cuenta');
   await findOrCreate('tbl_sedes',{user_id,gimnasio_id:gym.id,nombre});
  }else if(kind==='machine'){
   const tipo_equipo=values.tipo_equipo||'Máquina';
   if(!['Máquina','Implemento libre','Peso corporal','Otro'].includes(tipo_equipo))throw Error('Tipo de equipo incorrecto');
   await findOrCreate('tbl_maquinas',{user_id,nombre},{tipo_equipo});
  }else if(kind==='option'){
   if(!['zona','accesorio','agarre','tecnica'].includes(values.tipo))throw Error('Tipo de opción no válido');
   await findOrCreate('tbl_opciones_personales',{user_id,tipo:values.tipo,nombre});
  }else throw Error('Tipo de catálogo no reconocido');
  assertCurrentSession(user_id,epoch);
  await this.loadIndependentCatalog();
  assertCurrentSession(user_id,epoch);
  await this.loadCatalogStats();
  assertCurrentSession(user_id,epoch);
 },
 async saveCustomExercise(values){
  if(!owns())throw Error('Inicia sesión para editar tu catálogo');
  const user_id=signedIn.id,epoch=authEpoch,nombre=String(values.e||'').trim();
  if(!nombre)throw Error('Introduce un nombre de ejercicio');
  // No asociar gimnasio, sede ni máquina hasta registrar el entrenamiento.
  await findOrCreate('tbl_ejercicios',{
   user_id,origen:'usuario',nombre,gimnasio_id:null,sede_id:null
  },{
   zona_entrenamiento:String(values.z||'').trim()||'Sin clasificar',
   tecnica_actualizada:String(values.tecnica||'').trim()||'Ejecución base'
  });
  assertCurrentSession(user_id,epoch);
  const catalog=await this.loadOwnCatalog();
  assertCurrentSession(user_id,epoch);
  return catalog;
 },
 async loadCatalogStats(){
  if(!owns())return;
  const uid=signedIn.id, epoch=authEpoch;
  for(const [t,id] of [['tbl_gimnasios','gymCount'],['tbl_ejercicios','exerciseCount'],['tbl_musculos','muscleCount']]){
   let q=db.from(t).select('*',{head:true,count:'exact'});
   if(t!=='tbl_musculos')q=q.eq('user_id',uid);
   const {count,error}=await q;
   assertCurrentSession(uid,epoch);
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
  const uid=signedIn.id,epoch=authEpoch;
  let record=null;
  if(exercise.cloud_id){const r=await db.from('tbl_ejercicios').select('id').eq('id',exercise.cloud_id).maybeSingle();
   record=must(r.data,r.error);}
  if(!record){const r=await db.from('tbl_ejercicios').select('id')
   .eq('user_id',uid).eq('nombre',exercise.e).eq('instrumento',exercise.i)
   .limit(1).maybeSingle();record=must(r.data,r.error);}
  if(!record){const r=await db.from('tbl_ejercicios').select('id')
   .eq('origen','base').eq('nombre',exercise.e).limit(1).maybeSingle();record=must(r.data,r.error);}
  assertCurrentSession(uid,epoch);
  if(!record)return result;
  result.id=record.id;
  const {data:rel,error:e}=await db.from('tbl_ejercicio_musculos')
   .select('musculo_id,tipo,lado,tbl_musculos(id,nombre,grupo_muscular)').eq('ejercicio_id',record.id);
  must(rel,e);
  assertCurrentSession(uid,epoch);
  for(const r of rel){const name=r.tbl_musculos?.nombre;if(name)result[r.tipo==='principal'?'primary':'secondary'].push(name);}
  const ids=[...new Set(rel.map(r=>r.musculo_id))];
  if(ids.length){
   const [imageRows,zones]=await Promise.all([
    db.from('tbl_musculo_imagenes').select('musculo_id,vista,imagen_path,orden').in('musculo_id',ids).order('orden'),
    db.from('tbl_musculo_zonas3d').select('musculo_id,modelo_codigo,modelo_path,parte_id,vista_preferida').in('musculo_id',ids)
   ]);
   must(imageRows.data,imageRows.error);must(zones.data,zones.error);
   assertCurrentSession(uid,epoch);
   result.zones3d=zones.data||[];
   for(const row of imageRows.data||[]){
    if(!result.images[row.vista])result.images[row.vista]=await this.signedPath('gymlog-anatomia',row.imagen_path);
   }
  }
  const personal=await db.from('tbl_fotos').select('tipo_referencia,vista,storage_path,created_at')
   .eq('user_id',uid).eq('ejercicio_id',record.id).order('created_at',{ascending:false});
  must(personal.data,personal.error);
  assertCurrentSession(uid,epoch);
  for(const row of personal.data||[]){const key=row.tipo_referencia+':'+(row.vista||'general');
   if(!result.photos[key])result.photos[key]=await this.signedPath('gymlog-usuarios',row.storage_path);
  }
  assertCurrentSession(uid,epoch);
  return result;
 },
 async uploadUserPhoto({exercise,technique,type,side,blob}){
  if(!owns())throw Error('Necesitas iniciar sesión para añadir fotografías');
  if(!['maquina','ejercicio','musculos'].includes(type))throw Error('Tipo de foto incorrecto');
  const uid=signedIn.id,epoch=authEpoch;
  const {ejercicio_id}=await this.ensureExercise(exercise,technique);
  assertCurrentSession(uid,epoch);
  const path=uid+'/'+crypto.randomUUID()+'.jpg';
  const {error}=await client.storage.from('gymlog-usuarios').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(error)throw error;
  try{assertCurrentSession(uid,epoch);}
  catch(sessionError){
   // Intento de limpieza: Storage puede denegarlo si ya cambió la sesión JWT.
   await client.storage.from('gymlog-usuarios').remove([path]).catch(()=>{});
   throw sessionError;
  }
  const saved=await db.from('tbl_fotos').insert({user_id:uid,ejercicio_id,
   storage_path:path,tipo_referencia:type,vista:side||null,descripcion:'Fotografía Gymlytics'});
  if(saved.error){await client.storage.from('gymlog-usuarios').remove([path]);throw saved.error;}
  assertCurrentSession(uid,epoch);
  return path;
 }
};
window.GymCloud=cloud;
$('catalogRefresh').addEventListener('click',async()=>{
 if(!owns())return;
 const uid=signedIn.id,epoch=authEpoch,button=$('catalogRefresh');
 const current=()=>owns()&&signedIn.id===uid&&authEpoch===epoch;
 button.disabled=true;
 $('catalogStatus').textContent='Cargando ejercicios y listas desde Supabase…';
 try{
  const count=await cloud.refreshCatalog();
  if(!current())return;
  $('catalogStatus').textContent=count.toLocaleString('es-PE')+' ejercicios de referencia cargados correctamente.';
  setStatus('Sesión activa · Catálogo actualizado · '+config.environment);
 }catch(error){
  if(current())$('catalogStatus').textContent='No se pudo cargar el catálogo: '+error.message;
 }finally{if(current())button.disabled=false;}
});
for(const [formId,kind,feedbackId] of [
 ['addGymForm','gym','gymFeedback'],['addSiteForm','site','siteFeedback'],['addMachineForm','machine','machineFeedback'],['addOptionForm','option','optionFeedback']
]){
 $(formId)?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!owns())return $('authStatus').textContent='Inicia sesión para editar tu catálogo.';
  const form=event.currentTarget, button=form.querySelector('[type="submit"]');
  const stamp=cloud.getSessionStamp();
  const current=()=>stamp===cloud.getSessionStamp()&&cloud.canWrite();
  button.disabled=true;
  try{
    await cloud.addIndependentItem(kind,Object.fromEntries(new FormData(form).entries()));
    if(!current())return;
    form.reset();
    $(feedbackId).textContent='Elemento guardado en tu cuenta de Supabase.';
  }catch(error){if(current())$(feedbackId).textContent='No se pudo guardar: '+error.message;}
  finally{button.disabled=false;}
 });
}
$('catalogForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!owns())return setStatus('Inicia sesión para modificar tu catálogo.');
  const values=Object.fromEntries(new FormData(event.currentTarget).entries());
  const stamp=cloud.getSessionStamp();
  const current=()=>stamp===cloud.getSessionStamp()&&cloud.canWrite();
  const button=$('catalogSubmit');button.disabled=true;
  try{
   const catalog=await cloud.saveCustomExercise(values);
   if(!current())return;
   window.GymCustomCatalog=catalog;
   if(typeof cascade==='function')cascade(0,{e:values.e,z:values.z,t:values.tecnica||'Ejecución base'});
   if(typeof renderOwnCatalog==='function')renderOwnCatalog();
   await cloud.loadCatalogStats();
   if(!current())return;
   event.currentTarget.reset();
   if(typeof renderIndependentCatalog==='function')renderIndependentCatalog();
   $('catalogFeedback').textContent='Ejercicio guardado en tu catálogo de Supabase.';
  }catch(error){if(current())$('catalogFeedback').textContent='No se pudo guardar: '+error.message;}
  finally{button.disabled=false;}
});
// Bloquear navegación antes de que cualquier controlador del mockup la procese.
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',event=>{
  if(b.dataset.page!=='sesion'&&!owns()){
    event.stopImmediatePropagation();event.preventDefault();setStatus('Inicia sesión para acceder a Gymlytics');showPage('sesion');
  }
},true));
$('authForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!client){setStatus('Falta configurar Supabase: copia .env.example como .env y añade tu clave publicable.');return;}
  $('authSubmit').disabled=true;
  try{
    const identifier=$('authEmail').value.trim();const password=$('authPassword').value;
    setStatus('Verificando acceso seguro…');
    let session=null;
    if(identifier.includes('@')){
      const result=await client.auth.signInWithPassword({email:identifier,password});
      must(null,result.error);
      session=result.data.session;
    }else{
      const {data,error}=await client.functions.invoke('gymlytics-login-usuario',{
        body:{username:identifier,password}
      });
      if(error){
        let detail=error.message;
        try{detail=(await error.context?.json())?.error||detail;}catch{}
        throw new Error(detail);
      }
      if(data?.error||!data?.access_token||!data?.refresh_token)
        throw new Error(data?.error||'No se pudo iniciar sesión con el usuario.');
      const result=await client.auth.setSession({
        access_token:data.access_token,refresh_token:data.refresh_token
      });
      must(null,result.error);
      session=result.data.session;
    }
    if(!session?.user)throw new Error('Supabase no devolvió una sesión válida.');
    await updateState(session);
    if(!owns())throw new Error('Se autenticó la identidad, pero no se pudo verificar su perfil Gymlytics. Revisa el acceso a la base de datos.');
    $('authPassword').value='';
  }catch(error){setStatus('No fue posible iniciar sesión: '+error.message);}
  finally{$('authSubmit').disabled=false;}
});
$('authRegister').addEventListener('click',async()=>{
  if(!client)return setStatus('Configura Supabase antes de registrar cuentas.');
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(!email.includes('@')||password.length<6)return setStatus('Para crear una cuenta personal necesitas un correo real y una contraseña válida. Para prueba, utiliza Ingresar.');
  const {data,error}=await client.auth.signUp({email,password});
  if(error)return setStatus(error.message);
  setStatus(data.session?'Sesión iniciada; un administrador debe habilitar tu acceso a Gymlytics.':'Revisa tu correo para confirmar la cuenta. Un administrador deberá habilitar tu acceso a Gymlytics.');
});
let recoveryMode=false;
function enterPasswordResetMode(){
 recoveryMode=true;
 ++authEpoch;
 pendingAuthId=null;pendingAuthPromise=null;
 signedIn=null;
 if(typeof invalidatePendingSave==='function')invalidatePendingSave();
 model.records=[];model.photos={};drawRecent();drawHistory();drawReports();
 document.body.classList.add('auth-locked');
 document.querySelectorAll('[data-page]').forEach(button=>{
  if(button.dataset.page!=='sesion'){button.disabled=true;button.setAttribute('aria-disabled','true');}
 });
 $('authForm').hidden=true;
 $('authRegister').hidden=true;
 $('authRecovery').hidden=true;
 $('authProfile').hidden=true;
 $('passwordResetPanel').hidden=false;
 $('passwordResetStatus').textContent='';
 setStatus('Verifica el enlace de recuperación y establece tu nueva contraseña.');
 showPage('sesion');
}
$('authRecovery').addEventListener('click',async()=>{
 if(!client)return setStatus('Configura Supabase antes de recuperar acceso.');
 const email=$('authEmail').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return setStatus('Introduce el correo electrónico de tu cuenta para crear o recuperar tu contraseña.');
 // El destino lo configura el despliegue, nunca el usuario ni window.location.
 const redirectTo=resolveRecoveryUrl(config.recoveryUrl);
 if(!redirectTo)return setStatus('La recuperación por correo aún no está configurada. Falta autorizar una URL HTTPS de Gymlytics; no se envió ningún enlace.');
 const button=$('authRecovery');
 button.disabled=true;
 try{
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw error;
  setStatus('Si el correo corresponde a una cuenta, recibirás un enlace para establecer una contraseña. Revisa también el correo no deseado.');
 }catch(error){setStatus('No se pudo solicitar la recuperación: '+error.message);}
 finally{button.disabled=false;}
});
$('passwordResetForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!client||!recoveryMode)return;
 const password=$('passwordResetNew').value,confirmation=$('passwordResetConfirm').value;
 if(password.length<10)return $('passwordResetStatus').textContent='Utiliza una contraseña de 10 caracteres como mínimo.';
 if(password!==confirmation)return $('passwordResetStatus').textContent='Las contraseñas no coinciden.';
 const button=$('passwordResetSubmit');
 button.disabled=true;
 try{
  const {error}=await client.auth.updateUser({password});
  if(error)throw error;
  $('passwordResetNew').value='';
  $('passwordResetConfirm').value='';
  $('passwordResetPanel').hidden=true;
  recoveryMode=false;
  const {data,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  await updateState(data.session);
  setStatus('Contraseña creada correctamente. Puedes iniciar sesión con tu correo o usuario.');
 }catch(error){$('passwordResetStatus').textContent='No se pudo establecer la contraseña: '+error.message;}
 finally{button.disabled=false;}
});
$('authLogout').addEventListener('click',async()=>{if(client)await client.auth.signOut();});
if(client){
 client.auth.onAuthStateChange((event,session)=>{
  queueMicrotask(()=>{
   if(event==='PASSWORD_RECOVERY'){enterPasswordResetMode();return;}
   if(!recoveryMode)void updateState(session);
  });
 });
 client.auth.getSession().then(({data})=>{
  if(recoveryMode)return;
  updateState(data.session);
  if(!data.session)setStatus('Introduce tu correo o usuario y contraseña.');
 }).catch(error=>setStatus('Error de conexión con Supabase: '+error.message));
}else{setStatus('Proyecto preparado. Configura URL y clave publicable de Supabase para iniciar sesión.');updateState(null);}
