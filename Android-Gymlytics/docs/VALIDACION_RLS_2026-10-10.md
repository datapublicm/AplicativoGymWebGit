# Gymlytics — verificación RLS de Supabase Pruebas

**Fecha:** 10 de octubre de 2026 (Perú)  
**Proyecto:** `ProyectosPrueba`, referencia `jasuqnxrskhqfobsazwd`  
**Esquema:** `sch_android_gymlytics`  
**Tipo:** verificaciones SQL reales, con **transacciones de solo lectura** y simulación de identidad PostgreSQL. No son una autenticación HTTP/JWT de los usuarios.

## Resultados comprobados

| Condición | Cuenta A | Cuenta B |
|---|---:|---:|
| `usuario_habilitado()` | true | true |
| Perfiles propios visibles | 1 | 1 |
| Series propias visibles | 9.263 | 9.263 |
| Reportes propios visibles | 3.109 | 3.109 |
| Series de otra cuenta visibles | 0 | 0 |
| Reportes de otra cuenta visibles | 0 | 0 |
| Gimnasios de otra cuenta visibles | 0 | 0 |

La cuenta A, probada además sobre gimnasios, sedes, ejercicios y `vw_historial_series`, obtuvo **0 filas ajenas** en cada caso; la vista propia devolvió 9.263 filas.

**Identidad no registrada:** al usar un UUID ficticio con rol `authenticated`, `usuario_habilitado()` devolvió `false`, y las lecturas de usuarios, series, reportes y vista del historial devolvieron 0 filas.

**Rol `anon` (privilegios SQL comprobados):** sin `USAGE` del esquema, sin `SELECT` en usuarios/series/vista y sin `EXECUTE` del RPC `guardar_entrenamiento`. El rol `authenticated` sí tiene los permisos de lectura y ejecución pertinentes; la disponibilidad por fila está condicionada por RLS.

**Configuración de base:** las 15 tablas del esquema tienen RLS; `vw_historial_series` está definida con `security_invoker=true`; el rol `authenticator` tiene configurado el esquema. Se comprobaron 53 políticas del esquema mediante metadatos.

**Storage:** los buckets `gymlog-usuarios` y `gymlog-anatomia` son privados, ambos con 0 objetos en el momento de la comprobación. Las reglas específicas de almacenamiento para fotografías restringen el bucket de usuario mediante identidad autenticada; no se efectuó subida de prueba.

**Conservación de datos:** 2 usuarios, **18.526 series**, **6.218 reportes**, 0 registros en `tbl_fotos`. No se insertó, actualizó ni borró ningún dato de la aplicación.

## Método reproducible (sin revelar identificadores)

Para verificar una cuenta desde una conexión administrativa autorizada, ejecutar como **una transacción**, reemplazando `OFFSET 0` por `OFFSET 1` para la segunda identidad. Se requiere acceso administrativo a la base; **no** utilizar la clave `service_role` en el cliente móvil.

```sql
BEGIN READ ONLY;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT id::text FROM sch_android_gymlytics.tbl_usuarios ORDER BY id OFFSET 0 LIMIT 1),
  true
) IS NOT NULL AS claim_prepared;
SET LOCAL ROLE authenticated;
SELECT current_user AS role_simulated,
       sch_android_gymlytics.usuario_habilitado() AS enabled,
       (SELECT count(*) FROM sch_android_gymlytics.tbl_series) AS own_series,
       (SELECT count(*) FROM sch_android_gymlytics.tbl_series
        WHERE user_id <> auth.uid()) AS other_series,
       (SELECT count(*) FROM sch_android_gymlytics.vw_historial_series
        WHERE user_id <> auth.uid()) AS other_view_rows;
ROLLBACK;
```

La prueba reproduce la aplicación de RLS con `SET LOCAL ROLE authenticated` y `auth.uid()`, pero **no** reproduce emisión, caducidad, revocación o validación de un JWT por GoTrue ni el paso completo por PostgREST.

## Comprobación de red y límites

GitHub Actions confirmó que el gateway HTTPS de `ProyectosPrueba` respondió **HTTP 401 sin API key**. El proyecto dispone de una clave publicable activa, verificada a través del conector; no se expuso la clave. No fue posible ejecutar desde esta sesión `tools/validar-data-api.mjs` con una clave y credenciales de Auth suministradas de manera segura. El éxito de RLS SQL **no equivale** a una prueba HTTP de dos sesiones reales.

Para completar la prueba HTTP será necesario ejecutar el comprobador incluido en el repositorio en un entorno que pueda acceder a Supabase, con la clave publicable de Pruebas y credenciales de **dos cuentas de prueba** cargadas por variables de entorno privadas. No colocar contraseñas ni tokens en commits, logs o mensajes.

## Advertencias del asesor de seguridad de Supabase

- **WARN — Leaked Password Protection Disabled.** El proyecto tiene desactivada la protección contra contraseñas conocidas como comprometidas. <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>
- **INFO — RLS Enabled No Policy**, cuatro tablas en otros esquemas (`public.gymlytics_limites_login`, `public.offline_report_admins`, `sch_android_offline_report.tbl_usuarios_offline`, `web.hostinger_bridge__config`). RLS sin políticas puede ser deliberado para tablas solo administrativas; investigar antes de abrir permisos. <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>

No se modificaron políticas, opciones de Auth, Storage, credenciales ni rama `main`. No se compiló APK.
