# AplicativoGym — Addendum: concordancia de ejercicios del Excel

Fecha: 2026-09-29
Estado: Aprobado en conversación
Documento base: `2026-09-29-catalog-anatomy-sync-design.md`

## Objetivo

Precisar cómo se relacionarán los registros personales del Excel con el catálogo universal normalizado de AplicativoGym.

## 1. Dos columnas con semántica distinta

El importador tratará por separado:

- `Instrumento`: máquina, equipo o implemento utilizado.
- `Ejercicio`: movimiento realizado.

Ejemplos:

- `Máquina de polea alta` + `Jalón al pecho`
- `Mancuerna` + `Curl martillo`
- `Máquina Hack` + `Sentadilla Hack`
- `Máquina dual Peck Deck / Reverse Fly` + `Aperturas de pecho`
- `Máquina dual Peck Deck / Reverse Fly` + `Apertura inversa`

La misma máquina puede corresponder a varios ejercicios; por tanto, `Instrumento` nunca se usará por sí solo como identidad del ejercicio.

## 2. Concordancia con el catálogo universal

La identificación se realizará usando conjuntamente, cuando estén disponibles:

1. nombre del ejercicio;
2. instrumento/equipamiento;
3. gimnasio y sede;
4. alias personales;
5. músculos y patrón de movimiento;
6. imágenes de referencia del catálogo externo/canónico.

El objetivo es vincular el registro personal con un `exercise_id` canónico sin modificar ni perder el nombre histórico del usuario.

## 3. Asistente de concordancia

Durante la importación, el usuario podrá revisar cada ejercicio propio mediante una acción equivalente a:

`Este ejercicio mío corresponde a…`

Para cada candidato se mostrarán, cuando existan:

- nombre canónico en español;
- nombre original/inglés;
- imagen o imágenes de ejecución;
- equipamiento;
- músculos principales;
- variante relevante.

El usuario podrá:

- confirmar una coincidencia;
- escoger otro candidato;
- dejar el registro sin mapear;
- crear un ejercicio personalizado.

## 4. Reglas de mapeo persistentes

Una confirmación podrá convertirse en regla reutilizable, incluyendo contexto de gimnasio/sede/instrumento cuando sea necesario.

Ejemplo:

`Smart Fit Brasil + Máquina dual Peck Deck / Reverse Fly + Apertura inversa`

→ `reverse_machine_fly`

La regla se aplicará a futuras importaciones compatibles.

## 5. Casos ambiguos

Etiquetas genéricas o internas como `Pectoral 1`, `Espalda 2` o `Pierna 4` no se mapearán automáticamente solo por nombre.

El sistema deberá usar el resto de campos disponibles y, si aún existe ambigüedad, solicitar selección del usuario.

## 6. Conservación del historial

El mapeo no reemplaza el texto original del Excel. Se conservarán:

- nombre original del ejercicio;
- instrumento original;
- gimnasio/sede;
- series, peso, repeticiones y demás datos históricos;
- referencia al ejercicio canónico elegido.

Esto permite cambiar o corregir una concordancia posteriormente sin perder el historial original.

## 7. Criterio de aceptación

La importación se considera correcta cuando el usuario puede reconocer visualmente y seleccionar a qué ejercicio canónico pertenece cada ejercicio propio, usando en conjunto `Instrumento` + `Ejercicio`, sin que el sistema fuerce equivalencias dudosas.
