# Gymlytics — aplicación de entrenamiento (desarrollo Android)

**Nombre comercial:** Gymlytics (antes GymLog). Rama y carpeta de origen `Android-GymLog`, conservadas provisionalmente para no duplicar ni reemplazar ramas.

- Nombre visible: Gymlytics en la interfaz, manifest y Capacitor.
- Identificador Android `com.datapublicm.gymlog` se mantiene por compatibilidad.
- Backend Supabase Pruebas `ProyectosPrueba` (compartido con otros sistemas), esquema `sch_android_gymlog` y claves `VITE_GYMLOG_*` se mantienen como identificadores técnicos. Renombrarlos requiere migración coordinada: no confundir identidad de marca con identidad de base de datos.
- Para las pruebas: `cd Android-GymLog && npm run test:static`.
- Pendientes: inicio de sesión real, catálogos e historial desde Android.
- No hay APK compilada, ni despliegues, ni cambios de datos de Supabase ni modificaciones de `main`.
