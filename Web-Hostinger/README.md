# Web-Hostinger — proyecto web separado

Fuente: copia exacta de `site/` de la rama `main`, conservada bajo esta nueva carpeta.

- `index.html`, `main.js`, `styles.css`, `app/`, `domain/`, `ui/` y `viewer/` constituyen la web con visor muscular.
- `tests/estructura.test.mjs` valida la entrada web y la resolución de imports locales.
- Ejecutar sin dependencias externas: `node --test tests/*.test.mjs` desde esta carpeta.
- Esta organización **no añade** conexión a Supabase ni despliegue de Hostinger. Eso es una fase posterior.
- **Importante:** los archivos `models/human-muscle-male-v05.glb` y `models/human-muscle-female-v05.glb` son referenciados, pero no están incluidos. Hay que generar/proveer los modelos y probar el navegador antes de publicar.
- El workflow antiguo `.github/workflows/pages.yml` sigue desplegando `site/` de `main`; no se ha modificado.
