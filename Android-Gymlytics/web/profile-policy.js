// Gymlytics 01.06 · Política pura de aislamiento de perfiles offline.
// Sin lecturas de red, sin borrado, sin compartir historiales entre usuarios.
export const profileMeta=p=>({
 id:p.id,name:p.name,modifiedAt:p.modifiedAt||null,
 cloudUserId:p.data?.cloudUserId||null,
 records:Number(p.data?.records?.length||0),
 pending:Number(p.data?.pending?.length||0)
});
export function validateProfileName(value,profiles=[],excludeId=null){
 const name=String(value||'').trim().replace(/\s+/g,' ');
 if(!name||name.length>60)throw Error('Escribe un nombre de perfil entre 1 y 60 caracteres.');
 if(profiles.some(p=>p.id!==excludeId&&p.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))
  throw Error('Ya existe un perfil con ese nombre.');
 return name;
}
export function validateProfileBinding(profiles,activeId,uid){
 if(!activeId||!uid)throw Error('Selecciona un perfil y una cuenta válidos.');
 const active=profiles.find(p=>p.id===activeId);
 if(!active)throw Error('El perfil activo ya no existe.');
 if(active.cloudUserId&&active.cloudUserId!==uid)
  throw Error('Este perfil está vinculado a otra cuenta. No se mezclarán entrenamientos.');
 if(profiles.some(p=>p.id!==activeId&&p.cloudUserId===uid))
  throw Error('Esta cuenta ya está asociada a otro perfil del dispositivo.');
 return true;
}
export function verifyRestoreBackup(backup,profiles){
 if(backup?.format!=='gymlytics-profile-backup'||backup.version!==1||!backup.data||
   !Array.isArray(backup.data.records)||!Array.isArray(backup.data.pending)||
   !Array.isArray(backup.data.tombstones)||!Array.isArray(backup.data.custom)||
   !Array.isArray(backup.data.library)||!backup.data.entities)
  throw Error('No es una copia de seguridad completa y compatible.');
 const uid=backup.data.cloudUserId;
 if(uid&&profiles.some(p=>p.cloudUserId===uid))
  throw Error('Ya existe otro perfil de este dispositivo vinculado a esa cuenta. No es seguro duplicar esa vinculación; conserva la copia como respaldo.');
 return true;
}
