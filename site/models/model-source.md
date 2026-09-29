# Fuente y licencia del modelo 3D

## Modelo activo: `human-muscle-v2.glb`

La versión v2 usa como superficie humana base `makehuman/data/3dobjs/base.obj` del proyecto MakeHuman (basemesh hm08). El archivo fuente oficial declara en su encabezado que el activo fue liberado bajo **CC0** en septiembre de 2020.

En la publicación de GitHub Pages la malla base no se guarda en el repositorio. El workflow `.github/workflows/pages.yml` la descarga desde el repositorio oficial de MakeHuman y `tools/generate_model.py` realiza estas transformaciones:

- conserva únicamente el grupo de superficie `body` del OBJ;
- triangula las caras para exportación glTF/GLB;
- centra y escala la figura para la cámara del visor;
- genera 18 zonas musculares superficiales como subconjuntos de caras de la propia superficie;
- desplaza cada zona ligeramente a lo largo de la normal para evitar z-fighting;
- asigna el contrato estable `muscle__<muscle_id>`;
- amplía el deltoide lateral hacia la superficie anterolateral/posterolateral del hombro para evitar una zona excesivamente estrecha;
- exporta `site/models/human-muscle-v2.glb` durante el despliegue.

Las 18 zonas son: pectoral, deltoides anterior/lateral/posterior, bíceps, tríceps, antebrazo, abdominales, oblicuos, dorsal ancho, trapecio, erectores espinales, glúteos, cuádriceps, isquiotibiales, aductores, abductores y pantorrillas.

## Alcance anatómico

La v2 representa **zonas musculares de superficie para resaltado de entrenamiento**. No pretende ser un atlas médico ni reconstruye volúmenes musculares internos individuales. Las delimitaciones se calculan con regiones espaciales, orientación de la superficie y referencias articulares de la malla hm08. Para una futura versión anatómica de alta precisión, las mismas IDs permiten sustituir cada zona por mallas musculares refinadas sin cambiar la lógica de ejercicios.

## Modelo anterior

`human-muscle-v1.glb` era un modelo procedural de primitivas creado dentro del proyecto y dedicado a CC0. Se conserva únicamente como referencia/fallback de desarrollo; la web v0.4 usa la v2.
