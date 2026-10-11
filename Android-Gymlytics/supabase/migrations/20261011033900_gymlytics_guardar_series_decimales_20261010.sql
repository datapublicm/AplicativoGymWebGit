-- Applied in Supabase ProyectosPrueba as migration 20261011033900.
-- Safe re-declaration of the RPC. Only changes repetitions and assistance JSON
-- casts from INTEGER to NUMERIC, preserving the invoker's RLS/auth checks.
-- Do not deploy this migration to Production without explicit approval.

CREATE OR REPLACE FUNCTION sch_android_gymlytics.guardar_entrenamiento(
 p_fecha date, p_gimnasio_id uuid, p_sede_id uuid, p_ejercicio_id uuid,
 p_tecnica text, p_observaciones text, p_series jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE rid uuid; item jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT sch_android_gymlytics.usuario_habilitado() THEN
  RAISE EXCEPTION 'Cuenta Gymlytics no habilitada';
 END IF;
 IF p_series IS NULL OR jsonb_typeof(p_series)<>'array' OR jsonb_array_length(p_series) NOT BETWEEN 1 AND 24 THEN
  RAISE EXCEPTION 'Se requieren entre 1 y 24 filas de series';
 END IF;
 INSERT INTO sch_android_gymlytics.tbl_reportes(user_id,fecha,gimnasio_id,sede_id,ejercicio_id,tecnica_registrada,observaciones)
 VALUES(auth.uid(),p_fecha,p_gimnasio_id,p_sede_id,p_ejercicio_id,p_tecnica,p_observaciones)
 RETURNING id INTO rid;
 FOR item IN SELECT value FROM jsonb_array_elements(p_series)
 LOOP
  INSERT INTO sch_android_gymlytics.tbl_series(user_id,reporte_id,numero_serie,subdivision,unidad,peso,repeticiones,asistencias)
  VALUES(auth.uid(),rid,(item->>'numero_serie')::integer,NULLIF(item->>'subdivision',''),
   COALESCE(item->>'unidad','kg'),(item->>'peso')::numeric,
   (item->>'repeticiones')::numeric,COALESCE((item->>'asistencias')::numeric,0));
 END LOOP;
 RETURN rid;
END;
$function$;
