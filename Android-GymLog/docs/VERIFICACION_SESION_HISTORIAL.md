# Verificación de Gymlytics 01.04 — rama Android-Gymlytics

Revisión de código y Supabase **Pruebas** (10/10/2026). No modifica datos ni autenticación.

## Organización de proyectos
- `Android-Gymlytics/` es el único proyecto presente en esta rama, junto con su README y workflow de pruebas.
- La rama `Web-Hostinger` contiene el proyecto web por separado.
- `main` y `feature/organizacion-web-android` permanecen como versión publicada y respaldo, respectivamente.
- Ninguna de las ramas se ha convertido en una APK compilada.

## Evidencia técnica
- GitHub Actions de separación: 27/27 pruebas Node Android aprobadas.
- Política RLS de `tbl_series`: `gymlog_acceso_activo_tbl_series` es **RESTRICTIVE**, por lo que se combina con la política **PERMISSIVE** `tbl_series_leer_propio`, cuyo filtro es `user_id = auth.uid()`.
- `tbl_usuarios` y `tbl_opciones_personales` también combinan la verificación restrictiva de cuenta habilitada con condiciones de titularidad.
- `vw_historial_series` tiene `security_invoker = true`, por lo que respeta los permisos y RLS del invocador.
- Supabase Pruebas: 2 cuentas, 18.526 series en total; 9.263 series por cuenta (consulta de solo lectura).
- En `tests/history-cloud-isolation.test.mjs` se ejecuta la lógica real de `cloud.loadHistory()` con base de datos simulada: descarga paginada de 9.263 registros de un solo usuario y aborto si cambia la sesión.

## Todavía pendiente
- **No se ha verificado** el acceso desde una sesión real de Android, ni la exposición efectiva de `sch_android_gymlytics` a la Data API a través de la app.
- El test simulado **no demuestra** recuperación efectiva de 9.263 series desde Supabase.
- La URL pública HTTPS de recuperación de contraseñas sigue sin configurar y no se envían correos.
- No se instalaron dependencias ni se generó una APK. Compilación Android solo con autorización expresa.

### Migración Gymlytics (10/10/2026)
El esquema Supabase se llama `sch_android_gymlytics`. Se conservaron 18.526 series, 6.218 reportes y 2 usuarios, RLS y el acceso a funciones. El Data API expone el esquema nuevo y los esquemas originales de otras aplicaciones. La prueba real autenticada sigue pendiente. Los buckets privados siguen identificados como `gymlog-usuarios` y `gymlog-anatomia` por permisos insuficientes para renombrar sus políticas.
