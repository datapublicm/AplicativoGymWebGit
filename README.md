# Gymlytics — proyecto Android

La rama **`Android-Gymlytics`** y la carpeta **`Android-Gymlytics/`** tienen el mismo nombre. El cambio se realizó mediante la operación oficial de renombrado de GitHub; no se creó ninguna rama duplicada.

- Aplicación: **Gymlytics**; identificador Capacitor: `com.datapublicm.gymlytics`.
- Supabase Pruebas compartido `ProyectosPrueba`: esquema `sch_android_gymlytics` y registro `app_core.apps.slug='gymlytics'`.
- Inicio de sesión por usuario: función Edge `gymlytics-login-usuario`.
- Los buckets privados conservan por compatibilidad sus IDs `gymlog-usuarios` y `gymlog-anatomia` hasta una migración autorizada de sus políticas.
- Historial conservado en Pruebas: 18.526 series, 6.218 reportes y dos cuentas.
- Ejecutar pruebas: `cd Android-Gymlytics && npm run test:static` (no compila APK).
- Falta validar inicio de sesión, catálogos y descarga de historial desde un cliente real con credenciales de Pruebas.
- La rama `main`, publicación oficial, Producción y modelos 3D no se han modificado.
