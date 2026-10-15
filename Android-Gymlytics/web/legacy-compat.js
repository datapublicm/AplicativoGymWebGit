import {payloadOf,sourceKey} from './sync-engine.js';

// Puente de lectura para clientes anteriores que escriben directamente en tbl_series.
// Las modificaciones de clientes antiguos NO incluyen un reloj de versión que
// el RPC de 01.06 pueda comparar. No sobrescribirlas ni resolverlas a ciegas.
const canonical=value=>{
 const data=payloadOf(value),out={};
 for(const [key,v] of Object.entries(data)){
  if(['weight','reps','assistance'].includes(key))out[key]=Number(v??0);
  else if(['notes','subdivision','createdAt'].includes(key))out[key]=v??'';
  else out[key]=v??null;
 }
 return out;
};
const fingerprint=(record)=>JSON.stringify(canonical(record));
export function legacyAlerts(data,history,mirror=[]){
 const present=new Map(history.map(r=>['legacy:'+r.id,r]));
 const overlay=new Map(mirror.map(x=>[x.source_key,x]));
 const conflicts=new Map((data.conflicts||[]).map(x=>[x.sourceKey,x]));
 let changed=0,missing=0;
 for(const row of data.records||[]){
  const key=sourceKey(row);
  if(!key.startsWith('legacy:')||!row.remoteId)continue;
  if((data.tombstones||[]).some(t=>t.syncKey===key))continue;
  const incoming=present.get(key),shadow=overlay.get(key);
  // Los registros del histórico anterior deben tener una base estable.
  // Para datos importados por builds preliminares, solo establecer base si
  // el contenido local sigue igual al contenido que devuelve el servidor.
  if(!row.lastLegacyPayload&&incoming&&fingerprint(row)===fingerprint(incoming))
   row.lastLegacyPayload=canonical(incoming);
  const reference=row.lastLegacyPayload;
  const altered=incoming&&reference&&fingerprint(incoming)!==fingerprint(reference);
  const uncertain=incoming&&!reference&&fingerprint(incoming)!==fingerprint(row);
  const disappeared=!incoming&&!shadow;
  if(!altered&&!uncertain&&!disappeared)continue;
  const conflict={
   sourceKey:key,kind:'legacy_unversioned',local:canonical(row),
   server:incoming?{source_key:key,payload:canonical(incoming),version:Number(shadow?.version||row.cloudVersion||0),deleted:false}
    :{source_key:key,payload:{},version:Number(shadow?.version||row.cloudVersion||0),deleted:true},
   message:'El historial de una versión anterior cambió sin control de versión. Usa clientes actualizados para resolverlo; no se sobrescribirán datos.'
  };
  if(!conflicts.has(key))conflicts.set(key,conflict);
  if(disappeared)missing++;else changed++;
 }
 data.conflicts=[...conflicts.values()];
 return {changed,missing};
}
export const normalizeLegacySnapshot=canonical;
