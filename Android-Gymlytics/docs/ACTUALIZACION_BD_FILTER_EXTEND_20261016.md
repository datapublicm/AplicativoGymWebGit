# Actualización BD_Filter_Extend — Gymlytics Pruebas

**Fecha:** 2026-10-16  
**Fuente:** `Chat_Salud_Deporte v2.6.3.2(3).xlsx` → hoja `BD_Filter_Extend`  
**SHA-256 fuente:** `c74b3d157842b5165366dfbe66d22d8ccfe4638512df773b6d8929f04006d4d8`  
**Ambiente Supabase:** `ProyectosPrueba`, esquema `sch_android_gymlytics`  
**Rama del aplicativo:** `cambios/gymlytics-01.08-preparacion`  
**APK:** no recompilado; `01.07 Pruebas` en Google Drive sigue vigente.

## Resultado de la importación

- Actualizado `stg_gymlytics_excel_20261016` con **9.432 filas** (`fila_excel` 2 a 9433), importación idempotente por `fila_excel`. Copia anterior: **9.401 filas**.
- Se añadieron `fuente_excel_sha256` y `fuente_hoja` para identificar la procedencia. Todas las 9.432 filas corresponden al SHA citado.
- `Anotación` (columna P actual) se proyecta a `anotacion` y `zona_entrenamiento` para preservar los selectores vigentes de Gymlytics. `Anotación (Q sera borrada)` (O) permanece como `anotacion_antigua`.
- Se actualizaron gimnasio, sede, agrupación, instrumento, ejercicio, agarre/implemento, técnicas, número de serie, subdivisión, peso, repeticiones y asistencias. No se alteraron tablas ni registros personales.
- En la hoja existen **252 combinaciones distintas**, de las cuales **251 son ejercicios válidos**; una usa ejercicio `-` y anotación `- No considerar -`, por lo que **no** se habilita como opción seleccionable.

## Catálogo predeterminado

- `tbl_catalogo_predeterminado`: **250 IDs previos** actualizados en su anotación/zona sin sustituir el ID, **1 referencia nueva** (press inclinado, técnica `06 - Controlado (Nivel A, 8-10 seg)`); **1 referencia antigua** desactivada lógicamente.
- Total vigente de `GymLytics_20261016`: **251 activos**. Los **242 registros anteriores** de `Chat_Salud_Deporte_v2_5` ya estaban inactivos y permanecieron inactivos.
- No se borraron físicamente registros; se mantienen identificadores existentes, respaldos y referencias históricas.

## Músculos: sin cambios

- No se importó ningún valor muscular del Excel, ni se actualizaron `musculos_principales` o `musculos_secundarios` de las filas existentes en el staging o catálogo. Comprobación comparativa contra ambos respaldos: **0 diferencias**.
- No se modificaron `tbl_musculos`, `tbl_ejercicio_musculos`, `tbl_musculo_imagenes`, `tbl_musculo_zonas3d`, fotografías ni vista 3D.

## Respaldos en Supabase

- `sch_android_gymlytics.bak_stg_bd_filter_extend_pre_20261016`.
- `sch_android_gymlytics.bak_catalogo_predeterminado_pre_bdfilter_20261016`.
- Fuente de las 252 combinaciones: `sch_android_gymlytics.stg_bd_filter_extend_catalogo_20261016`.

## Cambio en Gymlytics Pruebas

- `web/offline-catalog-download.js`: descarga de referencias actualizadas de Supabase, elimina de la lista de selección las referencias retiradas **solo si no hay una sustitución local**, protege las sustituciones editadas en el perfil, acepta variantes que difieren únicamente en técnica, mantiene los IDs existentes y no reemplaza músculos de las entradas locales al actualizar la zona.
- `tests/bd-filter-extend-update.test.mjs`: 8 pruebas adicionales de los escenarios anteriores.
- GitHub Actions: **296 pruebas aprobadas, 0 fallos**. Ejecución: https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38970562237
- La APK `Gymlytics 01.07 Pruebas` **no ha sido recompilada** con estos ajustes. El código queda en la rama 01.08 para el siguiente APK de pruebas cuando se autorice.

## Verificaciones pendientes

- Probar una descarga manual de catálogo con una cuenta autenticada real en Android; no se provocaron cambios artificiales en datos personales.
- Validar visualmente en teléfono la nueva variante y la eliminación de la opción antigua.


## Revisión posterior: 27 columnas reales y etiquetas de Gymlytics
La hoja BD_Filter_Extend tiene **27 columnas (A:AA)** y **9.432 registros**. Se completó la copia en `stg_gymlytics_excel_20261016`: 27 campos fuente, más la proyección adicional `zona_entrenamiento` que procede de Anotación (P).

| Columna | Encabezado exacto Excel | Campo de Supabase | Gymlytics |
|---|---|---|---|
| A | Categoria | categoria | Metadato |
| B | Subcategoria | subcategoria | Metadato |
| C | NroGeneral | nro_general | Metadato |
| D | Nro | nro_registro | Metadato |
| E | Id | id_origen | Identificador de fuente |
| F | Dia semana | dia_semana | Metadato |
| G | Fecha y hora | fecha_hora_excel | Metadato |
| H | Dia | dia | Metadato |
| I | Hora | hora | Metadato |
| J | Emisor | emisor | Metadato |
| K | Mensaje | mensaje | Metadato |
| L | Gimnasio | gimnasio | Selector |
| M | Sede | sede | Selector |
| N | Agrupación | agrupacion | Conservado; sin selector nuevo |
| O | Anotación (Q sera borrada) | anotacion_antigua | Histórico |
| P | Anotación | anotacion y zona_entrenamiento | Selector Anotación |
| Q | Instrumento | instrumento | Selector |
| R | Ejercicio | ejercicio | Selector |
| S | Agarre / Implemento | accesorio_implemento | Selector |
| T | Tecnica | tecnica_original | Histórico |
| U | Tecnica_Actualizada | tecnica_actualizada | Selector Técnica actualizada |
| V | Numero Serie | numero_serie | Número de serie |
| W | Subdivision | subdivision | Subdivisiones |
| X | Peso | peso | Peso |
| Y | Repeticiones | repeticiones | Repeticiones |
| Z | Asistencia / Pausa | asistencias | Campo de apoyo |
| AA | Otros Detalles | otros_detalles | Metadato |

**Verificación SQL:** 9.432 filas e identificadores de origen, 12/12 metadatos adicionales presentes, cero cambios en campos musculares existentes.
**Correcciones en la rama 01.08:** se retiraron cuatro etiquetas antiguas «AnotaciónV2»; ahora se muestra «Anotación» para P y «Técnica actualizada» para U. No se modificó el orden de los controles, los músculos ni la APK 01.07 vigente.
Las 27 columnas son las de la fuente Excel, no 27 campos obligatorios en el formulario Android. Los metadatos quedan preservados en Supabase.