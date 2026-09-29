# AplicativoGymWebGit

Aplicación web de gimnasio con visor muscular 3D, buscador y filtros de ejercicios.

## Estado

Versión web **v0.4** de AplicativoGym. Incluye:

- cuerpo humano MakeHuman hm08 (CC0);
- 18 zonas musculares resaltables;
- 18 ejercicios con músculo principal y secundarios;
- giro automático inteligente y rotación/zoom manual;
- buscador y filtros por grupo muscular;
- diseño responsive para escritorio y móvil;
- alias de ejercicios recuperados del historial de gimnasio.

## Publicación

GitHub Pages se despliega mediante `.github/workflows/pages.yml`. Durante cada despliegue, el workflow descarga la malla base oficial CC0 de MakeHuman, genera `human-muscle-v2.glb` y publica únicamente la carpeta `site/`.

El GLB generado no necesita almacenarse en Git porque se reconstruye en GitHub Actions a partir de la fuente CC0 y de `tools/generate_model.py`.

## Modelo y alcance

Las 18 regiones son zonas musculares superficiales aproximadas sobre la malla humana; no constituyen un atlas anatómico médico. La procedencia y licencia se documentan en `site/models/model-source.md`.
