# AplicativoGymWebGit

Aplicación web de gimnasio con visor muscular 3D, buscador, filtros de ejercicios y selección de representación corporal Hombre/Mujer.

## Estado

Versión web **v0.5** de AplicativoGym. Mantiene el mockup e interacciones de v0.4 y añade una base anatómica extensible sin rediseñar la experiencia principal.

Incluye:

- dos representaciones 3D MakeHuman hm08, **Hombre** y **Mujer**, generadas a partir de activos oficiales CC0;
- selector Hombre/Mujer integrado como control flotante del visor;
- conservación de ejercicio seleccionado, orientación y zoom al cambiar de representación corporal;
- 18 zonas musculares renderizables con el mismo contrato lógico en ambos modelos;
- taxonomía anatómica jerárquica con subdivisiones iniciales y fallback a la zona padre cuando todavía no existe una malla 3D específica;
- 18 ejercicios con músculo principal y secundarios;
- giro automático inteligente y rotación/zoom manual;
- buscador y filtros por grupo muscular;
- diseño responsive para escritorio y móvil;
- alias de ejercicios recuperados del historial de gimnasio.

## Publicación

GitHub Pages se despliega mediante `.github/workflows/pages.yml`. En cada despliegue, CI:

1. ejecuta los tests web con **Node 24**;
2. ejecuta los tests del generador de modelos con Python;
3. descarga desde MakeHuman la malla base y seis targets macro oficiales CC0;
4. genera `human-muscle-male-v05.glb` y `human-muscle-female-v05.glb`;
5. verifica que ambos modelos mantengan exactamente el mismo contrato de 18 zonas y que sus geometrías corporales sean distintas;
6. publica únicamente la carpeta `site/`.

Los GLB de v0.5 se reconstruyen en GitHub Actions y no necesitan almacenarse como binarios fuente en Git.

## Continuidad del mockup

v0.5 evoluciona sobre la interfaz publicada en v0.4. El buscador, filtros, lista de ejercicios, tarjeta de detalle, giro automático, giro manual y zoom continúan siendo la base de la experiencia. El selector corporal se añadió sin reemplazar esos componentes.

## Modelo y alcance anatómico

Las zonas mostradas son **regiones musculares superficiales aproximadas para visualización de entrenamiento**. No constituyen un atlas anatómico médico ni representan volúmenes musculares internos individuales. Las subdivisiones lógicas pueden usar temporalmente la región padre renderizable hasta disponer de una delimitación 3D propia.

La procedencia, transformación y licencia de los modelos se documentan en `site/models/model-source.md`.
