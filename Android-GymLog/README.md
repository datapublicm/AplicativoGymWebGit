# Gymlytics — Android / GitHub Pages / Hostinger · Fuente compartida (v0.2)

Esta es la fuente web completa para continuar la aplicación Gymlytics **sin compilar la APK**. Conserva el diseño móvil oscuro cian y violeta del prototipo v4. El APK final utilizará Capacitor para encapsular esta misma interfaz, sin duplicar los datos.

## Incluido (código desarrollado, integración real aún por probar)

- Cinco pestañas: Sesión, Catálogos, Registro, Tablas y Dashboard; cuatro pestañas bloqueadas hasta autenticación autorizada.
- Supabase Auth con correo/contraseña, registro (sujeto a habilitación administrativa), recuperar acceso, cierre de sesión y sesión persistente.
- Catálogo inicial del Excel de referencia y formulario para ejercicios privados en Supabase (`tbl_gimnasios`, `tbl_sedes`, `tbl_ejercicios`).
- Registro de series normales, Sub1/Sub2 o Derecha/Izquierda, con guardado atómico en la RPC `sch_android_gymlytics.guardar_entrenamiento`.
- Historial y estadísticas basados en `tbl_reportes`/`tbl_series` y filtrados por cuenta.
- Ventana anatómica Fotos/3D que consulta `tbl_ejercicio_musculos`, `tbl_musculos`, `tbl_musculo_imagenes`, `tbl_musculo_zonas3d`; conserva placeholders cuando faltan datos.
- Subida de fotografías del equipo/ejercicio y vistas anatómicas personales al bucket privado `gymlog-usuarios`, registrando rutas en `tbl_fotos`.
- Buckets privados de pruebas: `gymlog-anatomia` y `gymlog-usuarios`, con políticas de acceso por usuario. No se han cargado modelos 3D ni fotografías compartidas.

## Pendiente o no verificado

- **No se han instalado paquetes ni ejecutado build web/Android ni generado Gradle ni APK.**
- Integración de Supabase Data API: el esquema personalizado `sch_android_gymlytics` debe constar entre los expuestos para PostgREST. No está verificado con una sesión real de la aplicación.
- Debe configurarse la clave publicable de Supabase por entorno y autorizar los dominios de GitHub Pages, Hostinger y el retorno Android en Auth Redirect URLs.
- El visor 3D interactivo existe en el repositorio web independiente `site/`, pero aún no se ha portado a Gymlytics. Gymlytics lee las zonas y deja la vista 3D preparada/vacía. Fotos 2D pueden permanecer vacías.
- Se requiere probar sincronización real entre clientes, RLS, subida de fotos y funcionalidad en Android.
- La copia de desarrollo en GitHub se encuentra en una rama separada; antes de publicar deberán incorporarse allí **todos** los archivos de esta carpeta `web/`.

## Configuración de Pruebas

1. Copia `.env.example` a `.env` e introduce la clave **publicable** del proyecto `ProyectosPrueba`; nunca la clave service_role.
2. Comprueba API Data API schemas y RLS en Supabase.
3. `npm install` (pendiente de autorización para instalar); después `npm run dev` para probar en navegador.
4. En una fase posterior, `npm run build:web` genera `dist/` para GitHub Pages, Hostinger y Capacitor.
5. Después de validar la web, `npm run android:init` y `npm run android:sync` generan la estructura Android, **sin compilar el APK hasta autorización**.

## Dos entornos, una base por entorno

Web GitHub, web Hostinger y Android se conectarán al **mismo proyecto Supabase de Pruebas** mientras se desarrolla. Los tres compartirán el mismo proyecto de Producción cuando se publique. Nunca incluir credenciales privadas en el repositorio ni en la APK.


**Nota de migración del nombre (10/10/2026):** Los depósitos privados de fotografías conservaron los identificadores `gymlog-usuarios` y `gymlog-anatomia`; las políticas de Storage no se pueden renombrar con el rol actual. Gymlytics los sigue utilizando. El nombre del esquema SQL sí cambió a `sch_android_gymlytics`, al igual que el registro de la app. 
