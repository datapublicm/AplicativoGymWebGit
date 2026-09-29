# AplicativoGym v0.5 Dual Anatomy Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolucionar el mockup web v0.4 a v0.5 con modelos Hombre/Mujer, siluetas mejoradas y una primera taxonomía anatómica jerárquica, sin perder el diseño ni las interacciones ya publicadas.

**Architecture:** El visor seguirá siendo WebGL estático y dependency-free en runtime. La anatomía lógica se desacoplará de las 18 mallas renderizables mediante un árbol de zonas con fallback al ancestro que tenga mesh; Hombre y Mujer compartirán las mismas IDs y diferirán únicamente en la geometría GLB. Los dos GLB se reconstruirán en CI desde MakeHuman CC0 y targets CC0, y el cambio de cuerpo reemplazará el modelo sin perder ejercicio seleccionado ni cámara.

**Tech Stack:** JavaScript ES modules, WebGL 1, Node.js 24 `node:test`, Python 3.12, NumPy 2.x, trimesh 4.x, GitHub Actions/Pages.

**Spec:** `docs/superpowers/specs/2026-09-29-catalog-anatomy-sync-design.md`

## Global Constraints

- El mockup/web v0.4 publicado es la base visual; no rehacer la interfaz desde cero.
- Conservar buscador, filtros, tarjeta de detalle, giro automático, giro manual, pinch/zoom y responsive móvil.
- Mantener las 18 IDs renderizables actuales y el contrato de mesh `muscle__<muscle_id>` durante v0.5.
- Hombre y Mujer comparten semántica anatómica y ejercicios; solo cambia geometría.
- Una subzona sin mesh propio usa el ancestro renderizable más cercano.
- Las zonas son aproximaciones superficiales para entrenamiento, no un atlas médico.
- Fuentes MakeHuman usadas para geometría deben conservar documentación de procedencia/licencia CC0.
- v0.5 no implementa todavía el catálogo completo de 300–400 ejercicios, Supabase, importación Excel completa ni APK; esos subsistemas tendrán planes separados.

## Review Focus

- Cambiar Hombre/Mujer con un ejercicio ya seleccionado debe conservar ese ejercicio y volver a aplicar los mismos músculos al nuevo modelo.
- Una subzona nueva sin mesh propio, por ejemplo `vastus_medialis`, debe resolver a `quadriceps` y no aparecer como zona perdida.
- Un ID anatómico realmente desconocido debe seguir apareciendo como no resuelto; nunca se debe mapear por adivinación.
- Los GLB masculino y femenino deben contener exactamente el mismo conjunto obligatorio de 18 meshes `muscle__*` aunque su silueta sea distinta.
- Si falla la carga del segundo modelo, el visor debe conservar el modelo anterior, cámara y selección funcional.

---

### Task 1: Introducir test harness y anatomía jerárquica compatible

**Files:**
- Create: `package.json`
- Create: `site/domain/anatomy.js`
- Modify: `site/domain/muscles.js`
- Create: `tests/anatomy.test.mjs`

**Interfaces:**
- Produces: `ANATOMY_ZONES`, `getAnatomyZone(id)`, `getMuscleLabel(id)`, `resolveRenderableMuscles(ids) -> { ids, unresolved }`.
- Preserves: `MUSCLE_IDS` como las 18 IDs que tienen mesh en v0.5 y `MUSCLE_LABELS` para compatibilidad con el mockup actual.

- [ ] **Step 1: Crear el test Node fallido para jerarquía/fallback**

En `tests/anatomy.test.mjs`, probar como mínimo:

```js
assert.deepEqual(resolveRenderableMuscles(['vastus_medialis']), { ids: ['quadriceps'], unresolved: [] });
assert.deepEqual(resolveRenderableMuscles(['deltoid_lateral']), { ids: ['deltoid_lateral'], unresolved: [] });
assert.deepEqual(resolveRenderableMuscles(['zona_inexistente']), { ids: [], unresolved: ['zona_inexistente'] });
assert.equal(getMuscleLabel('triceps_long_head'), 'Tríceps · cabeza larga');
assert.equal(MUSCLE_IDS.length, 18);
```

- [ ] **Step 2: Añadir `package.json` mínimo y verificar que el test falla**

Usar `"type": "module"` y script `"test": "node --test tests/*.test.mjs"` sin dependencias npm.

Run: `npm test`

Expected: FAIL porque `site/domain/anatomy.js` todavía no existe.

- [ ] **Step 3: Implementar `site/domain/anatomy.js`**

Definir nodos globales con `id`, `nameEs`, `parentId`, `zoneType`, `renderMeshId` y `active`. Incluir las 18 zonas actuales como nodos renderizables y, como demostración real de extensibilidad, estas subzonas iniciales sin mesh propio: `pectoralis_clavicular`, `pectoralis_sternal`, `triceps_long_head`, `triceps_lateral_head`, `triceps_medial_head`, `rectus_femoris`, `vastus_lateralis`, `vastus_medialis`, `vastus_intermedius`, `gastrocnemius` y `soleus`.

`resolveRenderableMuscles(ids)` debe subir por `parentId` hasta encontrar `renderMeshId`, deduplicar resultados y separar IDs desconocidas en `unresolved`.

- [ ] **Step 4: Convertir `site/domain/muscles.js` en capa de compatibilidad**

Derivar `MUSCLE_LABELS` de la anatomía y conservar exactamente las 18 `MUSCLE_IDS` renderizables actuales para `muscleRegistry.js` y el generador.

- [ ] **Step 5: Ejecutar tests**

Run: `npm test`

Expected: PASS para `tests/anatomy.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add package.json site/domain/anatomy.js site/domain/muscles.js tests/anatomy.test.mjs
git commit -m "feat: add extensible anatomy hierarchy"
```

---

### Task 2: Resolver ejercicios contra zonas anatómicas antes de resaltar

**Files:**
- Create: `site/viewer/exerciseMuscles.js`
- Modify: `site/viewer/ViewerController.js`
- Create: `tests/exerciseMuscles.test.mjs`

**Interfaces:**
- Consumes: `resolveRenderableMuscles(ids)` de Task 1.
- Produces: `resolveExerciseMuscleTargets(exercise) -> { primary, secondary, unresolved }`.

- [ ] **Step 1: Escribir tests fallidos**

Cubrir:

```js
// una subzona futura cae en la zona renderizable padre
primary: ['vastus_medialis'] -> primary: ['quadriceps']
// IDs repetidas por fallback quedan deduplicadas
['vastus_medialis', 'vastus_lateralis'] -> ['quadriceps']
// una zona desconocida queda en unresolved
```

- [ ] **Step 2: Ejecutar test y confirmar fallo**

Run: `npm test`

Expected: FAIL por módulo/función inexistente.

- [ ] **Step 3: Implementar `resolveExerciseMuscleTargets(exercise)`**

Resolver `exercise.primary` y `exercise.secondary` por separado y combinar `unresolved` sin duplicados. No cambiar todavía el esquema de los 18 ejercicios existentes.

- [ ] **Step 4: Integrar el resolver en `ViewerController.selectExercise(exercise)`**

Usar IDs renderizables para `applyMuscleHighlight`, para cálculo de `primaryMeshes` y para visibilidad/auto-rotación. `missing` debe combinar únicamente zonas anatómicas no resueltas y meshes renderizables realmente ausentes.

- [ ] **Step 5: Ejecutar todos los tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/viewer/exerciseMuscles.js site/viewer/ViewerController.js tests/exerciseMuscles.test.mjs
git commit -m "feat: resolve hierarchical muscle targets"
```

---

### Task 3: Generar modelos Hombre/Mujer desde MakeHuman CC0

**Files:**
- Create: `tools/makehuman_targets.py`
- Modify: `tools/generate_model.py`
- Create: `tools/verify_model_contract.py`
- Create: `tests/test_model_generation.py`
- Modify: `.github/workflows/pages.yml`
- Modify: `site/models/model-source.md`

**Interfaces:**
- Produces: `site/models/human-muscle-male-v05.glb` y `site/models/human-muscle-female-v05.glb`.
- Contract: ambos modelos contienen los mismos 18 nodos `muscle__<muscle_id>`; el nodo corporal es `body__male` o `body__female`.

- [ ] **Step 1: Escribir tests Python fallidos para parser/aplicación de targets**

En `tests/test_model_generation.py`, usar `unittest` y archivos temporales para comprobar que una línea MakeHuman `index dx dy dz` modifica solo el vértice indicado y que el promedio de tres targets usa peso `1/3` por fuente.

- [ ] **Step 2: Ejecutar test y confirmar fallo**

Run: `python -m unittest tests/test_model_generation.py -v`

Expected: FAIL porque `tools.makehuman_targets` no existe.

- [ ] **Step 3: Implementar `tools/makehuman_targets.py`**

Interfaces exactas:

```python
parse_target(path: Path) -> dict[int, np.ndarray]
blend_targets(paths: list[Path], vertex_count: int) -> np.ndarray
apply_target_deltas(vertices: np.ndarray, deltas: np.ndarray) -> np.ndarray
```

Ignorar comentarios/líneas vacías; rechazar índices fuera de rango.

- [ ] **Step 4: Modificar el generador para dos variantes**

Usar la misma topología hm08 y calcular las máscaras musculares una sola vez sobre la malla base, para que el contrato de zonas sea idéntico. Para cada sexo visual, aplicar un promedio equiponderado de los targets oficiales `african-*-young`, `asian-*-young`, `caucasian-*-young` de MakeHuman antes de exportar.

Añadir un ajuste fitness suave y explícito después del target, limitado a escala horizontal por bandas corporales, con estos valores iniciales para revisión visual: Hombre: torso superior `+3%`, cintura `-2%`; Mujer: cintura `-5%`, cadera/glúteo `+5%`, muslo superior `+2%`. No alterar longitud de miembros ni pose neutra.

- [ ] **Step 5: Crear verificador de contrato GLB**

`tools/verify_model_contract.py` debe cargar ambos GLB con trimesh y fallar si falta alguna de las 18 IDs, si aparecen IDs distintas entre variantes o si cualquiera de los archivos está vacío/corrupto.

- [ ] **Step 6: Actualizar workflow para descargar las fuentes CC0 necesarias**

Además de `base.obj`, descargar a `.build-assets/targets/` los seis targets young oficiales de MakeHuman (african/asian/caucasian × female/male), generar ambos GLB y ejecutar:

```bash
python -m unittest tests/test_model_generation.py -v
python tools/generate_model.py
python tools/verify_model_contract.py
```

- [ ] **Step 7: Documentar fuente/licencia y alcance**

Actualizar `site/models/model-source.md` explicando los dos modelos, los targets oficiales CC0 y que las zonas siguen siendo aproximaciones superficiales.

- [ ] **Step 8: Verificar generación local/CI**

Expected: dos GLB válidos, distintos geométricamente y con el mismo contrato de 18 zonas.

- [ ] **Step 9: Commit**

```bash
git add tools/makehuman_targets.py tools/generate_model.py tools/verify_model_contract.py tests/test_model_generation.py .github/workflows/pages.yml site/models/model-source.md
git commit -m "feat: generate male and female fitness models"
```

---

### Task 4: Añadir catálogo de variantes corporales y cambio seguro de modelo

**Files:**
- Create: `site/domain/bodyVariants.js`
- Create: `site/viewer/switchModel.js`
- Modify: `site/viewer/ViewerController.js`
- Create: `tests/bodyVariants.test.mjs`
- Create: `tests/modelReplacement.test.mjs`

**Interfaces:**
- Produces: `BODY_VARIANTS`, `DEFAULT_BODY_VARIANT`, `getBodyVariant(id)`.
- Produces: `switchViewerModel(viewer, modelUrl)`.
- Produces: `ViewerController.replaceModel(model)`; conserva `state` y `currentExercise`.

- [ ] **Step 1: Escribir tests fallidos de variantes**

Afirmar que existen exactamente `male`/`female`, con labels `Hombre`/`Mujer`, URLs distintas y default `male`; un ID desconocido debe lanzar error.

- [ ] **Step 2: Escribir test fallido de reemplazo de modelo**

Construir un controlador mínimo con `Object.create(ViewerController.prototype)`, modelo anterior fake, estado `{ yaw, pitch, distance }`, y `currentExercise`. Al llamar `replaceModel(newModel)`, afirmar que:

- el modelo anterior se dispone una vez;
- `state` no cambia;
- se reconstruye el registry;
- el ejercicio actual se vuelve a resaltar en el nuevo modelo;
- no se dispara auto-rotación.

- [ ] **Step 3: Ejecutar tests y confirmar fallo**

Run: `npm test`

Expected: FAIL por APIs inexistentes.

- [ ] **Step 4: Implementar `bodyVariants.js`**

URLs:

```text
./models/human-muscle-male-v05.glb
./models/human-muscle-female-v05.glb
```

- [ ] **Step 5: Implementar `ViewerController.replaceModel(model)`**

Cancelar cualquier auto-rotación activa, reemplazar modelo/registry solo cuando el nuevo modelo ya está cargado, mantener cámara y volver a aplicar `currentExercise` sin animar. `selectExercise` debe guardar `currentExercise`.

- [ ] **Step 6: Implementar `switchViewerModel(viewer, modelUrl)`**

Cargar mediante `loadHumanModel(viewer.gl, modelUrl)` y llamar `viewer.replaceModel(newModel)` solo después de carga exitosa. Si la carga falla, el modelo anterior queda intacto.

- [ ] **Step 7: Ejecutar tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add site/domain/bodyVariants.js site/viewer/switchModel.js site/viewer/ViewerController.js tests/bodyVariants.test.mjs tests/modelReplacement.test.mjs
git commit -m "feat: support safe body model switching"
```

---

### Task 5: Integrar selector Hombre/Mujer preservando el mockup

**Files:**
- Create: `site/ui/bodyVariantSelector.js`
- Create: `site/domain/bodyVariantSelection.js`
- Modify: `site/app/App.js`
- Modify: `site/main.js`
- Modify: `site/styles.css`
- Create: `tests/bodyVariantSelection.test.mjs`

**Interfaces:**
- Consumes: `BODY_VARIANTS`, `DEFAULT_BODY_VARIANT`, `switchViewerModel`.
- Produces: `requestBodyVariantChange(currentId, nextId, loader) -> Promise<string>`; devuelve el ID efectivo y no cambia si `loader` falla.
- Produces UI: `createBodyVariantSelector(container, { initialId, onChange })`.

- [ ] **Step 1: Escribir tests fallidos de transición**

Cubrir tres casos: seleccionar el mismo ID no invoca loader; cambiar `male -> female` invoca loader una vez y devuelve `female`; loader rechazado conserva `male`.

- [ ] **Step 2: Ejecutar test y confirmar fallo**

Run: `npm test`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar lógica de selección**

`requestBodyVariantChange` no debe mutar estado por adelantado. Solo devolver el nuevo ID después de `await loader(nextId)` exitoso.

- [ ] **Step 4: Crear selector UI**

Dos botones accesibles `Hombre` y `Mujer`, con `aria-pressed`, dentro de un contenedor `data-testid="body-variant-selector"`. Mientras carga un modelo, desactivar ambos botones para evitar carreras.

- [ ] **Step 5: Integrar en `App.js`**

Mantener el layout actual. Situar el selector como control flotante discreto del visor, no dentro de la lista de ejercicios. Al cambiar variante, actualizar `shell.dataset.bodyVariant`, estado visible y conservar ejercicio/cámara mediante Task 4.

- [ ] **Step 6: Actualizar `main.js`**

Arrancar con `DEFAULT_BODY_VARIANT` en lugar del único `human-muscle-v2.glb`. Conservar `window.__GYM_APP__`, `window.__GYM_VIEWER__`, `window.__GYM_VIEWER_READY__` y `body.dataset.ready` para no romper el smoke/debug actual.

- [ ] **Step 7: Ajustar CSS responsive**

Añadir estilos del selector sin cambiar las áreas grid existentes. En ≤720 px mantener buscador/filtros y el selector visible sin cubrir tarjeta de detalle ni `viewer-status`; en ≤430 px reducir paddings/texto antes de ocultar controles.

- [ ] **Step 8: Ejecutar tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Smoke test real en navegador**

Verificar escritorio y móvil: seleccionar `Press banca`, cambiar Hombre→Mujer→Hombre, confirmar que el pectoral/tríceps/deltoide siguen resaltados; girar manualmente, cambiar cuerpo y confirmar que la orientación se conserva; comprobar pinch/zoom y búsqueda.

- [ ] **Step 10: Commit**

```bash
git add site/ui/bodyVariantSelector.js site/domain/bodyVariantSelection.js site/app/App.js site/main.js site/styles.css tests/bodyVariantSelection.test.mjs
git commit -m "feat: add male female selector to existing mockup"
```

---

### Task 6: Cerrar v0.5 con CI, documentación y publicación

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`
- Modify: `site/models/model-source.md` si la verificación visual requiere documentar un ajuste final de silueta.

**Interfaces:**
- CI contract: Node tests + Python tests + generación de ambos GLB + verificación de contrato + deploy Pages.

- [ ] **Step 1: Añadir Node 24 al workflow y ejecutar tests antes de publicar**

Añadir `actions/setup-node@v6` con Node `24` y `npm test`. No ejecutar `npm install`, porque v0.5 no incorpora dependencias npm.

- [ ] **Step 2: Fortalecer verificación de assets**

Verificar que existen y tienen tamaño no trivial:

```text
site/models/human-muscle-male-v05.glb
site/models/human-muscle-female-v05.glb
```

Ejecutar además `python tools/verify_model_contract.py`.

- [ ] **Step 3: Actualizar README a v0.5**

Documentar selector Hombre/Mujer, anatomía jerárquica con fallback y continuidad del mockup. Mantener explícita la limitación anatómica superficial.

- [ ] **Step 4: Ejecutar verificación completa local**

Run:

```bash
npm test
python -m unittest tests/test_model_generation.py -v
python tools/generate_model.py
python tools/verify_model_contract.py
```

Expected: todo PASS.

- [ ] **Step 5: Publicar y verificar GitHub Actions**

Tras push/merge, esperar `build` y `deploy` verdes. Abrir `https://datapublicm.github.io/AplicativoGymWebGit/` y repetir smoke visual en un navegador con GPU/WebGL real.

- [ ] **Step 6: Criterio de aceptación visual**

Hombre y Mujer deben verse claramente distintos y más cercanos a las referencias fitness suministradas, manteniendo pose neutra funcional. Si el ajuste inicial de silueta no es suficiente, realizar una sola iteración acotada sobre los coeficientes de `FITNESS_TUNING` sin cambiar interfaces ni mapas musculares.

- [ ] **Step 7: Commit final**

```bash
git add .github/workflows/pages.yml README.md site/models/model-source.md
git commit -m "docs: finalize AplicativoGym web v0.5"
```

---

## Deferred Plans

Después de cerrar y validar visualmente v0.5, crear planes independientes para:

1. catálogo universal normalizado de 300–400 ejercicios + imágenes/licencias/proveniencia;
2. asistente de concordancia `Instrumento + Ejercicio` del Excel;
3. Supabase/PostgreSQL, cuentas, catálogo global/personal y sincronización;
4. historial estructurado y registro de entrenamiento;
5. APK Android/offline sync;
6. editor anatómico visual 3D avanzado.

## Self-Review Result

- La continuidad del mockup está cubierta en Tasks 5–6.
- Hombre/Mujer y procedencia CC0 están cubiertos en Tasks 3–6.
- La taxonomía jerárquica y fallback están cubiertos en Tasks 1–2.
- Las interacciones existentes no se reescriben; el visor recibe reemplazo de modelo y conserva cámara/selección.
- Los subsistemas grandes restantes se mantienen fuera de v0.5 y tendrán planes propios, evitando mezclar catálogo/backend/APK en una sola entrega.
