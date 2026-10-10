# GymLog — organización Web y Android

**Fecha:** 2026-10-10. Rama aislada `feature/organizacion-web-android`.

## Carpetas independientes

- `Web-Hostinger/`: copia de la web `main/site/` con el visor 3D. La conexión con Supabase, los modelos 3D publicados y el despliegue en Hostinger quedan pendientes.
- `Android-GymLog/`: copia de `gymlog/` de la rama `feature/gymlog-01-04-registro-tabs-safearea` (Revisión 07, commit `0da25c911df722d65b95300ae4a9e0463389204e`). Incluye código web para Capacitor, configuración Android y pruebas.

**Carpetas** son proyectos; **ramas** son versiones del repositorio completo.

## Validación de la organización

Un workflow independiente `.github/workflows/proyectos-carpetas-checks.yml` corre pruebas de archivos e imports en Web-Hostinger y las pruebas Node existentes de Android-GymLog, **sin compilar APK ni publicar web**. Las pruebas estáticas no sustituyen pruebas reales en navegador/celular ni verifican las conexiones con Supabase.

## Protección de lo anterior

- Siguen intactas las rutas originales `site/` y las ramas previas.
- `main` no se modifica en esta fase. El workflow antiguo de GitHub Pages continúa usando `main/site/`.
- No se toca Supabase, Producción, contraseñas ni los entrenamientos.
- Para publicar desde `Web-Hostinger/`, primero asegurar modelos .glb, dependencias de generación y reconfigurar el despliegue. Para compilar Android desde `Android-GymLog/`, adaptar el workflow y obtener autorización de compilación.

Las 27 pruebas de la revisión 07 son del código de origen; comprobar el nuevo workflow antes de afirmar que la estructura nueva quedó validada.
