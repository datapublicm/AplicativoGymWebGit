# Task 13.2B-v5.0 Silhouette Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `site/models/human-male-base-v5.glb` como una malla masculina propia, continua y guiada por las siluetas frontal/lateral aprobadas, sin usar campos implícitos, metaballs ni marching cubes como constructor del cuerpo visible.

**Architecture:** Las referencias se convierten en máscaras de silueta normalizadas y landmarks compartidos. De ellas se obtienen anchos/profundidades por nivel; una cage humana procedimental de topología fija se deforma mediante secciones y refinamientos anatómicos locales, el short se deriva de la superficie corporal y el conjunto se exporta a GLB 2.0. La superficie final se crea directamente con vértices, caras y conexiones de rings; no depende de `tools/implicit_body.py`.

**Tech Stack:** Python 3.12, NumPy 2.x, trimesh 4.x, Pillow, Matplotlib, `unittest`, GLB 2.0.

**Spec:** `docs/superpowers/specs/2026-09-30-task-13-2b-v5-silhouette-body-design.md`

## Global Constraints

- Fuente visual: mockup masculino aprobado, vistas frontal y lateral. Los fixtures sintéticos sirven solo para desarrollar el pipeline.
- Si la referencia original es un render a color, se deriva una máscara frontal/lateral sin alterar escala ni proporciones; el candidato final se ajusta a esas máscaras derivadas del mockup aprobado.
- El perfil v4 puede usarse como fallback de pruebas, nunca como fuente principal del candidato final.
- No usar MakeHuman, modelos comprados ni modelos 3D externos como geometría visible final de v5.
- No usar `tools/implicit_body.py`, metaballs, campos implícitos ni `marching_cubes` como constructor del cuerpo visible.
- Mantener intactos v4/v0.5 y el modelo publicado hasta aprobación visual expresa.
- Formato final: GLB 2.0.
- Nodos obligatorios: `body__male_v5` y `clothes__shorts_male_v5`.
- No exportar todavía nodos `muscle__*`; conservar etiquetas anatómicas internas para segmentación futura.
- Ejes: X izquierda/derecha, Y vertical, Z anterior/posterior.
- Cuerpo principal continuo, caras trianguladas, normales finitas/consistentes y sin NaN/Inf.
- Presupuesto objetivo: 20k–120k triángulos para cuerpo + short.
- Cada geometría debe ser compatible con el visor actual: `max(face index) <= 65535`, porque `site/viewer/loadHumanModel.js` usa `Uint16Array`.
- No modificar `site/viewer/*` ni activar v5 en producción en esta task.
- Cuerpo femenino, rig, animaciones, activación muscular y publicación quedan fuera de alcance.

## Review Focus

1. **Referencias desalineadas:** normalizar coronilla/planta de frontal y lateral a una altura común y rechazar máscaras degeneradas.
2. **Silueta incompleta:** interpolar solo huecos de hasta 2 filas; fallar si un landmark obligatorio cae en un hueco mayor.
3. **Perfil lateral invertido:** declarar `side_front_sign`; siempre producir profundidades anterior/posterior positivas en el sistema Z acordado.
4. **Roots no manifold:** hombro/axila y pelvis/muslo deben compartir topología con torso/pelvis, no ser cilindros superpuestos concatenados.
5. **Complejidad incompatible con el visor:** subdividir solo después de cerrar la forma y detenerse antes de superar 65,536 índices direccionables por geometría.

---

### Task 1: Entrada y normalización de siluetas

**Files:**
- Create: `tools/v5/__init__.py`
- Create: `tools/v5/silhouette_input.py`
- Modify: `requirements-model.txt`
- Test: `tests/test_v5_silhouette_input.py`

**Interfaces:**
- `SilhouetteView(mask: np.ndarray, width_px: int, height_px: int, center_x_px: float, top_y_px: int, bottom_y_px: int)`
- `load_silhouette_mask(path: Path, *, threshold: int = 128, invert: bool = False) -> np.ndarray`
- `normalize_view(mask: np.ndarray) -> SilhouetteView`
- `normalize_reference_pair(front_path: Path, side_path: Path, *, threshold: int = 128) -> tuple[SilhouetteView, SilhouetteView]`

`load_silhouette_mask` uses a nontrivial alpha channel when present; otherwise uses grayscale thresholding. Full-color references without separable foreground are preprocessed once into derived mask PNGs rather than altering geometry code.

- [ ] **Step 1: Write failing tests** — Temporary alpha PNG and grayscale PNG; assert boolean masks, equal normalized body height, finite centerlines, `top_y_px < bottom_y_px`.
- [ ] **Step 2: Add dependency** — Add `Pillow>=10.4,<13`; run `python -m unittest tests/test_v5_silhouette_input.py -v`; expected FAIL because module is missing.
- [ ] **Step 3: Implement interfaces** — Reject empty masks and occupied height `< 8` pixels.
- [ ] **Step 4: Add invalid-reference tests** — Empty and 1-pixel-high masks raise `ValueError`.
- [ ] **Step 5: Verify** — `python -m unittest tests/test_v5_silhouette_input.py -v`; expected PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: normalize v5 silhouette references"`.

### Task 2: Landmarks y muestreo frontal/lateral

**Files:**
- Create: `tools/v5/anatomical_landmarks.py`
- Create: `tools/v5/silhouette_sampling.py`
- Test: `tests/test_v5_landmarks_sampling.py`

**Interfaces:**
- `LandmarkSet(levels: dict[str, float], side_axis_x: float, side_front_sign: int)` with normalized Y `[0,1]`, `0=planta`, `1=coronilla`.
- `load_landmarks(path: Path) -> LandmarkSet`
- `validate_landmarks(landmarks: LandmarkSet) -> None`
- `SilhouetteSample(name: str, y_norm: float, half_width: float, front_depth: float, back_depth: float)`
- `sample_profile(front: SilhouetteView, side: SilhouetteView, landmarks: LandmarkSet, names: tuple[str, ...]) -> list[SilhouetteSample]`

- [ ] **Step 1: Write failing landmark tests** — Manifest with `planta`, `tobillo`, `gemelo_max`, `rodilla`, `entrepierna`, `pelvis`, `cintura`, `ombligo`, `pecho_max`, `hombros`, `cuello`, `menton`, `coronilla`; assert range/order and `side_front_sign in {-1,1}`.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_v5_landmarks_sampling.py -v`.
- [ ] **Step 3: Implement row sampling** — Frontal returns half-width; lateral splits anterior/posterior around `side_axis_x` using `side_front_sign`; all outputs are positive normalized body-height units.
- [ ] **Step 4: Add gap/orientation tests** — ≤2-row gaps interpolate; larger mandatory gaps fail; flipping `side_front_sign` swaps interpretation without negative depth.
- [ ] **Step 5: Verify** — same test command; expected PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: sample v5 anatomy from silhouettes"`.

### Task 3: Secciones anatómicas no elípticas

**Files:**
- Create: `tools/v5/body_sections.py`
- Test: `tests/test_v5_body_sections.py`

**Interfaces:**
- `BodySection(name: str, y: float, points_xz: np.ndarray, region: str)`; torso/head default `points_xz.shape == (48,2)`.
- `section_from_sample(sample: SilhouetteSample, *, shape: str, angular_samples: int = 48) -> BodySection`
- `build_torso_sections(samples: list[SilhouetteSample]) -> list[BodySection]`
- `build_limb_station_profile(width: float, front_depth: float, back_depth: float, *, angular_samples: int = 32, flatten: float = 0.0) -> np.ndarray`

- [ ] **Step 1: Write failing geometry tests** — Pectoral ring reaches sampled half-width/front/back within `1e-6`; waist curvature differs from a pure ellipse with same extrema.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_v5_body_sections.py -v`.
- [ ] **Step 3: Implement profiles** — Separate front/back radial scaling plus superellipse/flatten coefficients; no field evaluation.
- [ ] **Step 4: Add validity tests** — finite points, positive X/Z span, no duplicate closing vertex; zero/negative dimensions raise `ValueError`.
- [ ] **Step 5: Verify** — expected PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: build asymmetric v5 body sections"`.

### Task 4: Cage humana continua y branch topology

**Files:**
- Create: `tools/v5/body_loft.py`
- Test: `tests/test_v5_body_loft.py`

**Interfaces:**
- `BodyCage(mesh: trimesh.Trimesh, vertex_regions: np.ndarray, vertex_labels: tuple[str, ...])`
- `loft_rings(rings_xyz: list[np.ndarray], *, cap_start: bool, cap_end: bool) -> trimesh.Trimesh`
- `build_male_cage(torso_sections: list[BodySection], measurements: dict[str, float]) -> BodyCage`

`build_male_cage` owns a fixed procedural humanoid topology. Torso/head, brazos y piernas comparten boundary vertices en hombro y cadera; no se aceptan closed cylinders superpuestos.

- [ ] **Step 1: Write failing loft tests** — Three 16-point rings: expected vertex count, triangular faces, finite normals, caps.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_v5_body_loft.py -v`.
- [ ] **Step 3: Implement `loft_rings`** — deterministic two-triangle quads; reject mismatched ring sizes.
- [ ] **Step 4: Write whole-cage tests** — one connected component; no repeated face indices; labels include `head`, `neck`, `pectoralis`, `deltoid`, `upper_arm`, `forearm`, `hand`, `pelvis`, `gluteals`, `quadriceps`, `hamstrings`, `knee`, `calves`, `ankle`, `foot`.
- [ ] **Step 5: Implement procedural branch topology** — explicit shoulder and hip root patches sharing vertices with torso/pelvis.
- [ ] **Step 6: Add root regression tests** — shoulder/hip boundary faces have adjacency and cage remains one component after `merge_vertices()`.
- [ ] **Step 7: Verify** — expected PASS.
- [ ] **Step 8: Commit** — `git commit -m "feat: build continuous procedural v5 body cage"`.

### Task 5: Refinamiento anatómico

**Files:**
- Create: `tools/v5/anatomical_refinement.py`
- Test: `tests/test_v5_anatomical_refinement.py`

**Interfaces:**
- `refine_anatomy(cage: BodyCage, measurements: dict[str, float]) -> BodyCage`
- `silhouette_extents(mesh: trimesh.Trimesh, y: float, band: float) -> tuple[float, float, float]`

- [ ] **Step 1: Write failing anatomy tests** — pectoral projection > abdomen; gluteal posterior projection > waist; upper arm max > elbow; calf max > ankle.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_v5_anatomical_refinement.py -v`.
- [ ] **Step 3: Implement smooth local displacements** — label-weighted, no connectivity changes; preserve target silhouette extrema within 5% at `pecho_max`, `cintura`, `pelvis`, `muslo_max`, `gemelo_max`.
- [ ] **Step 4: Add finite/silhouette tests** — all five levels within 5%; no NaN/Inf.
- [ ] **Step 5: Verify** — expected PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: refine v5 muscular anatomy"`.

### Task 6: Cabeza, manos, pies y short derivado

**Files:**
- Create: `tools/v5/extremity_detail.py`
- Create: `tools/v5/shorts_from_body.py`
- Test: `tests/test_v5_extremities_shorts.py`

**Interfaces:**
- `shape_head_hands_feet(cage: BodyCage) -> BodyCage`
- `build_shorts_mesh(body: trimesh.Trimesh, vertex_labels: tuple[str, ...], *, offset: float = 0.008) -> trimesh.Trimesh`

- [ ] **Step 1: Write failing extremity tests** — asymmetric head front/back; palm wider than wrist; foot has heel behind ankle and forefoot ahead.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_v5_extremities_shorts.py -v`.
- [ ] **Step 3: Implement extremity shaping** — modify existing cage vertices only: cranium/mandible/chin, palm/finger mass, heel/arch/instep/forefoot.
- [ ] **Step 4: Write failing shorts tests** — separate mesh; positive body offset; waist/hem boundaries valid; two leg openings; hem above midpoint hip-knee.
- [ ] **Step 5: Implement body-derived shorts** — copy labeled pelvis/upper-thigh band, offset along normals, trim waist/hem, build/seal garment boundary strips; no box/cylinder primitive.
- [ ] **Step 6: Verify** — expected PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat: detail v5 extremities and derive shorts"`.

### Task 7: Densidad final, exportación GLB y contrato

**Files:**
- Create: `tools/v5/male_v5_export.py`
- Create: `tools/generate_male_v5.py`
- Create: `tools/verify_male_v5_contract.py`
- Test: `tests/test_male_v5_generation.py`
- Test: `tests/test_male_v5_glb_contract.py`
- Test: `tests/test_v5_no_implicit_dependency.py`
- Output: `site/models/human-male-base-v5.glb`

**Interfaces:**
- `subdivide_for_export(mesh: trimesh.Trimesh, *, min_triangles: int = 20000, max_triangles: int = 110000) -> trimesh.Trimesh`
- `build_scene(body: trimesh.Trimesh, shorts: trimesh.Trimesh) -> trimesh.Scene`
- `generate_male_v5(front_path: Path, side_path: Path, landmarks_path: Path, output_path: Path) -> Path`
- `verify_male_v5(path: Path) -> dict[str, int | float | bool]`
- CLI: `python tools/generate_male_v5.py --front <png> --side <png> --landmarks <json> --out site/models/human-male-base-v5.glb`

- [ ] **Step 1: Write failing end-to-end generation test** — synthetic PNGs + landmark JSON produce non-empty GLB.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_male_v5_generation.py -v`.
- [ ] **Step 3: Implement `subdivide_for_export`** — use deterministic triangle subdivision only after final shape; iterate until total target density is reached, but reject a result that would exceed `max_triangles` or the 16-bit index contract. No smoothing that changes silhouette extrema.
- [ ] **Step 4: Implement orchestration/export** — nodes exactly `body__male_v5`, `clothes__shorts_male_v5`; no `muscle__*` nodes.
- [ ] **Step 5: Write contract tests** — reimport GLB; required nodes; triangular faces; finite data; body one component; body+short 20k–120k triangles; each geometry `max(face index) <= 65535`.
- [ ] **Step 6: Implement verifier** — keep existing `tools/verify_model_contract.py` unchanged.
- [ ] **Step 7: Add anti-implicit AST test** — no v5 import/reference to `implicit_body`, `skimage.measure` or `marching_cubes`; assert legacy `tools/implicit_body.py` still exists.
- [ ] **Step 8: Run regression suite** — `python -m unittest tests/test_male_v5_generation.py tests/test_male_v5_glb_contract.py tests/test_v5_no_implicit_dependency.py tests/test_model_generation.py tests/test_model_contract.py -v`; expected PASS.
- [ ] **Step 9: Commit** — `git commit -m "feat: export and verify male silhouette v5 GLB"`.

### Task 8: Render de verificación

**Files:**
- Modify: `requirements-model.txt`
- Create: `tools/v5/male_v5_preview.py`
- Create: `tools/render_male_v5_preview.py`
- Test: `tests/test_male_v5_preview.py`
- Output: `artifacts/task-13-2b-v5/`

**Interfaces:**
- `render_views(glb_path: Path, output_dir: Path) -> dict[str, Path]` with `front`, `front_3q`, `side`, `back`.
- `render_comparison(glb_path: Path, front_reference: Path, side_reference: Path, output_path: Path) -> Path`
- `projected_silhouette_iou(mesh: trimesh.Trimesh, reference_mask: np.ndarray, view: str) -> float`

- [ ] **Step 1: Add dependency and failing render test** — Add `matplotlib>=3.9,<4`; assert four PNGs from a GLB reimported from disk.
- [ ] **Step 2: Verify failure** — `python -m unittest tests/test_male_v5_preview.py -v`.
- [ ] **Step 3: Implement deterministic renders** — Matplotlib `Agg`, actual GLB triangles, orthographic front/45°/side/back, bounds-based framing.
- [ ] **Step 4: Implement comparison/IoU** — diagnostic only; `[0,1]`; identical synthetic projection scores above deliberately shifted reference.
- [ ] **Step 5: Run full automated suite** — `python -m unittest discover -s tests -p 'test_*.py' -v && npm test`; expected PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: render male v5 visual verification"`.

### Task 9: Referencias reales y puerta visual

**Files:**
- Build asset: `.build-assets/v5/male-front-mask.png`
- Build asset: `.build-assets/v5/male-side-mask.png`
- Build asset: `.build-assets/v5/male-landmarks.json`
- Regenerate: `site/models/human-male-base-v5.glb`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-front.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-front-3q.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-side.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-back.png`
- Regenerate: `artifacts/task-13-2b-v5/male-v5-comparison.png`

- [ ] **Step 1: Ground approved reference assets** — derive the two masks from the exact approved mockup frontal/lateral views. If those originals are unavailable, final visual acceptance is blocked; do not silently substitute v4 numbers or unrelated renders.
- [ ] **Step 2: Author `male-landmarks.json`** — required Task 2 levels plus `side_axis_x` and `side_front_sign`; declarative, no topology changes.
- [ ] **Step 3: Generate/verify real candidate** — run generator, verifier and preview CLI against these three assets.
- [ ] **Step 4: Inspect visual list** — shoulders, deltoid-arm transition, chest depth, back, waist, pelvis/glutes, thighs, knees, calves, head, hands/feet, shorts. Any failure returns to Tasks 3–6 as geometry work, never image retouching.
- [ ] **Step 5: User visual gate** — show front, 3/4, side, back and comparison derived from the real GLB. Do not integrate into production or start female geometry until explicit approval.
- [ ] **Step 6: Final commit after approval** — `git commit -m "feat: finalize approved male silhouette v5 candidate"`.

## Final Verification

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
npm test
python tools/verify_male_v5_contract.py site/models/human-male-base-v5.glb
```

All commands must pass. The five visual artifacts must come from the reimported GLB and the user must explicitly approve the visual result. Technical success without visual approval leaves Task 13.2B-v5.0 open.
