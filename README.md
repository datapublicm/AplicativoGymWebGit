# AplicativoGymWebGit

Aplicación web de gimnasio con visor muscular 3D, buscador, filtros de ejercicios, selección de representación corporal y resaltado de músculos por ejercicio.

## Estado actual

El proyecto conserva la interfaz y la lógica funcional del prototipo web: catálogo de ejercicios, resolución anatómica, giro automático, rotación/zoom manual y selección Hombre/Mujer.

La reconstrucción del modelo humano se trabaja por separado en **Task 13.2B-v5.0**. El pipeline anterior basado en MakeHuman y los intentos de geometría por metaballs/campos implícitos fueron retirados del proyecto activo.

La dirección vigente para v5.0 es una **base anatómica propia de topología Quad**, ajustada contra referencias frontal/lateral y sometida a aprobación visual antes de sustituir el modelo productivo. La segmentación muscular definitiva se incorpora después de aprobar la forma base.

## Principios de continuidad

- No rehacer la interfaz web desde cero.
- Conservar buscador, filtros, detalle de ejercicio, giro automático, giro manual y zoom.
- Mantener desacoplada la lógica de ejercicios/músculos de la geometría 3D concreta.
- No integrar un nuevo GLB como modelo productivo hasta superar el gate visual.
- Mantener la futura compatibilidad con modelo masculino y femenino y con la posterior versión Android.

## Task 13.2B-v5.0

La especificación de trabajo vigente está en:

`docs/superpowers/specs/2026-09-30-task-13-2b-v5-0-quad-base-design.md`

Los activos de trabajo de esta fase se organizan fuera del repositorio en la carpeta de proyecto correspondiente, separando referencias, fuentes, renders, exportaciones, documentación y pruebas.

## Pruebas web

Las pruebas JavaScript se ejecutan con Node.js mediante:

```bash
npm test
```

El repositorio ya no instala NumPy/trimesh ni genera modelos 3D con Python durante el despliegue web.

## Publicación

GitHub Pages publica únicamente la carpeta `site/`. El workflow ejecuta primero las pruebas web y verifica que los archivos base del sitio existan antes de subir el artefacto.

## Alcance anatómico

Las zonas musculares de la aplicación son regiones orientadas a visualización de entrenamiento. No constituyen un atlas anatómico médico. La geometría y delimitación muscular definitiva dependen de la aprobación del nuevo modelo base.
