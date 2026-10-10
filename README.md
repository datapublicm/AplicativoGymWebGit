# Gymlytics — proyecto Android

Proyecto Gymlytics (antes GymLog), desarrollo 01.04. Esta rama de GitHub aún se identifica como `Android-GymLog` y su carpeta con ese mismo nombre: no se renombraron los refs Git por limitaciones de la integración disponible.

- Aplicación: **Gymlytics** · `com.datapublicm.gymlytics` (identificador Capacitor).
- Supabase Pruebas compartido `ProyectosPrueba`: esquema `sch_android_gymlytics`, registro `app_core.apps.slug='gymlytics'`.
- API de usuario: función Edge `gymlytics-login-usuario` y funciones SQL internas Gymlytics.
- Buckets de almacenamiento conservados: `gymlog-usuarios` y `gymlog-anatomia`; no se cambiaron sus políticas ni se trasladaron objetos (ambos vacíos al verificar).
- Historial: 18.526 series y 6.218 reportes conservados en Supabase Pruebas.
- Validación del proyecto: `cd Android-GymLog && npm run test:static`.
- No se compila la APK; autenticación y recuperación del historial desde Android siguen sin prueba real con credenciales.
- La rama `main` y los datos de Producción siguen intactos.
