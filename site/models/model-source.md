# Fuente y licencia de los modelos 3D

## Modelos v0.5: Hombre y Mujer

AplicativoGym v0.5 genera dos variantes visuales sobre la misma topología hm08 de MakeHuman:

- `human-muscle-male-v05.glb`
- `human-muscle-female-v05.glb`

Ambas conservan exactamente el mismo contrato lógico de 18 nodos `muscle__<muscle_id>`. Los ejercicios y las zonas anatómicas no se duplican por sexo visual; únicamente cambia la geometría corporal asociada.

## Fuentes oficiales CC0

La superficie base procede de:

`makehuman/data/3dobjs/base.obj`

El propio archivo oficial declara que el activo fue liberado explícitamente bajo **CC0** en septiembre de 2020.

Para obtener una silueta masculina y femenina sin asociarla a una única base étnica, el generador promedia de forma equiponderada tres targets macro oficiales por variante:

**Hombre**

- `african-male-young.target`
- `asian-male-young.target`
- `caucasian-male-young.target`

**Mujer**

- `african-female-young.target`
- `asian-female-young.target`
- `caucasian-female-young.target`

Todos se descargan desde `makehuman/data/targets/macrodetails/`. Los archivos oficiales de targets también declaran explícitamente CC0 en su encabezado. El promedio se usa únicamente como una base visual neutral del producto y no pretende representar estadísticamente a ninguna población.

## Transformaciones realizadas

`tools/generate_model.py`:

- conserva la topología corporal `body` del basemesh hm08;
- triangula las caras para exportación glTF/GLB;
- calcula una sola vez, sobre la malla base, las máscaras de las 18 zonas musculares;
- aplica a cada variante el promedio `1/3 + 1/3 + 1/3` de sus tres targets oficiales;
- añade un ajuste fitness suave de silueta limitado al ancho corporal, sin cambiar longitud de miembros ni pose neutra;
- usa para Hombre: torso superior `+3%` y cintura `-2%`;
- usa para Mujer: cintura `-5%`, cadera/glúteo `+5%` y muslo superior `+2%`;
- recalcula las normales sobre cada variante antes de desplazar los overlays musculares;
- exporta el cuerpo como `body__male` o `body__female`;
- exporta las zonas con el contrato estable `muscle__<muscle_id>`.

Durante la transición entre v0.4 y el selector Hombre/Mujer, el workflow también crea `human-muscle-v2.glb` como alias temporal del modelo masculino para que el mockup actual siga funcionando. Ese alias no define una tercera anatomía.

## Contrato y verificación

`tools/verify_model_contract.py` falla si:

- cualquiera de los dos GLB falta, está vacío o no puede cargarse;
- falta el nodo corporal esperado;
- falta alguna de las 18 zonas;
- aparecen zonas `muscle__*` adicionales no previstas;
- Hombre y Mujer no tienen exactamente el mismo contrato de zonas;
- la geometría corporal de ambos modelos resulta idéntica.

## Alcance anatómico

Las 18 regiones continúan siendo **zonas musculares superficiales aproximadas para visualización de entrenamiento**. No son un atlas médico ni representan volúmenes musculares internos individuales. La taxonomía jerárquica de v0.5 permite que futuras subdivisiones utilicen temporalmente su zona padre renderizable hasta disponer de una delimitación 3D propia.
