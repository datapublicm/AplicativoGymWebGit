-- Solo ProyectosPrueba / sch_android_gymlytics. No altera tbl_series ni reportes existentes.
CREATE TABLE IF NOT EXISTS sch_android_gymlytics.tbl_sync_series (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source_key text NOT NULL CHECK (source_key ~ '^(local|legacy):[0-9a-f-]{36}$'),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 version bigint NOT NULL DEFAULT 1 CHECK (version>0),
 deleted boolean NOT NULL DEFAULT false,
 last_op uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,source_key)
);
CREATE INDEX IF NOT EXISTS gym_sync_series_updated_idx ON sch_android_gymlytics.tbl_sync_series(user_id,updated_at);
ALTER TABLE sch_android_gymlytics.tbl_sync_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gym_sync_series_owner_select ON sch_android_gymlytics.tbl_sync_series;
CREATE POLICY gym_sync_series_owner_select ON sch_android_gymlytics.tbl_sync_series
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id
  AND sch_android_gymlytics.usuario_habilitado());
REVOKE ALL ON sch_android_gymlytics.tbl_sync_series FROM anon,authenticated;
GRANT SELECT ON sch_android_gymlytics.tbl_sync_series TO authenticated;

CREATE TABLE IF NOT EXISTS sch_android_gymlytics.tbl_sync_ops (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 op_id uuid NOT NULL,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,op_id)
);
ALTER TABLE sch_android_gymlytics.tbl_sync_ops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sch_android_gymlytics.tbl_sync_ops FROM anon,authenticated;

CREATE OR REPLACE FUNCTION sch_android_gymlytics.aplicar_cambios_offline(p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $BODY$
DECLARE
 v_uid uuid:=auth.uid(); v_item jsonb; v_result jsonb; v_answer jsonb:='[]'::jsonb;
 v_old sch_android_gymlytics.tbl_sync_series%ROWTYPE;
 v_log sch_android_gymlytics.tbl_sync_ops%ROWTYPE;
 v_id uuid; v_key text; v_action text; v_expected bigint; v_payload jsonb; v_version bigint;
BEGIN
 IF v_uid IS NULL OR NOT sch_android_gymlytics.usuario_habilitado() THEN
  RAISE EXCEPTION 'Cuenta Gymlytics no habilitada' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_changes)<>'array' OR jsonb_array_length(p_changes)>50 THEN
  RAISE EXCEPTION 'Se requieren entre 0 y 50 operaciones';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  IF jsonb_typeof(v_item)<>'object' OR jsonb_typeof(v_item->'op_id')<>'string'
    OR jsonb_typeof(v_item->'source_key')<>'string'
    OR jsonb_typeof(v_item->'action')<>'string' THEN
   RAISE EXCEPTION 'Operación inválida';
  END IF;
  v_id:=(v_item->>'op_id')::uuid;
  v_key:=v_item->>'source_key';
  v_action:=v_item->>'action';
  IF v_key !~ '^(local|legacy):[0-9a-f-]{36}$' OR v_action NOT IN ('upsert','delete')
    OR jsonb_typeof(v_item->'expected_version')<>'number' THEN
   RAISE EXCEPTION 'Clave, acción o versión inválida';
  END IF;
  v_expected:=(v_item->>'expected_version')::bigint;
  IF v_expected<0 THEN RAISE EXCEPTION 'Versión negativa'; END IF;
  v_payload:=CASE WHEN v_action='upsert' THEN v_item->'payload' ELSE '{}'::jsonb END;
  IF v_action='upsert' THEN
   IF jsonb_typeof(v_payload)<>'object' OR length(v_payload::text)>12000
     OR nullif(btrim(v_payload->>'exercise'),'') IS NULL
     OR (v_payload->>'date') !~ '^\\d{4}-\\d{2}-\\d{2}$'
     OR nullif(btrim(v_payload->>'gym'),'') IS NULL
     OR nullif(btrim(v_payload->>'sede'),'') IS NULL
     OR (v_payload->>'unit') NOT IN ('kg','lb')
     OR (v_payload->>'weight') !~ '^\\d+(\\.\\d+)?$'
     OR (v_payload->>'reps') !~ '^\\d+(\\.\\d+)?$'
     OR (v_payload->>'reps')::numeric<=0 THEN
    RAISE EXCEPTION 'Contenido de serie inválido';
   END IF;
  END IF;
  -- El candado por usuario y serie impide carreras de primeras inserciones.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||v_key,0));
  SELECT * INTO v_log FROM sch_android_gymlytics.tbl_sync_ops
   WHERE user_id=v_uid AND op_id=v_id;
  IF FOUND THEN
   IF v_log.request<>v_item THEN RAISE EXCEPTION 'El identificador de operación fue reutilizado'; END IF;
   v_answer:=v_answer||jsonb_build_array(v_log.response||jsonb_build_object('status','duplicate'));
   CONTINUE;
  END IF;
  SELECT * INTO v_old FROM sch_android_gymlytics.tbl_sync_series
   WHERE user_id=v_uid AND source_key=v_key FOR UPDATE;
  IF FOUND THEN
   IF v_old.version<>v_expected THEN
    v_result=jsonb_build_object('op_id',v_id,'status','conflict',
     'current',jsonb_build_object('source_key',v_key,'version',v_old.version,
     'payload',v_old.payload,'deleted',v_old.deleted,'updated_at',v_old.updated_at));
   ELSE
    v_version:=v_old.version+1;
    UPDATE sch_android_gymlytics.tbl_sync_series
     SET payload=CASE WHEN v_action='upsert' THEN v_payload ELSE payload END,
         deleted=(v_action='delete'), version=v_version,last_op=v_id,updated_at=clock_timestamp()
    WHERE user_id=v_uid AND source_key=v_key;
    v_result=jsonb_build_object('op_id',v_id,'status','applied','version',v_version);
   END IF;
  ELSIF v_expected<>0 THEN
   v_result=jsonb_build_object('op_id',v_id,'status','conflict','current',null);
  ELSE
   v_version:=1;
   INSERT INTO sch_android_gymlytics.tbl_sync_series
    (user_id,source_key,payload,version,deleted,last_op)
   VALUES(v_uid,v_key,v_payload,1,v_action='delete',v_id);
   v_result=jsonb_build_object('op_id',v_id,'status','applied','version',1);
  END IF;
  INSERT INTO sch_android_gymlytics.tbl_sync_ops(user_id,op_id,request,response)
  VALUES(v_uid,v_id,v_item,v_result);
  v_answer:=v_answer||jsonb_build_array(v_result);
 END LOOP;
 RETURN v_answer;
END;
$BODY$;
REVOKE ALL ON FUNCTION sch_android_gymlytics.aplicar_cambios_offline(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sch_android_gymlytics.aplicar_cambios_offline(jsonb) TO authenticated;
