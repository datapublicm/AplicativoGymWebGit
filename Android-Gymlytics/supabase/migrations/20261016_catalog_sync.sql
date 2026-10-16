-- Gymlytics · sincronización de catálogo: transacciones idempotentes y RLS.
-- No migra ni borra registros existentes.
create table if not exists sch_android_gymlytics.tbl_sync_catalogo_operaciones (
 op_id uuid primary key,
 user_id uuid not null references auth.users(id),
 solicitud jsonb not null,
 respuesta jsonb not null,
 created_at timestamptz not null default now()
);
alter table sch_android_gymlytics.tbl_sync_catalogo_operaciones enable row level security;
revoke all on sch_android_gymlytics.tbl_sync_catalogo_operaciones from anon, authenticated;

create or replace function sch_android_gymlytics.aplicar_cambio_catalogo(p_change jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_uid uuid := auth.uid();
 v_op uuid; v_id uuid;
 v_kind text := p_change->>'kind';
 v_action text := p_change->>'action';
 v_table text; v_name text := btrim(p_change->'payload'->>'nombre');
 v_expected jsonb := p_change->'expected';
 v_gym uuid; v_tipo text; v_team text;
 v_previous jsonb; v_saved jsonb; v_row jsonb; v_snapshot jsonb; v_result jsonb;
begin
 if v_uid is null or not sch_android_gymlytics.usuario_habilitado()
    or sch_android_gymlytics.es_cuenta_prueba() then
   raise exception 'Solo una cuenta personal habilitada puede actualizar el catálogo';
 end if;
 if p_change is null or jsonb_typeof(p_change)<>'object' then raise exception 'Solicitud inválida'; end if;
 begin
  v_op := (p_change->>'op_id')::uuid; v_id := (p_change->>'id')::uuid;
 exception when others then raise exception 'Identificadores inválidos'; end;
 if v_op is null or v_id is null then raise exception 'Identificadores obligatorios'; end if;
 if v_kind not in ('gym','site','machine','option','exercise')
   or v_action not in ('create','update','delete') then raise exception 'Operación no permitida'; end if;
 v_table := case v_kind when 'gym' then 'tbl_gimnasios' when 'site' then 'tbl_sedes'
  when 'machine' then 'tbl_maquinas' when 'option' then 'tbl_opciones_personales'
  else 'tbl_ejercicios' end;
 if v_action <> 'delete' and (v_name is null or length(v_name)=0 or length(v_name)>180) then
  raise exception 'Nombre de catálogo inválido'; end if;
 -- Serializar por usuario/categoría: no hay dos escrituras simultáneas con el mismo nombre.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||v_kind,0));
 select solicitud,respuesta into v_previous,v_saved
 from sch_android_gymlytics.tbl_sync_catalogo_operaciones where op_id=v_op;
 if found then
  if v_previous <> p_change then raise exception 'El identificador de operación fue reutilizado con otros datos'; end if;
  return v_saved || jsonb_build_object('status','duplicate');
 end if;
 execute format('select pg_catalog.to_jsonb(t) from sch_android_gymlytics.%I t where id=$1 and user_id=$2',v_table)
 into v_row using v_id,v_uid;
 if v_action='create' then
  if v_row is not null then return jsonb_build_object('op_id',v_op,'status','conflict','reason','id_exists'); end if;
  if v_kind='site' then
   begin v_gym := (p_change->'payload'->>'gimnasio_id')::uuid;
   exception when others then raise exception 'Gimnasio asociado inválido'; end;
   if not exists(select 1 from sch_android_gymlytics.tbl_gimnasios
     where id=v_gym and user_id=v_uid and activo=true) then
    return jsonb_build_object('op_id',v_op,'status','conflict','reason','parent_not_synced');
   end if;
  end if;
  v_tipo := p_change->'payload'->>'tipo';
  v_team := p_change->'payload'->>'tipo_equipo';
  if v_kind='exercise' then
   if exists(select 1 from sch_android_gymlytics.tbl_ejercicios where user_id=v_uid
     and origen='usuario' and activo=true and pg_catalog.lower(nombre)=pg_catalog.lower(v_name)) then
    return jsonb_build_object('op_id',v_op,'status','conflict','reason','duplicate_name');
   end if;
  else
   execute format('select 1 from sch_android_gymlytics.%I where user_id=$1 and activo=true and pg_catalog.lower(nombre)=pg_catalog.lower($2)%s limit 1',
    v_table,case v_kind when 'site' then ' and gimnasio_id=$3'
     when 'option' then ' and tipo=$3' else '' end)
   into v_previous using v_uid,v_name,
    case v_kind when 'site' then v_gym::text when 'option' then v_tipo else null end;
   if v_previous is not null then
    return jsonb_build_object('op_id',v_op,'status','conflict','reason','duplicate_name'); end if;
  end if;
  if v_kind='gym' then
   insert into sch_android_gymlytics.tbl_gimnasios(id,user_id,nombre) values(v_id,v_uid,v_name);
  elsif v_kind='site' then
   insert into sch_android_gymlytics.tbl_sedes(id,user_id,gimnasio_id,nombre)
    values(v_id,v_uid,v_gym,v_name);
  elsif v_kind='machine' then
   insert into sch_android_gymlytics.tbl_maquinas(id,user_id,nombre,tipo_equipo)
    values(v_id,v_uid,v_name,coalesce(nullif(v_team,''),'Máquina'));
  elsif v_kind='option' then
   if v_tipo not in ('zona','agarre','accesorio','tecnica') then raise exception 'Tipo de opción no permitido'; end if;
   insert into sch_android_gymlytics.tbl_opciones_personales(id,user_id,nombre,tipo)
    values(v_id,v_uid,v_name,v_tipo);
  else
   insert into sch_android_gymlytics.tbl_ejercicios(id,user_id,origen,nombre,zona_entrenamiento,tecnica_actualizada)
    values(v_id,v_uid,'usuario',v_name,
     coalesce(nullif(p_change->'payload'->>'zona_entrenamiento',''),'Sin clasificar'),
     coalesce(nullif(p_change->'payload'->>'tecnica_actualizada',''),'Ejecución base'));
  end if;
 else
  if v_row is null or v_row->>'activo'='false'
   or (v_kind='exercise' and v_row->>'origen'<>'usuario') then
   return jsonb_build_object('op_id',v_op,'status','conflict','reason','missing_or_not_owned'); end if;
  v_snapshot := jsonb_build_object('nombre',v_row->'nombre','activo',v_row->'activo');
  if v_kind='site' then v_snapshot:=v_snapshot||jsonb_build_object('gimnasio_id',v_row->'gimnasio_id'); end if;
  if v_kind='machine' then v_snapshot:=v_snapshot||jsonb_build_object('tipo_equipo',v_row->'tipo_equipo'); end if;
  if v_kind='option' then v_snapshot:=v_snapshot||jsonb_build_object('tipo',v_row->'tipo'); end if;
  if v_kind='exercise' then v_snapshot:=v_snapshot||jsonb_build_object(
   'zona_entrenamiento',v_row->'zona_entrenamiento','tecnica_actualizada',v_row->'tecnica_actualizada'); end if;
  if v_expected is null or v_snapshot<>v_expected then
   return jsonb_build_object('op_id',v_op,'status','conflict','reason','remote_changed','current',v_snapshot);
  end if;
  if v_action='update' then
   if v_kind='exercise' then
    if exists(select 1 from sch_android_gymlytics.tbl_ejercicios where user_id=v_uid
     and origen='usuario' and activo=true and id<>v_id and pg_catalog.lower(nombre)=pg_catalog.lower(v_name)) then
     return jsonb_build_object('op_id',v_op,'status','conflict','reason','duplicate_name'); end if;
   else
    execute format('select 1 from sch_android_gymlytics.%I where user_id=$1 and id<>$2 and activo=true and pg_catalog.lower(nombre)=pg_catalog.lower($3)%s limit 1',
     v_table, case v_kind when 'site' then ' and gimnasio_id=$4'
      when 'option' then ' and tipo=$4' else '' end)
    into v_previous using v_uid,v_id,v_name,
     case v_kind when 'site' then v_row->>'gimnasio_id' when 'option' then v_row->>'tipo' else null end;
    if v_previous is not null then
     return jsonb_build_object('op_id',v_op,'status','conflict','reason','duplicate_name'); end if;
   end if;
   execute format('update sch_android_gymlytics.%I set nombre=$1,updated_at=now() where id=$2 and user_id=$3',v_table)
   using v_name,v_id,v_uid;
  else
   if v_kind='gym' and exists(select 1 from sch_android_gymlytics.tbl_sedes where gimnasio_id=v_id and user_id=v_uid and activo=true)
   then return jsonb_build_object('op_id',v_op,'status','conflict','reason','gym_has_sites'); end if;
   execute format('update sch_android_gymlytics.%I set activo=false,updated_at=now() where id=$1 and user_id=$2',v_table)
   using v_id,v_uid;
  end if;
 end if;
 execute format('select pg_catalog.to_jsonb(t) from sch_android_gymlytics.%I t where id=$1 and user_id=$2',v_table)
 into v_row using v_id,v_uid;
 v_snapshot := jsonb_build_object('nombre',v_row->'nombre','activo',v_row->'activo');
 if v_kind='site' then v_snapshot:=v_snapshot||jsonb_build_object('gimnasio_id',v_row->'gimnasio_id'); end if;
 if v_kind='machine' then v_snapshot:=v_snapshot||jsonb_build_object('tipo_equipo',v_row->'tipo_equipo'); end if;
 if v_kind='option' then v_snapshot:=v_snapshot||jsonb_build_object('tipo',v_row->'tipo'); end if;
 if v_kind='exercise' then v_snapshot:=v_snapshot||jsonb_build_object(
  'zona_entrenamiento',v_row->'zona_entrenamiento','tecnica_actualizada',v_row->'tecnica_actualizada'); end if;
 v_result := jsonb_build_object('op_id',v_op,'status','applied','current',v_snapshot);
 insert into sch_android_gymlytics.tbl_sync_catalogo_operaciones(op_id,user_id,solicitud,respuesta)
 values(v_op,v_uid,p_change,v_result);
 return v_result;
end;
$$;
revoke all on function sch_android_gymlytics.aplicar_cambio_catalogo(jsonb) from public;
grant execute on function sch_android_gymlytics.aplicar_cambio_catalogo(jsonb) to authenticated;
