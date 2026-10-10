# GymLog — proyectos separados por carpetas

**Organización propuesta (10 de octubre de 2026)**

- `Web-Hostinger/`: copia de `site/` de la rama `main`. Es la base de la web principal y el visor muscular 3D. Su despliegue en Hostinger y su conexión con Supabase siguen pendientes de configuración y verificación.
- `Android-GymLog/`: copia íntegra de `gymlog/` desde la rama `feature/gymlog-01-04-registro-tabs-safearea`, revisión 07 (commit `0da25c911df722d65b95300ae4a9e0463389204e`). Contiene `web/`, `android/`, `tests/` y la configuración de Capacitor.

**Carpetas ≠ ramas:** estas carpetas distinguen proyectos; la rama `feature/organizacion-web-android` sirve para trabajar y revisar los cambios sin afectar `main`.

**Precauciones:**
- Esta reorganización crea copias, **no elimina las rutas originales** (`site/`, `gymlog/`) ni las ramas anteriores.
- Los flujos de publicación y CI existentes todavía tienen rutas antiguas y **no se han adaptado** a las nuevas carpetas.
- No significa que Hostinger esté desplegado, que la recuperación HTTPS funcione, ni que se haya compilado una APK.
- Las **27 pruebas aprobadas** pertenecen a la revisión 07 anterior; aún hay que validar los proyectos bajo sus nuevas rutas.
- No se modificó Supabase Producción, ni contraseñas ni datos de usuarios.

**Siguiente fase:** actualizar de forma controlada las rutas de build, CI y despliegue, comprobar ambas aplicaciones y únicamente después plantear integrar cambios en `main`.
