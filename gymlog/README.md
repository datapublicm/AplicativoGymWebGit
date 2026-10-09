# GymLog — Inicio Android / APK

Rama: `feature/gymlog-apk-inicio`

Se comienza el proyecto multiplataforma de GymLog usando **una fuente web** para GitHub Pages, Hostinger y Android (Capacitor). Esta rama es de desarrollo: no cambia la web publicada en `main/site`.

**Entregable completo del prototipo móvil:** paquete `GymLog_APK_Inicio_Sin_Compilar.zip` generado en la conversación de trabajo. Su carpeta `web/` está pendiente de incorporarse a esta rama; aquí queda configurada la base Android para esa misma carpeta.

La interfaz incluye las 5 áreas Sesión, Catálogos, Registro, Tablas y Dashboard, así como el visor muscular Fotos/3D (3D inicialmente vacío). El acceso de GymLog se realiza con Supabase Auth del entorno elegido; las tablas se mantienen en el esquema `sch_android_gymlog`.

## Estado y siguientes acciones
- **Sí:** configuración `capacitor.config.json`, `package.json`, `vite.config.js`, plantilla `.env.example` y documentación Android.
- **Pendiente:** incorporar el código fuente `web/` del ZIP y verificar el bundle con dependencias instaladas.
- **Pendiente:** habilitar y probar exposición de esquema Supabase Data API sin afectar otros esquemas.
- **Pendiente:** configurar las URLs/clave publicable por entorno y probar Supabase Auth + permisos RLS.
- **Pendiente:** generar el proyecto nativo `android/`, importar visor 3D existente y compilar una APK cuando se autorice.

**No se han instalado paquetes ni compilado APK.** No publicar las claves privadas de Supabase ni archivos de firma Android.

## Flujo previsto (NO ejecutado)
```bash
npm install
npm run build:web
npm run android:init
npm run android:sync
npm run android:open
```

No duplicar datos por versión: GitHub Web, Hostinger Web y Android apuntan al mismo proyecto Supabase **dentro del entorno**; Pruebas y Producción son proyectos distintos.
