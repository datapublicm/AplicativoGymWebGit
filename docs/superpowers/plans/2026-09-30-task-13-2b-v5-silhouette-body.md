# Task 13.2B-v5.0 Silhouette Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `site/models/human-male-base-v5.glb` como una malla masculina propia, continua y guiada por las siluetas frontal/lateral aprobadas, sin usar campos implícitos, metaballs ni marching cubes como constructor del cuerpo visible.

**Architecture:** El pipeline convierte las referencias frontal/lateral en máscaras normalizadas y landmarks compartidos; de ellas obtiene anchos y profundidades por nivel, construye una cage humana procedimental de topología fija, la deforma mediante secciones y refinamientos anatómicos locales, deriva el short desde la superficie corporal y exporta un GLB 2.0. La topología se crea directamente con vértices/caras y conexiones de rings; no hay booleanos implícitos ni dependencia de `tools/implicit_body.py` para la geometría v5.

**Tech Stack:** Python 3.12, NumPy 2.x, trimesh 4.x, Pillow, Matplotlib, `unittest`, GLB 2.0.

**Spec:** `docs/superpowers/specs/2026-09-30-task-13-2b-v5-silhouette-body-design.md`

## Global Constraints

- Fuente visual: mockup masculino aprobado, vistas frontal y lateral; los fixtures sintéticos sirven solo para desarrollar el pipeline.
- El perfil v4 puede usarse como fallback de pruebas, nunca como fuente principal de forma del candidato final.
- No usar MakeHuman, modelos comprados ni modelos 3D externos como geometría visible final de v5.
- No usar `tools/implicit_body.py`, metaballs, campos implícitos ni `marching_cubes` como constructor del cuerpo visible.
- Mantener intactos los artefactos y el comportamiento v4/v0.5 publicados hasta aprobación visual expresa.
- Formato final: GLB 2.0.
- Nodos obligatorios: `body__male_v5` y `clothes__shorts_male_v5`.
- No exportar todavía nodos `muscle__*` para v5; conservar etiquetas anatómicas internas para segmentación futura.
- Ejes: X izquierda/derecha, Y vertical, Z anterior/posterior.
- Cuerpo principal continuo, sin NaN/Inf, normales consistentes y caras trianguladas.
- Presupuesto objetivo: 20k–120k triángulos para cuerpo + short.
- Cada malla exportada debe usar índices compatibles con el visor actual: máximo índice `<= 65535`, porque `site/viewer/loadHumanModel.js` convierte índices a `Uint16Array`.
- No modificar la selección del modelo de producción ni `site/viewer/*` en esta task.
- Cuerpo femenino, rig, animaciones, activación muscular y publicación quedan fuera de alcance.

## Review Focus

1. **Referencias desalineadas o con distinta escala vertical:** la normalización debe llevar coronilla/planta de ambas vistas a la misma altura y rechazar referencias degeneradas.
2. **Filas de silueta vacías/interrumpidas:** el muestreo solo puede interpolar huecos cortos entre datos válidos; debe fallar ante huecos extensos en niveles anatómicos obligatorios.
3. **Orientación lateral invertida:** el manifiesto debe declarar qué lado es anterior y el muestreo debe producir siempre `front_depth > 0` y `back_depth > 0` en el sistema Z acordado.
4. **Transiciones hombro/axila y pelvis/muslo no manifold:** la cage final debe quedar en un solo componente corporal y sin caras degeneradas; los roots de brazos y piernas comparten topología con torso/pelvis, no se concatenan como piezas superpuestas.
5. **Complejidad incompatible con el visor:** cuerpo y short deben conservar `max(index) <= 65535`; la prueba de contrato debe fallar antes de exportar un GLB que el WebGL actual no pueda cargar.

---

### Task 1: Entrada y normalización de siluetas

**Files:**
- Create: `tools/v5/__init__.py`
- Create: `tools/v5/silhouette_input.py`
- Modify: `requirements-model.txt`
- Test: `tests/test_v5_silhouette_input.py`

**Interfaces:**
- Produces: `SilhouetteView(mask: np.ndarray, width_px: int, height_px: int, center_x_px: float, top_y_px: int, bottom_y_px: int)`
- Produces: `load_binary_mask(path: Path, *, threshold: int = 128, invert: bool = False) -> np.ndarray`
- Produces: `normalize_view(mask: np.ndarray) -> SilhouetteView`
- Produces: `normalize_reference_pair(front_path: Path, side_path: Path, *, threshold: int = 128) -> tuple[SilhouetteView, SilhouetteView]`

- [ ] **Step 1: Write failing tests for mask loading and vertical normalization**

Create temporary PNGs with Pillow: one frontal and one lateral synthetic human silhouette at different pixel sizes. Assert binary boolean masks, equal normalized body height, finite centerlines, and `top_y_px < bottom_y_px`.

- [ ] **Step 2: Add the dependency and verify the test fails for the missing module**

Add `Pillow>=10.4,<13` to `requirements-model.txt`.

Run: `python -m unittest tests/test_v5_silhouette_input.py -v`
Expected: FAIL because `tools.v5.silhouette_input` does not exist.

- [ ] **Step 3: Implement the four interfaces**

`normalize_view` must derive the occupied body bounding box from the mask and store the midline of that bounding box; it must reject empty masks and body height below 8 pixels.

- [ ] **Step 4: Add Review Focus coverage for invalid references**

Test empty masks and a 1-pixel-high silhouette; both must raise `ValueError` with a clear message.

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests/test_v5_silhouette_input.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add requirements-model.txt tools/v5/__init__.py tools/v5/silhouette_input.py tests/test_v5_silhouette_input.py
git commit -m "feat: normalize v5 silhouette references"
```

### Task 2: Landmarks y muestreo frontal/lateral

**Files:**
- Create: `tools/v5/anatomical_landmarks.py`
- Create: `tools/v5/silhouette_sampling.py`
- Test: `tests/test_v5_landmarks_sampling.py`

**Interfaces:**
- Consumes: `SilhouetteView`
- Produces: `LandmarkSet(levels: dict[str, float], side_axis_x: float, side_front_sign: int)` where each level is normalized Y in `[0, 1]`, `0=planta`, `1=coronilla`, and `side_front_sign` is `-1` or `+1`.
- Produces: `load_landmarks(path: Path) -> LandmarkSet`
- Produces: `validate_landmarks(landmarks: LandmarkSet) -> None`
- Produces: `SilhouetteSample(name: str, y_norm: float, half_width: float, front_depth: float, back_depth: float)`
- Produces: `sample_profile(front: SilhouetteView, side: SilhouetteView, landmarks: LandmarkSet, names: tuple[str, ...]) -> list[SilhouetteSample]`

- [ ] **Step 1: Write failing landmark-order tests**

Use a temporary JSON manifest containing at least `planta`, `tobillo`, `gemelo`, `rodilla`, `entrepierna`, `pelvis`, `cintura`, `ombligo`, `pecho_max`, `hombros`, `cuello`, `menton`, `coronilla`. Assert all are in `[0,1]`, strictly ordered bottom-to-top where anatomically required, and `side_front_sign in {-1, 1}`.

- [ ] **Step 2: Run to verify failure**

Run: `python -m unittest tests/test_v5_landmarks_sampling.py -v`
Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement JSON loading/validation and row sampling**

For each named Y level, frontal sampling returns half-width from occupied X extents. Lateral sampling uses `side_axis_x` and `side_front_sign` to split anterior/posterior depth; output depths are positive numbers in normalized body-height units.

- [ ] **Step 4: Add gap/interpolation and orientation tests**

A gap of at most 2 source rows may interpolate from nearest valid rows. A larger gap at an obligatory landmark raises `ValueError`. Flipping `side_front_sign` must swap the source-side interpretation while preserving positive `front_depth/back_depth`.

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests/test_v5_landmarks_sampling.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/v5/anatomical_landmarks.py tools/v5/silhouette_sampling.py tests/test_v5_landmarks_sampling.py
git commit -m "feat: sample v5 anatomy from front and side silhouettes"
```

### Task 3: Secciones anatómicas y perfiles no elípticos

**Files:**
- Create: `tools/v5/body_sections.py`
- Test: `tests/test_v5_body_sections.py`

**Interfaces:**
- Consumes: `list[SilhouetteSample]`
- Produces: `BodySection(name: str, y: float, points_xz: np.ndarray, region: str)` with `points_xz.shape == (48, 2)`.
- Produces: `section_from_sample(sample: SilhouetteSample, *, shape: str, angular_samples: int = 48) -> BodySection`
- Produces: `build_torso_sections(samples: list[SilhouetteSample]) -> list[BodySection]`
- Produces: `build_limb_station_profile(width: float, front_depth: float, back_depth: float, *, angular_samples: int = 32, flatten: float = 0.0) -> np.ndarray`

- [ ] **Step 1: Write failing shape tests**

Assert a pectoral section reaches the sampled half-width and separate anterior/posterior depths within `1e-6`; assert a waist profile is not forced to a pure ellipse by checking its lateral curvature against a generated ellipse with the same extrema.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_v5_body_sections.py -v`
Expected: FAIL because `body_sections.py` is missing.

- [ ] **Step 3: Implement asymmetric angular profiles**

Use 48 samples for torso/head rings and 32 for limbs. Build closed XZ profiles with separate front/back radial scaling and optional superellipse/flatten coefficients by section type. No field evaluation or marching cubes.

- [ ] **Step 4: Add positive-dimension/finite tests**

All generated `points_xz` must be finite, closed by indexing rather than duplicate end vertices, and have nonzero X/Z spans. Invalid zero/negative dimensions raise `ValueError`.

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests/test_v5_body_sections.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/v5/body_sections.py tests/test_v5_body_sections.py
git commit -m "feat: build asymmetric v5 body sections"
```

### Task 4: Cage humana continua y topología de branches

**Files:**
- Create: `tools/v5/body_loft.py`
- Test: `tests/test_v5_body_loft.py`

**Interfaces:**
- Consumes: torso `BodySection` objects and limb station profiles.
- Produces: `BodyCage(mesh: trimesh.Trimesh, vertex_regions: np.ndarray, vertex_labels: tuple[str, ...])`
- Produces: `loft_rings(rings_xyz: list[np.ndarray], *, cap_start: bool, cap_end: bool) -> trimesh.Trimesh`
- Produces: `build_male_cage(torso_sections: list[BodySection], measurements: dict[str, float]) -> BodyCage`

`build_male_cage` owns the fixed procedural humanoid topology: torso/head, both arm branches and both leg branches share explicit root boundary vertices. It must not create branches as overlapping closed cylinders that are merely concatenated.

- [ ] **Step 1: Write failing generic loft tests**

Given three 16-point rings, assert expected vertex count, triangular faces only, finite normals and correct caps.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_v5_body_loft.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement `loft_rings`**

Connect equal-size rings with deterministic two-triangle quads; orient faces consistently and reject mismatched ring sizes.

- [ ] **Step 4: Write failing whole-cage topology tests**

Build a cage from synthetic torso data. Assert `len(mesh.split(only_watertight=False)) == 1`, no degenerate faces, finite vertices/normals, and labels exist for at least `head`, `neck`, `pectoralis`, `deltoid`, `upper_arm`, `forearm`, `hand`, `pelvis`, `gluteals`, `quadriceps`, `hamstrings`, `knee`, `calves`, `ankle`, `foot`.

- [ ] **Step 5: Implement the procedural branch topology**

Construct shoulder and hip root patches as part of the torso/pelvis cage and continue them into limb station rings. Left/right symmetry is the initial topology rule; anatomical refinement may later alter front/back shape without changing connectivity.

- [ ] **Step 6: Add non-manifold/root regression tests**

Assert no face has repeated vertex indices, `mesh.face_adjacency` is non-empty through shoulder and hip label boundaries, and the cage remains one connected component after `merge_vertices()`.

- [ ] **Step 7: Run tests**

Run: `python -m unittest tests/test_v5_body_loft.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/v5/body_loft.py tests/test_v5_body_loft.py
git commit -m "feat: build continuous procedural v5 body cage"
```

### Task 5: Refinamiento anatómico de torso y extremidades

**Files:**
- Create: `tools/v5/anatomical_refinement.py`
- Test: `tests/test_v5_anatomical_refinement.py`

**Interfaces:**
- Consumes: `BodyCage`, sampled measurements and vertex labels.
- Produces: `refine_anatomy(cage: BodyCage, measurements: dict[str, float]) -> BodyCage`
- Produces: `silhouette_extents(mesh: trimesh.Trimesh, y: float, band: float) -> tuple[float, float, float]` returning half-width, front depth, back depth.

- [ ] **Step 1: Write failing region-displacement tests**

Assert the refined cage creates: anterior pectoral projection greater than abdomen at their sampled levels; posterior gluteal projection greater than waist; upper-arm maximum wider than elbow; calf maximum wider than ankle. The test must compare labeled vertex subsets, not screenshots.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_v5_anatomical_refinement.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement localized smooth deformations**

Use label-weighted vertex displacements and smooth falloffs along Y/station index. Do not change face connectivity. Preserve frontal/lateral silhouette target extrema within `5%` at `pecho_max`, `cintura`, `pelvis`, `muslo_max`, `gemelo_max`.

- [ ] **Step 4: Add silhouette-preservation and finite-data tests**

Assert the five target levels stay within `5%` of their sampled half-width/front/back measurements and no vertex becomes NaN/Inf.

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests/test_v5_anatomical_refinement.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/v5/anatomical_refinement.py tests/test_v5_anatomical_refinement.py
git commit -m "feat: refine v5 muscular anatomy"
```

### Task 6: Cabeza, manos, pies y short derivado del cuerpo

**Files:**
- Create: `tools/v5/extremity_detail.py`
- Create: `tools/v5/shorts_from_body.py`
- Test: `tests/test_v5_extremities_shorts.py`

**Interfaces:**
- Produces: `shape_head_hands_feet(cage: BodyCage) -> BodyCage`
- Produces: `build_shorts_mesh(body: trimesh.Trimesh, vertex_labels: tuple[str, ...], *, offset: float = 0.008) -> trimesh.Trimesh`

- [ ] **Step 1: Write failing extremity-shape tests**

Assert head depth is asymmetric front/back, hand label vertices produce a palm wider than the wrist, and foot vertices extend farther anteriorly than the ankle while retaining heel vertices posteriorly.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_v5_extremities_shorts.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement head/hand/foot shaping without new disconnected body meshes**

Modify only existing cage vertices/groups: cranium/mandible/chin; wrist/palm/finger mass; heel/arch/instep/forefoot. Connectivity remains from Task 4.

- [ ] **Step 4: Write failing shorts tests**

Assert shorts are a separate mesh, have positive offset from pelvis surface, waist/hem boundary loops are closed, left/right leg openings exist, and hem remains above the midpoint between hip and knee.

- [ ] **Step 5: Implement body-derived shorts**

Extract the labeled pelvis/upper-thigh surface band, copy and offset vertices along normals, trim to declared waist/hem levels, duplicate/seal boundary loops as needed, and triangulate. Do not use a box/cylinder primitive as the short.

- [ ] **Step 6: Run tests**

Run: `python -m unittest tests/test_v5_extremities_shorts.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tools/v5/extremity_detail.py tools/v5/shorts_from_body.py tests/test_v5_extremities_shorts.py
git commit -m "feat: detail v5 extremities and derive shorts"
```

### Task 7: Orquestador, exportación GLB y contrato v5

**Files:**
- Create: `tools/v5/male_v5_export.py`
- Create: `tools/generate_male_v5.py`
- Create: `tools/verify_male_v5_contract.py`
- Test: `tests/test_male_v5_generation.py`
- Test: `tests/test_male_v5_glb_contract.py`
- Test: `tests/test_v5_no_implicit_dependency.py`
- Output: `site/models/human-male-base-v5.glb`

**Interfaces:**
- Produces: `build_scene(body: trimesh.Trimesh, shorts: trimesh.Trimesh) -> trimesh.Scene`
- Produces: `generate_male_v5(front_path: Path, side_path: Path, landmarks_path: Path, output_path: Path) -> Path`
- Produces: `verify_male_v5(path: Path) -> dict[str, int | float | bool]`
- CLI: `python tools/generate_male_v5.py --front <png> --side <png> --landmarks <json> --out site/models/human-male-base-v5.glb`

- [ ] **Step 1: Write failing end-to-end generation test with synthetic references**

Generate temporary front/side PNGs and landmarks JSON, call `generate_male_v5`, and assert a non-empty GLB is written.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_male_v5_generation.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement orchestration and GLB scene export**

Use PBR materials, node names exactly `body__male_v5` and `clothes__shorts_male_v5`; do not emit `muscle__*` nodes. Keep final orientation/scale compatible with the existing model viewer.

- [ ] **Step 4: Write contract tests before verifier implementation**

Reimport the exported GLB and assert: both required nodes exist; exactly two visible geometry nodes are expected for this prototype; all faces triangular; vertices/normals finite; body is one connected component; total triangles between 20,000 and 120,000; every geometry uses at most 65,536 addressable vertices/indices and `max(face index) <= 65535`.

- [ ] **Step 5: Implement `verify_male_v5`**

Return counts/bounds and raise `RuntimeError` on any contract violation. Keep `tools/verify_model_contract.py` unchanged because it verifies the currently published male/female v0.5 models.

- [ ] **Step 6: Add explicit anti-implicit dependency test**

Use `ast` to parse every `tools/v5/*.py` plus `tools/generate_male_v5.py`; assert no import references `implicit_body`, `skimage.measure`, or `marching_cubes`. Also assert `tools/implicit_body.py` still exists unchanged for v4 traceability.

- [ ] **Step 7: Run v5 and regression suites**

Run: `python -m unittest tests/test_male_v5_generation.py tests/test_male_v5_glb_contract.py tests/test_v5_no_implicit_dependency.py tests/test_model_generation.py tests/test_model_contract.py -v`
Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add tools/v5/male_v5_export.py tools/generate_male_v5.py tools/verify_male_v5_contract.py tests/test_male_v5_generation.py tests/test_male_v5_glb_contract.py tests/test_v5_no_implicit_dependency.py site/models/human-male-base-v5.glb
git commit -m "feat: export and verify male silhouette v5 GLB"
```

### Task 8: Render de verificación y comparación de siluetas

**Files:**
- Modify: `requirements-model.txt`
- Create: `tools/v5/male_v5_preview.py`
- Create: `tools/render_male_v5_preview.py`
- Test: `tests/test_male_v5_preview.py`
- Output directory: `artifacts/task-13-2b-v5/`

**Interfaces:**
- Produces: `render_views(glb_path: Path, output_dir: Path) -> dict[str, Path]` with keys `front`, `front_3q`, `side`, `back`.
- Produces: `render_comparison(glb_path: Path, front_reference: Path, side_reference: Path, output_path: Path) -> Path`
- Produces: `projected_silhouette_iou(mesh: trimesh.Trimesh, reference_mask: np.ndarray, view: str) -> float`

- [ ] **Step 1: Add preview dependency and failing render test**

Add `matplotlib>=3.9,<4` to `requirements-model.txt`. Test with a generated v5 GLB and assert four non-empty PNG files are produced after reimporting the GLB from disk.

- [ ] **Step 2: Run failure**

Run: `python -m unittest tests/test_male_v5_preview.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement deterministic orthographic renders**

Use Matplotlib's headless `Agg` backend. Render actual triangles from the reimported GLB at front, 45-degree front 3/4, side and back. Camera framing derives from mesh bounds, not hand-cropped screenshots.

- [ ] **Step 4: Implement comparison and silhouette metrics**

Create a labeled side-by-side image containing reference frontal/lateral masks and rendered frontal/lateral projections. IoU is diagnostic only and does not replace visual approval; tests only require value in `[0,1]` and that identical synthetic masks score higher than deliberately shifted masks.

- [ ] **Step 5: Run preview and complete automated suite**

Run: `python -m unittest discover -s tests -p 'test_*.py' -v && npm test`
Expected: PASS with 0 failures.

- [ ] **Step 6: Commit**

```bash
git add requirements-model.txt tools/v5/male_v5_preview.py tools/render_male_v5_preview.py tests/test_male_v5_preview.py artifacts/task-13-2b-v5/
git commit -m "feat: render male v5 visual verification"
```

### Task 9: Ejecutar contra las referencias aprobadas y puerta visual

**Files:**
- Create or update: `.build-assets/v5/male-front.png` (local/build asset; do not publish unless explicitly approved)
- Create or update: `.build-assets/v5/male-side.png` (local/build asset; do not publish unless explicitly approved)
- Create or update: `.build-assets/v5/male-landmarks.json`
- Regenerate: `site/models/human-male-base-v5.glb`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-front.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-front-3q.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-side.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-back.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-comparison.png`

**Interfaces:**
- Consumes the exact approved frontal/lateral visual references and the declarative landmark manifest.
- Produces the candidate GLB and visual evidence for user review.

- [ ] **Step 1: Ground the real reference assets**

Use the approved mockup files, not inferred replacements. If the original approved frontal/lateral files are unavailable, this step is blocked for final visual acceptance; do not silently substitute v4 numeric proportions or unrelated renders.

- [ ] **Step 2: Author `male-landmarks.json` from the approved views**

Record the named levels required by Task 2 plus `side_axis_x` and `side_front_sign`. Keep the file declarative so proportions can be corrected without changing topology code.

- [ ] **Step 3: Generate and verify the real candidate**

Run:

```bash
python tools/generate_male_v5.py --front .build-assets/v5/male-front.png --side .build-assets/v5/male-side.png --landmarks .build-assets/v5/male-landmarks.json --out site/models/human-male-base-v5.glb
python tools/verify_male_v5_contract.py site/models/human-male-base-v5.glb
python tools/render_male_v5_preview.py --glb site/models/human-male-base-v5.glb --front .build-assets/v5/male-front.png --side .build-assets/v5/male-side.png --out artifacts/task-13-2b-v5
```

Expected: contract PASS and all five visual artifacts generated.

- [ ] **Step 4: Inspect against the visual acceptance list**

Check explicitly: shoulders, deltoid-arm transition, chest depth, back volume, waist, pelvis/glutes, thigh mass, knees, calves, head, hands/feet and short integration. Record any rejection as geometry adjustments in Tasks 3–6, never as image-only retouching.

- [ ] **Step 5: User visual gate**

Present the real GLB-derived front, 3/4, side, back and comparison images. Do not integrate v5 into production and do not begin the female geometry implementation until the user explicitly approves this candidate.

- [ ] **Step 6: Final task commit after visual approval**

```bash
git add site/models/human-male-base-v5.glb artifacts/task-13-2b-v5/
git commit -m "feat: finalize approved male silhouette v5 candidate"
```

## Final Verification

Before claiming Task 13.2B-v5.0 complete:

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
npm test
python tools/verify_male_v5_contract.py site/models/human-male-base-v5.glb
```

All commands must pass. Then confirm that the five preview/comparison images were generated from the reimported GLB and that the user explicitly approved the visual result. Technical success without visual approval remains an open task.
