# Task 13.2B-v5.0 — Perfil proporcional masculino consolidado

Fuente visual principal: lámina masculina aprobada `115977.png`.

Este documento consolida los bloques frontal y lateral en una sola especificación de control para la futura base Quad masculina. La altura total se normaliza como `H = 1.000`.

## 1. Niveles verticales congelados
- Mentón: `0.14 H`
- Línea de hombros: `0.18 H`
- Pecho: `0.29 H`
- Cintura: `0.42 H`
- Pelvis/cadera: `0.49 H`
- Entrepierna: `0.58 H`
- Centro de rodilla: `0.74 H`
- Tobillo: `0.94 H`
- Planta: `1.00 H`

## 2. Secciones de control frontal + lateral
| Zona | Ancho frontal | Profundidad lateral | Tolerancia inicial |
|---|---:|---:|---:|
| Cabeza | `0.12 H` | `0.11 H` | `±0.01 H` |
| Hombros / tórax superior | `0.30 H` | `0.15 H` | `±0.01 H` |
| Pecho | `0.27 H` | `0.16 H` | `±0.01 H` |
| Cintura | `0.19 H` | `0.10 H` | `±0.01 H` |
| Pelvis / cadera-glúteo | `0.22 H` | `0.14 H` | `±0.01 H` |
| Muslo proximal | control visual | `0.12 H` | `±0.015 H` |
| Rodilla | control visual | `0.09 H` | `±0.01 H` |
| Pantorrilla máxima | control visual | `0.10 H` | `±0.01 H` |
| Tobillo | control visual | `0.07 H` | `±0.01 H` |

Las zonas sin ancho frontal numérico cerrado deben respetar la silueta aprobada y se ajustarán directamente durante el cage, evitando introducir medidas artificiales no sustentadas por la referencia.

## 3. Relaciones anatómicas obligatorias
- Silueta atlética en V, con hombros claramente más anchos que pelvis.
- Caja torácica amplia con transición continua hacia cintura, sin estrechamiento extremo.
- Pecho proyectado e integrado al tórax, sin volumen esférico.
- Abdomen relativamente plano con ligera proyección natural.
- Pelvis y glúteo integrados al tronco y muslo; proyección menor que en el femenino.
- Hombro-brazo continuo; deltoide y brazo deben surgir del volumen corporal, no de cilindros añadidos.
- Muslo con masa anterior y posterior, rodilla perceptiblemente más estrecha y pantorrilla con máximo volumen en tercio superior/medio.
- Curva lumbar natural, sin hiperlordosis.
- Cabeza, manos y pies con escala anatómica coherente con el conjunto.

## 4. Restricciones de construcción Quad
- Simetría bilateral inicial.
- Una sola geometría corporal continua.
- Frontal y lateral deben respetarse simultáneamente.
- Subdivisión controlada después de cerrar la silueta base.
- No usar metaballs, campos implícitos, marching cubes ni piezas musculares superpuestas.
- No iniciar segmentación muscular funcional todavía.
- Short como geometría independiente.

## 5. Gate para pasar a malla
El perfil masculino queda suficientemente definido para iniciar el volumen base cuando el cage reproduzca simultáneamente las vistas frontal y lateral dentro de las tolerancias anteriores y conserve la lectura anatómica descrita.

## Estado
Perfil masculino frontal + lateral consolidado. Con los perfiles masculino y femenino consolidados, Task 1 — Referencias y proporciones queda técnicamente preparada para cierre y el siguiente paso será Task 2 — construcción de la base Quad/volumen inicial.
