-- Alta autónoma, solo cuando el usuario inicia sesión y confirmó su correo.
-- No activa cuentas suspendidas ni crea usuarios para otras aplicaciones.
CREATE OR REPLACE FUNCTION sch_android_gymlytics.asegurar_perfil_gymlytics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_uid uuid:=auth.uid(); v_email text; v_activo boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión antes de vincular el perfil' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO v_email FROM auth.users
 WHERE id=v_uid AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN
  RAISE EXCEPTION 'Debes confirmar tu dirección de correo antes de crear tu cuenta Gymlytics'
   USING ERRCODE='42501';
 END IF;
 INSERT INTO sch_android_gymlytics.tbl_usuarios(id,email,usuario,nombre,rol,activo)
 VALUES(v_uid,v_email,'gym_'||replace(v_uid::text,'-',''),split_part(v_email,'@',1),'usuario',true)
 ON CONFLICT(id) DO NOTHING;
 SELECT activo INTO v_activo FROM sch_android_gymlytics.tbl_usuarios WHERE id=v_uid;
 RETURN jsonb_build_object('id',v_uid,'activo',v_activo);
END;
$$;
REVOKE ALL ON FUNCTION sch_android_gymlytics.asegurar_perfil_gymlytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sch_android_gymlytics.asegurar_perfil_gymlytics() TO authenticated;
