-- Bloque 3. Metadatos aislados de fotografías offline en bucket privado existente.
-- No modifica ni elimina fotografías anteriores.
create table if not exists sch_android_gymlytics.tbl_fotos_offline (
 user_id uuid not null references auth.users(id),
 photo_key text not null check (length(photo_key) between 3 and 550),
 tipo_referencia text not null check (tipo_referencia in ('maquina','ejercicio','musculos')),
 vista text null check (vista in ('frontal','posterior','lateral_izquierda','lateral_derecha')),
 revision uuid not null,
 storage_path text not null,
 updated_at timestamptz not null default now(),
 primary key (user_id,photo_key),
 unique(user_id,revision),
 constraint gym_foto_vista check (
  (tipo_referencia='musculos' and vista is not null)
  or (tipo_referencia in ('maquina','ejercicio') and vista is null))
);
alter table sch_android_gymlytics.tbl_fotos_offline enable row level security;
create policy gym_fotos_offline_select on sch_android_gymlytics.tbl_fotos_offline
 for select to authenticated using (user_id=(select auth.uid())
 and sch_android_gymlytics.usuario_habilitado());
revoke insert,update,delete on sch_android_gymlytics.tbl_fotos_offline from anon,authenticated;
grant select on sch_android_gymlytics.tbl_fotos_offline to authenticated;

create or replace function sch_android_gymlytics.confirmar_foto_offline(p_photo jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_uid uuid:=auth.uid();
 v_key text:=p_photo->>'photo_key';
 v_tipo text:=p_photo->>'tipo_referencia';
 v_vista text:=nullif(p_photo->>'vista','');
 v_revision uuid;
 v_expected uuid;
 v_path text:=p_photo->>'storage_path';
 v_actual sch_android_gymlytics.tbl_fotos_offline%rowtype;
begin
 if v_uid is null or not sch_android_gymlytics.usuario_habilitado()
 or sch_android_gymlytics.es_cuenta_prueba()
 then raise exception 'La cuenta de prueba no puede subir fotografías'; end if;
 if v_key is null or length(v_key) not between 3 and 550
 or v_tipo not in ('maquina','ejercicio','musculos')
 or (v_tipo='musculos' and v_vista not in ('frontal','posterior','lateral_izquierda','lateral_derecha'))
 or (v_tipo<>'musculos' and v_vista is not null)
 then raise exception 'Tipo o referencia fotográfica inválida'; end if;
 begin
  v_revision:=(p_photo->>'revision')::uuid;
  v_expected:=nullif(p_photo->>'expected_revision','')::uuid;
 exception when others then raise exception 'Versiones de fotografía inválidas'; end;
 if v_revision is null then raise exception 'Falta identificador de versión'; end if;
 if v_path is distinct from (v_uid::text||'/gymlytics/'||v_revision::text||'.jpg')
 then raise exception 'La ruta de Storage no pertenece a la cuenta'; end if;
 if not exists(select 1 from storage.objects where bucket_id='gymlog-usuarios' and name=v_path)
 then raise exception 'El archivo todavía no está en Storage'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||v_key,0));
 select * into v_actual from sch_android_gymlytics.tbl_fotos_offline
 where user_id=v_uid and photo_key=v_key for update;
 if found and v_actual.revision=v_revision and v_actual.storage_path=v_path then
  return jsonb_build_object('status','duplicate','revision',v_revision,'photo_key',v_key);
 end if;
 if (v_actual.revision is distinct from v_expected) then
  return jsonb_build_object('status','conflict','photo_key',v_key,
   'current_revision',v_actual.revision);
 end if;
 insert into sch_android_gymlytics.tbl_fotos_offline
 (user_id,photo_key,tipo_referencia,vista,revision,storage_path)
 values(v_uid,v_key,v_tipo,v_vista,v_revision,v_path)
 on conflict (user_id,photo_key) do update
 set tipo_referencia=excluded.tipo_referencia,vista=excluded.vista,
 revision=excluded.revision,storage_path=excluded.storage_path,updated_at=now();
 return jsonb_build_object('status','applied','revision',v_revision,'photo_key',v_key);
end;
$$;
revoke all on function sch_android_gymlytics.confirmar_foto_offline(jsonb) from public;
grant execute on function sch_android_gymlytics.confirmar_foto_offline(jsonb) to authenticated;
