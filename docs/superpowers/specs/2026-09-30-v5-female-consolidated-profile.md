# Task 13.2B-v5.0 — Perfil proporcional femenino consolidado

Fuente visual principal: lámina femenina aprobada `115978.png`.

Este documento consolida los bloques frontal y lateral en una sola especificación de control para la futura base Quad femenina. La altura total se normaliza como `H = 1.000`.

## 1. Niveles verticales congelados
- Mentón: `0.15 H`
- Línea de hombros: `0.19 H`
- Pecho: `0.30 H`
- Cintura: `0.42 H`
- Pelvis/cadera: `0.49 H`
- Entrepierna: `0.58 H`
- Centro de rodilla: `0.73 H`
- Tobillo: `0.94 H`
- Planta: `1.00 H`

## 2. Secciones de control frontal + lateral
| Zona | Ancho frontal | Profundidad lateral | Tolerancia inicial |
|---|---:|---:|---:|
| Cabeza | `0.12 H` | `0.11 H` | `±0.01 H` |
| Hombros / tórax superior | `0.27 H` | `0.13 H` | `±0.01 H` |
| Pecho | `0.25 H` | `0.15 H` | `±0.01 H` |
| Cintura | `0.17 H` | `0.09 H` | `±0.01 H` |
| Pelvis / cadera-glúteo | `0.23 H` | `0.15 H` | `±0.01 H` |
| Muslo proximal | control visual | `0.12 H` | `±0.015 H` |
| Rodilla | control visual | `0.09 H` | `±0.01 H` |
| Pantorrilla máxima | control visual | `0.09 H` | `±0.01 H` |
| Tobillo | control visual | `0.07 H` | `±0.01 H` |

Las zonas sin ancho frontal numérico cerrado todavía deben respetar estrictamente la silueta frontal de la lámina y se medirán directamente durante el ajuste del cage para evitar introducir un número artificial no sustentado por la referencia.

## 3. Relaciones anatómicas obligatorias
- Hombros atléticos, sin ensancharlos hasta una silueta masculina.
- Cintura marcada, sin reloj de arena extremo.
- Pelvis más ancha que cintura y ligeramente más estrecha que hombros.
- Pecho con proyección natural y continuidad con caja torácica.
- Abdomen relativamente plano y transición suave hacia pelvis.
- Glúteo proyectado e integrado, sin quiebre entre pelvis y muslo.
- Muslo con volumen anterior y posterior, evitando geometría cilíndrica.
- Rodilla perceptiblemente más estrecha que muslo y pantorrilla.
- Pantorrilla con volumen máximo en tercio superior/medio y reducción progresiva al tobillo.
- Lordosis presente pero contenida.
- Brazos y piernas deben leerse como anatomía continua, no como tubos unidos al torso.

## 4. Restricciones de construcción Quad
- Simetría bilateral inicial.
- Una sola geometría corporal continua.
- Ajuste frontal y lateral simultáneo; ninguna corrección de una vista puede romper la otra.
- Subdivisión controlada solo después de cerrar la silueta base.
- No usar metaballs, campos implícitos, marching cubes ni piezas musculares superpuestas.
- No iniciar segmentación muscular funcional en esta fase.
- Ropa deportiva como geometría independiente.

## 5. Gate para pasar a malla
El perfil femenino queda suficientemente definido para iniciar el volumen base solo cuando la silueta del cage pueda reproducir simultáneamente las vistas frontal y lateral dentro de las tolerancias anteriores y mantenga la lectura anatómica descrita.

## Estado
Perfil femenino frontal + lateral consolidado. Siguiente bloque: perfil masculino frontal y lateral equivalente antes de la construcción definitiva de las bases.
