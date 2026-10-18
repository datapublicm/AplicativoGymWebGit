/** Importación íntegramente local del modelo HojaMatriz aprobado (2026-10-18).
 * Sin Supabase, sin escritura sobre otro perfil y sin asignar unidad a pesos sin unidad.
 */
export const GYMLYTICS_SEED_PATH='./data/hojamatriz-offline-20261018.json';
export const GYMLYTICS_SEED_MARKER='gymlytics-hojamatriz-seed-v1-completed';
const asText=v=>String(v??'').trim();
const ensure=(ok,msg)=>{if(!ok)throw Error('Semilla GymLytics inválida: '+msg);};
const exactCount={gym:3,site:16,exercise:146,exerciseDetail:622,session:446,series:9424};
const uidList=(items,title)=>{
 const out=new Set();
 for(const row of items){ensure(Array.isArray(row)&&asText(row[0])&&!out.has(row[0]),'UUID repetido/inválido en '+title);out.add(row[0]);}
 return out;
};
export function validateGymlyticsSeed(seed){
 ensure(seed?.schema==='gymlog-hojamatriz-offline-v1'&&seed.version===1,'versión de archivo');
 ensure(seed.profile?.id&&seed.profile?.demo===true&&seed.profile?.syncMode==='later','perfil de prueba');
 ensure(seed.metadata?.policy==='local_only_no_supabase'&&seed.metadata?.weightUnit==='unspecified_in_source','política local y unidad de peso');
 const t=seed.tables||{};
 for(const [name,count] of Object.entries(exactCount))ensure(Array.isArray(t[name])&&t[name].length===count,'recuento '+name);
 const gym=uidList(t.gym,'gimnasios'),site=uidList(t.site,'sedes'),ex=uidList(t.exercise,'ejercicios');
 uidList(t.exerciseDetail,'detalles');const sessions=uidList(t.session,'sesiones');uidList(t.series,'series');
 for(const s of t.site)ensure(gym.has(s[1]),'sede sin gimnasio');
 for(const d of t.exerciseDetail)ensure(ex.has(d[1]),'detalle sin ejercicio');
 for(const s of t.session)ensure(site.has(s[1])&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s[2]),'sesión/sede o fecha inválida');
 for(const r of t.series){
  ensure(sessions.has(r[1])&&ex.has(r[2]),'serie huérfana');
  ensure(Number.isInteger(r[3])&&r[3]>=1&&Number.isFinite(r[5])&&r[5]>=0&&Number.isFinite(r[7])&&r[7]>0,'peso/serie/repeticiones');
  ensure(r[6]===null||r[6]==='kg'||r[6]==='lb','unidad desconocida no declarada');
 }
 return {profiles:1,gyms:gym.size,sites:site.size,exercises:ex.size,details:t.exerciseDetail.length,sessions:sessions.size,series:t.series.length};
}
export function createGymlyticsSeedProfile(seed,emptyFactory=()=>({}),modifiedAt='2026-10-18T00:00:00'){
 const counts=validateGymlyticsSeed(seed),t=seed.tables,profile=seed.profile;
 const gyms=new Map(t.gym.map(([id,name])=>[id,{id,nombre:name,origen:'hojamatriz'}]));
 const sites=new Map(t.site.map(([id,gymId,name,lat,lon])=>[id,{id,gimnasio_id:gymId,nombre:name,latitud:lat,longitud:lon,origen:'hojamatriz'}]));
 const detailsByExercise=new Map();
 for(const [id,exerciseId,campo,valor,orden] of t.exerciseDetail){
  if(!detailsByExercise.has(exerciseId))detailsByExercise.set(exerciseId,[]);
  detailsByExercise.get(exerciseId).push({id,campo,valor,orden});
 }
 const exercises=new Map(t.exercise.map(([id,nombre])=>{
  const detalles=(detailsByExercise.get(id)||[]).sort((a,b)=>a.orden-b.orden);
  const detail=key=>detalles.find(x=>x.campo===key)?.valor||'';
  return [id,{id,nombre,origen:'hojamatriz',zona_entrenamiento:detail('Anotación')||'Sin clasificar',tecnica_actualizada:detail('Técnica')||'No especificada',detalles}];
 }));
 const sessions=new Map(t.session.map(([id,siteId,fecha,notas])=>[id,{id,sede_id:siteId,perfil_id:profile.id,fecha_hora:fecha,notas:asText(notas)}]));
 const custom=new Map(),records=[];
 const options=new Map(),machines=new Map();
 for(const [id,exerciseId,campo,valor] of t.exerciseDetail){
  if(!asText(valor))continue;
  if(campo==='Instrumento'){
   const key=asText(valor).toLocaleLowerCase('es');
   if(!machines.has(key))machines.set(key,{id,nombre:valor,tipo_equipo:'Otro',tipo_origen:'no_especificado',origen:'hojamatriz'});
  }
  const type={'Anotación':'zona','Agarre / Implemento':'accesorio','Técnica':'tecnica'}[campo];
  if(type){const key=type+':'+asText(valor).toLocaleLowerCase('es');
   if(!options.has(key))options.set(key,{id,nombre:valor,tipo:type,origen:'hojamatriz'});}
 }
 for(const [id,sessionId,exerciseId,number,sub,weight,unit,reps,assistance,other] of t.series){
  const session=sessions.get(sessionId),site=sites.get(session.sede_id),gym=gyms.get(site.gimnasio_id),exercise=exercises.get(exerciseId);
  const detail=key=>exercise.detalles.find(x=>x.campo===key)?.valor||'';
  const type='Otro',equipment=detail('Instrumento')||'No especificado',accessory=detail('Agarre / Implemento')||'No especificado';
  const technique=detail('Técnica')||'No especificada',zone=detail('Anotación')||'Sin clasificar';
  const row={id,origin:'hojamatriz',importTag:'hojamatriz-20261018',date:session.fecha_hora.slice(0,10),
   gym:gym.nombre,sede:site.nombre,gymId:gym.id,siteId:site.id,sessionId,exerciseId,
   zone,type,equipment,accessory,grip:'No especificado',exercise:exercise.nombre,
   technique,notes:asText(other),sessionNotes:session.notas,series:'Serie '+number,
   subdivision:sub||'-',weight,reps,assistance,unit,
   weightUnitDeclared:unit!==null,createdAt:session.fecha_hora.replace(' ','T')+':00',remoteId:null};
  records.push(row);
  const key=site.id+':'+exerciseId;
  if(!custom.has(key))custom.set(key,{id:'seed:'+key,gimnasio_id:gym.id,sede_id:site.id,
   ejercicio_id:exerciseId,g:gym.nombre,s:site.nombre,e:exercise.nombre,z:zone,
   i:equipment,a:accessory,gr:'No especificado',kind:type,t:[technique],origen:'hojamatriz'});
 }
 const data={...emptyFactory(),records,library:[...exercises.values()],custom:[...custom.values()],
  sessions:[...sessions.values()],entities:{gyms:[...gyms.values()],sites:[...sites.values()],machines:[...machines.values()],options:[...options.values()]},
  readOnly:false,demo:true,cloudUserId:null,lastPull:null,syncMode:'later',pending:[],tombstones:[],
  importInfo:{source:'GymLytics (HojaMatriz).xlsx',approvedModel:seed.metadata.approvedModel,
   importedTag:'hojamatriz-20261018',counts,excludedRows:seed.metadata.excludedRows,
   weightUnit:'no especificada en origen',importMode:'única vez, perfil independiente, sin nube'}};
 return {id:profile.id,name:profile.name,modifiedAt,data};
}
/** Funciona con almacenamiento local inyectado; no utiliza redes ni archivos externos. */
export async function installGymlyticsSeed(seed,{get,put,mark,alreadyImported,emptyFactory}){
 const validated=validateGymlyticsSeed(seed);
 if(alreadyImported()||await get(seed.profile.id))return {installed:false,counts:validated};
 const profile=createGymlyticsSeedProfile(seed,emptyFactory);
 await put(profile);mark();
 return {installed:true,counts:validated};
}