# Task 13.2B-v4.1 Male Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `human-male-base-v4.glb` como una malla masculina propia, continua y musculosa, usando exclusivamente la referencia masculina aprobada y sin reutilizar MakeHuman como geometría visible final.

**Architecture:** El cuerpo se generará mediante un campo implícito 3D compuesto por volúmenes anatómicos suaves (tórax, abdomen, pelvis, deltoides, brazos, glúteos, muslos y pantorrillas). `skimage.measure.marching_cubes` convertirá ese campo en una sola superficie triangular continua; el short se generará como una segunda malla independiente. Las proporciones se controlarán mediante un perfil paramétrico explícito y pruebas geométricas antes de exportar GLB.

**Tech Stack:** Python 3.12, NumPy, trimesh 4.x, scikit-image `marching_cubes`, unittest.

**Spec:** `docs/superpowers/specs/2026-09-30-task-13-2b-v4-1-male-base-design.md`

## Global Constraints

- La única referencia visual autorizada es `presentación_de_modelo_fitness_masculino.png`.
- No modificar masa muscular, silueta, vestimenta ni estilo aprobado sin autorización expresa.
- El cuerpo visible final no debe provenir de nuevas deformaciones de MakeHuman.
- Formato objetivo: GLB 2.0.
- Nodos obligatorios: `body__male_v4` y `clothes__shorts_male_v4`.
- El cuerpo debe ser una superficie continua; no deben percibirse piezas anatómicas pegadas.
- El short debe ser una malla separada, negra y corta, dejando visible la mayor parte del cuádriceps.
- No realizar todavía segmentación muscular funcional, rig definitivo ni publicación en producción.

## Review Focus

1. **Forma en V exagerada:** la cintura debe ser atlética pero no desproporcionadamente estrecha; prueba de ratios hombro/cintura y pecho/cintura.
2. **Piernas insuficientes:** muslo y pantorrilla deben conservar masa muscular acorde con el torso; prueba de anchos relativos.
3. **Superficie con piezas visibles:** el cuerpo exportado debe ser una sola geometría conectada y sin componentes anatómicos sueltos visibles; prueba de componentes conectados.
4. **Resolución excesiva o insuficiente:** la malla debe permanecer suficientemente suave sin superar un presupuesto razonable para web; prueba de rango de triángulos.
5. **Contrato GLB incompatible:** nombres, escala, orientación y malla del short deben sobrevivir a exportación/reimportación; prueba de contrato del GLB.

---

### Task 1: Perfil paramétrico masculino aprobado

**Files:**
- Create: `tools/male_v4_profile.py`
- Test: `tests/test_male_v4_profile.py`

**Interfaces:**
- Produces: `MALE_V4_PROFILE: dict[str, float | tuple[float, ...]]`
- Produces: `validate_profile(profile: dict) -> None`

- [ ] **Step 1: Write the failing tests**

Crear pruebas para verificar que el perfil contiene parámetros explícitos para altura, hombros, pecho, cintura, pelvis, brazo, antebrazo, muslo, pantorrilla y longitud del short; y que los ratios objetivo evitan la cintura extrema y las piernas delgadas.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_male_v4_profile.py -v`
Expected: FAIL porque `tools/male_v4_profile.py` aún no existe.

- [ ] **Step 3: Implement the profile**

Definir un perfil único y legible que concentre las proporciones del mockup aprobado. No dispersar constantes anatómicas en el generador.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/test_male_v4_profile.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/male_v4_profile.py tests/test_male_v4_profile.py
git commit -m "feat: define approved male v4 proportions"
```

### Task 2: Campo implícito anatómico continuo

**Files:**
- Create: `tools/implicit_body.py`
- Test: `tests/test_implicit_body.py`
- Modify: `requirements-model.txt`

**Interfaces:**
- Consumes: `MALE_V4_PROFILE`
- Produces: `ellipsoid_field(points: np.ndarray, center, radii) -> np.ndarray`
- Produces: `capsule_field(points: np.ndarray, a, b, radius) -> np.ndarray`
- Produces: `smooth_union(fields: list[np.ndarray], softness: float) -> np.ndarray`
- Produces: `male_body_field(points: np.ndarray, profile: dict) -> np.ndarray`

- [ ] **Step 1: Write failing tests**

Probar simetría izquierda/derecha, continuidad en hombro-brazo, continuidad pelvis-muslo y presencia de masa en tórax, deltoides, brazos, glúteos, muslos y pantorrillas.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_implicit_body.py -v`
Expected: FAIL porque las funciones no existen.

- [ ] **Step 3: Add dependency and implement fields**

Añadir `scikit-image>=0.24,<1` a `requirements-model.txt`. Implementar primitivas implícitas y uniones suaves. Los músculos visibles en esta fase se expresan como volumen corporal, no como overlays independientes.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/test_implicit_body.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add requirements-model.txt tools/implicit_body.py tests/test_implicit_body.py
git commit -m "feat: add continuous implicit male body field"
```

### Task 3: Generador de cuerpo y short a GLB

**Files:**
- Create: `tools/generate_male_v4.py`
- Test: `tests/test_male_v4_generation.py`

**Interfaces:**
- Consumes: `male_body_field`, `MALE_V4_PROFILE`
- Produces: `build_body_mesh(profile: dict, resolution: int) -> trimesh.Trimesh`
- Produces: `build_shorts_mesh(profile: dict) -> trimesh.Trimesh`
- Produces: `build_scene(profile: dict) -> trimesh.Scene`
- Produces CLI output: `site/models/human-male-base-v4.glb`

- [ ] **Step 1: Write failing tests**

Probar que el cuerpo tiene un único componente principal, solo triángulos, normales finitas, altura/anchura dentro de ratios definidos y un presupuesto inicial de 20k–120k triángulos. Probar que el short es una geometría distinta y cubre pelvis/cadera sin bajar demasiado sobre el muslo.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_male_v4_generation.py -v`
Expected: FAIL porque el generador no existe.

- [ ] **Step 3: Implement marching cubes and export**

Muestrear el campo implícito sobre una grilla 3D, ejecutar `skimage.measure.marching_cubes`, suavizar únicamente lo necesario sin destruir volumen muscular, crear materiales neutro/negro y exportar los dos nodos requeridos.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/test_male_v4_generation.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/generate_male_v4.py tests/test_male_v4_generation.py
git commit -m "feat: generate custom male v4 GLB"
```

### Task 4: Contrato GLB y compatibilidad con el visor

**Files:**
- Create: `tests/test_male_v4_glb_contract.py`
- Modify: `tools/verify_model_contract.py` only if a generic helper can be reused without changing production model selection.

**Interfaces:**
- Consumes: `site/models/human-male-base-v4.glb`
- Produces: verified node names, scale/bounds, triangle-only geometry, finite vertices/normals.

- [ ] **Step 1: Write failing contract test**

Reimportar el GLB y comprobar `body__male_v4`, `clothes__shorts_male_v4`, bounds compatibles con el visor y ausencia de geometrías antiguas `muscle__*` en esta base.

- [ ] **Step 2: Run test to verify it fails if the contract is wrong**

Run: `python -m unittest tests/test_male_v4_glb_contract.py -v`
Expected: FAIL hasta que el GLB cumpla el contrato.

- [ ] **Step 3: Adjust only export/contract code as needed**

No modificar el modelo publicado ni `bodyVariants.js`; esta task sigue siendo prototipo aislado.

- [ ] **Step 4: Run contract and full Python model suite**

Run: `python -m unittest tests/test_male_v4_profile.py tests/test_implicit_body.py tests/test_male_v4_generation.py tests/test_male_v4_glb_contract.py tests/test_model_generation.py tests/test_model_contract.py -v`
Expected: PASS with 0 failures.

- [ ] **Step 5: Commit**

```bash
git add tests/test_male_v4_glb_contract.py tools/verify_model_contract.py site/models/human-male-base-v4.glb
git commit -m "test: verify custom male v4 GLB contract"
```

### Task 5: Render de verificación desde el GLB real

**Files:**
- Create: `tools/render_male_v4_preview.py`
- Create output: `artifacts/task-13-2b-v4-1/male-v4-front.png`
- Create output: `artifacts/task-13-2b-v4-1/male-v4-front-3q.png`
- Create output: `artifacts/task-13-2b-v4-1/male-v4-back.png`
- Create output: `artifacts/task-13-2b-v4-1/male-v4-comparison.png`
- Test: `tests/test_male_v4_preview.py`

**Interfaces:**
- Consumes: `site/models/human-male-base-v4.glb`
- Produces: imágenes renderizadas después de reimportar el GLB, no imágenes generativas.

- [ ] **Step 1: Write failing preview test**

Probar que el renderer carga el GLB exportado y que genera las cuatro imágenes con dimensiones no nulas.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_male_v4_preview.py -v`
Expected: FAIL porque el renderer aún no existe.

- [ ] **Step 3: Implement deterministic preview renderer**

Renderizar la geometría reimportada desde el GLB en frontal, 3/4 y posterior. La comparativa debe rotular claramente `MOCKUP APROBADO` y `GLB REAL`.

- [ ] **Step 4: Run preview test and full test suite**

Run: `python -m unittest discover -s tests -p 'test_*.py' -v && npm test`
Expected: PASS with 0 failures.

- [ ] **Step 5: User visual gate**

Mostrar al usuario las capturas del GLB real. No integrar en producción ni avanzar al femenino hasta aprobación visual expresa.

- [ ] **Step 6: Commit**

```bash
git add tools/render_male_v4_preview.py tests/test_male_v4_preview.py artifacts/task-13-2b-v4-1/
git commit -m "feat: render real male v4 verification views"
```
