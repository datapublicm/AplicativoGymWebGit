// Gymlytics — referencias compartidas editables sólo dentro del perfil offline.
// Los identificadores base: contienen identidad de origen estable (no el nombre editado).
const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const trim=v=>String(v??'').trim();
const ignored=new Set(['','-','no especificado','sin clasificar','pendiente']);
const validKinds=new Set(['gym','site','machine','exercise','zone','grip','technique']);
export const referenceKey=(kind,name,gym='')=>JSON.stringify([kind,norm(name),kind==='site'?norm(gym):'']);
export const referenceId=(kind,name,gym='')=>'base:'+encodeURIComponent(JSON.stringify([kind,trim(name),kind==='site'?trim(gym):'']));
export function parseReferenceId(id){
 if(typeof id!=='string'||!id.startsWith('base:'))return null;
 try{
  const [kind,name,gym]=JSON.parse(decodeURIComponent(id.slice(5)));
  if(!validKinds.has(kind)||!trim(name)||typeof gym!=='string')return null;
  return {kind,name,gym, key:referenceKey(kind,name,gym)};
 }catch{return null;}
}
function rawItems(source,kind){
 const values=[];
 for(const r of source||[]){
  if(kind==='gym')values.push([r.g,'']);
  if(kind==='site')values.push([r.s,r.g]);
  if(kind==='machine')values.push([r.i,'']);
  if(kind==='exercise')values.push([r.e,'']);
  if(kind==='zone')values.push([r.z,'']);
  if(kind==='grip')values.push([r.gr,''],[r.a,'']);
  if(kind==='technique')for(const t of r.t||[])values.push([t,'']);
 }
 const used=new Set(),out=[];
 for(const [name,context] of values){
  const k=referenceKey(kind,name,context);
  if(ignored.has(norm(name))||used.has(k))continue;
  used.add(k);out.push({id:referenceId(kind,name,context),kind,key:k,sourceName:trim(name),sourceGym:trim(context)});
 }
 return out;
}
function effect(map,item){
 const rule=map?.[item.key];
 return {name:trim(rule?.name)||item.sourceName,hidden:rule?.deleted===true};
}
export function listReferenceChoices(source,map,kind,{gymId='',gymName=''}={}){
 if(!validKinds.has(kind))return [];
 const selected=parseReferenceId(gymId);
 const original=kind==='site'&&selected?.kind==='gym'?selected.name:'';
 return rawItems(source,kind).flatMap(item=>{
  const v=effect(map,item);
  if(v.hidden)return [];
  if(kind==='site'){
   const g=effect(map,{key:referenceKey('gym',item.sourceGym),sourceName:item.sourceGym});
   if(g.hidden)return [];
   if(original?norm(item.sourceGym)!==norm(original):gymName&&norm(g.name)!==norm(gymName))return [];
  }
  return [{id:item.id,name:v.name,own:false,reference:true,
   sourceName:item.sourceName,sourceGym:item.sourceGym}];
 }).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));
}
export function materializeReferenceCatalog(source,map={}){
 const out=[];
 for(const raw of source||[]){
  const r=structuredClone(raw);
  let hidden=false;
  for(const [kind,field,scope] of [['gym','g',''],['site','s',raw.g],
    ['machine','i',''],['exercise','e',''],['zone','z',''],['grip','a',''],['grip','gr','']]){
   const original=trim(raw[field]);
   const x=effect(map,{key:referenceKey(kind,original,scope),sourceName:original});
   if(x.hidden){hidden=true;break;}
   r[field]=x.name;
  }
  if(hidden)continue;
  r.t=(raw.t||[]).flatMap(t=>{
   const x=effect(map,{key:referenceKey('technique',t),sourceName:trim(t)});
   return x.hidden?[]:[x.name];
  });
  if(!r.t.length)continue;
  out.push(r);
 }
 return out;
}
export function setReferenceOverride(source,map,id,{name=null,deleted=false}={}){
 const item=parseReferenceId(id);
 if(!item||!rawItems(source,item.kind).some(x=>x.key===item.key))
  throw Error('La referencia no pertenece a este catálogo local');
 if(deleted){
  return {...map,[item.key]:{deleted:true,sourceId:item.id}};
 }
 const value=trim(name).replace(/\s+/g,' ');
 if(!value||value.length>180)throw Error('Escribe un nombre entre 1 y 180 caracteres');
 const others=listReferenceChoices(source,map,item.kind,
  item.kind==='site'?{gymId:referenceId('gym',item.gym)}:{});
 if(others.some(x=>x.id!==item.id&&norm(x.name)===norm(value)))
  throw Error('Ya existe otra referencia con ese nombre');
 if(norm(value)===norm(item.name)){
  const result={...map};delete result[item.key];return result;
 }
 return {...map,[item.key]:{name:value,deleted:false,sourceId:item.id}};
}
