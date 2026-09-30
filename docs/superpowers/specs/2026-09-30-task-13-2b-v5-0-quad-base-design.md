# Task 13.2B-v5.0 — Base anatómica masculina Quad

## Objetivo
Construir una nueva base anatómica masculina adulta para AplicativoGym, visualmente convincente, suave y apta para web, sin reutilizar la geometría visible de MakeHuman ni el pipeline fallido de metaballs/campos implícitos/marching cubes.

La v5.0 termina con un GLB masculino aprobado visualmente. La segmentación muscular funcional queda fuera de esta versión.

## Referencia visual congelada
- Referencia masculina aprobada del chat: `presentación_de_modelo_fitness_masculino.png`.
- Alias histórico asociado en el trabajo previo: `a_clean_high_resolution_concept_technical_design.png`.
- Vistas requeridas para ajuste: frontal y lateral.
- El lateral aprobado muestra al modelo mirando a la izquierda.
- La referencia femenina aprobada se reserva para v5.1: `modelo_atlética_en_cuatro_vistas.png`.

No constan proporciones numéricas aprobadas previas. Por tanto, Task 1 debe extraerlas de la referencia visual y registrarlas antes de construir la malla.

## Criterios visuales obligatorios
- Torso atlético natural; forma en V sin cintura extrema.
- Pecho con volumen creíble.
- Hombros y brazos no cilíndricos.
- Transición hombro-brazo continua.
- Cintura y pelvis conectadas de forma anatómica.
- Glúteos y piernas con masa acorde al torso.
- Rodillas, tobillos, manos y pies definidos.
- Espalda con lectura de dorsales y trapecio.
- Acabado suave/premium, sin apariencia low-poly o facetada.
- Short deportivo corto como malla independiente.

## Arquitectura v5.0
La nueva base se construirá como malla continua de topología Quad, simétrica, con subdivisión controlada y ajuste por silueta frontal/lateral. La anatomía se expresará primero mediante volumen de la superficie corporal. No habrá overlays ni piezas musculares separadas en v5.0.

Quedan descartados para esta versión:
- metaballs;
- campos implícitos;
- `marching_cubes`;
- deformación visible final de MakeHuman;
- segmentación muscular funcional;
- rig definitivo;
- sustitución del modelo productivo antes del gate visual.

## Estructura de Drive
`01_Modelos_3D/Task_13.2B-v5.0/`
- `01_Referencias/`
- `02_Source/`
- `03_Renders/`
- `04_Export/`
- `05_Docs/`
- `06_Tests/`

## Flujo por tareas

### Task 1 — Referencias y proporciones
1. Congelar referencias aprobadas.
2. Incorporar las imágenes aprobadas a `01_Referencias/` cuando estén disponibles como archivo.
3. Medir en coordenadas normalizadas: altura, hombros, pecho, cintura, pelvis, longitud y grosor de brazo/antebrazo, muslo, pantorrilla, cabeza y longitudes de miembros.
4. Registrar proporciones frontal/lateral y tolerancias.
5. Gate: no iniciar malla hasta que el perfil de proporciones esté documentado.

### Task 2 — Malla base Quad
Crear una malla masculina continua, simétrica, en postura neutra, con flujo de loops adecuado para torso, hombros, cadera, rodillas y codos.

### Task 3 — Ajuste de silueta
Ajustar simultáneamente frontal y lateral contra las proporciones registradas en Task 1.

### Task 4 — Volumen anatómico
Esculpir pectoral, deltoides, espalda, brazos, abdomen, glúteos, muslos y pantorrillas como volumen continuo, sin segmentación.

### Task 5 — Suavizado y calidad
Aplicar subdivisión/smoothing controlados; corregir zonas tubulares, articulaciones, manos/pies y transiciones; mantener presupuesto razonable para web.

### Task 6 — Short y exportación
Crear short independiente, material neutro del cuerpo y exportar candidato `human-male-base-v5.glb`.

### Task 7 — Validación visual
Render frontal, lateral, 3/4 y posterior desde el GLB real. Comparar con el mockup aprobado. No aprobar automáticamente por pasar tests geométricos.

### Task 8 — Cierre v5.0
Guardar fuente, GLB, renders y pruebas. Solo después de aprobación visual se considera base oficial y se prepara v5.1 femenina.

## Contrato preliminar del GLB
- Formato: GLB 2.0.
- Cuerpo: una geometría corporal continua.
- Short: geometría independiente.
- Sin nodos `muscle__*` en v5.0.
- Escala/orientación compatibles con el visor actual.
- Nombres definitivos de nodos se fijarán antes de Task 6 y se cubrirán con test de contrato.

## Criterio de aprobación v5.0
La base no se considera aprobada si, aun pasando pruebas técnicas, se ve artificial, facetada, tubular o insuficientemente parecida a la referencia aprobada. La aprobación es visual además de técnica.

## Estado actual
- Pipeline antiguo de MakeHuman/modelo generado retirado de `main`.
- Carpeta Drive v5.0 aislada y limpia creada.
- Rama de trabajo: `task-13.2b-v5.0-quad-base`.
- Task 1 iniciada.
- Pendiente dentro de Task 1: colocar las referencias visuales aprobadas como archivos en `01_Referencias/` y extraer proporciones numéricas desde ellas.