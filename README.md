# Web-Hostinger — rama independiente

Rama `Web-Hostinger`: solo contiene el proyecto `Web-Hostinger/`, este README y el workflow de pruebas de la web.

- Carpeta de desarrollo: `Web-Hostinger/`. Mantiene el visor muscular 3D y las pruebas de estructura.
- Pruebas: `node --test Web-Hostinger/tests/*.test.mjs`.
- Los modelos 3D finales siguen **pendientes**, por decisión del usuario. No generarlos ni integrarlos todavía.
- El despliegue en Hostinger y la conexión real con Supabase **no están implementados ni validados**.
- La publicación actual de GitHub Pages se mantiene en la rama `main`, sin modificaciones.
- No fusionar en `main` ni activar publicación automática sin validaciones posteriores.

La rama de respaldo `feature/organizacion-web-android` conserva las dos carpetas juntas; aquí se separó el árbol de trabajo sin reescribir el historial Git.
