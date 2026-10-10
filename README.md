# Gymlytics — proyecto Android

Código de Gymlytics 01.04, separado de la web oficial. La **carpeta ya se llama `Android-Gymlytics/`**, mientras la rama sigue siendo `Android-GymLog` hasta poder renombrarla en GitHub sin crear referencias duplicadas.

- Aplicación: Gymlytics · identificador Capacitor `com.datapublicm.gymlytics`.
- Supabase Pruebas: proyecto compartido `ProyectosPrueba`, esquema `sch_android_gymlytics`, aplicación `app_core.apps.slug='gymlytics'`.
- Login por nombre de usuario: función `gymlytics-login-usuario`.
- Los depósitos de Storage conservan por compatibilidad sus IDs `gymlog-usuarios` y `gymlog-anatomia`. Las políticas siguen sujetas a permisos de propietario.
- Historial verificado en la base: 18.526 series y 6.218 reportes de dos cuentas.
- Pruebas estáticas: `cd Android-Gymlytics && npm run test:static`.
- Las pruebas automatizadas no sustituyen la autenticación ni descarga real de la aplicación.
- No se ha compilado APK, publicado ni modificado la rama oficial `main`.
