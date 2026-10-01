# Task 13.2B-v5.0 — Task 2.1 female topology correction

## Scope

This iteration corrects the topology/anatomical cage before muscular sculpting. It does **not** activate or replace the model in the web viewer.

## Source topology guide

- `WomanBody13.obj`, used as a CC0 topology/anatomy guide.
- The source proportions and T-pose are not kept as-is.
- The build script re-poses the arms and warps/reshapes the body to the approved female v5.0 proportional contract.

## Result

- Vertices: **3246**
- Triangles: **6488**
- Connected components: **1**
- Watertight: **true**
- Boundary edges: **0**
- Non-manifold edges: **0**
- Euler number: **2**
- Coordinates finite: **true**
- GLB export + reload: **passed**

## Normalized plane-section checks (`H = 1.0`)

| Zone | Y | Measured W | Measured D | Target W | Target D | Delta W | Delta D |
|---|---:|---:|---:|---:|---:|---:|---:|
| Shoulders | 0.809 | 0.2479 | 0.1263 | 0.2500 | 0.1300 | -0.0021 | -0.0037 |
| Chest | 0.710 | 0.2206 | 0.1510 | 0.2200 | 0.1500 | +0.0006 | +0.0010 |
| Ribs | 0.616 | 0.1981 | 0.1370 | 0.1900 | 0.1300 | +0.0081 | +0.0070 |
| Waist | 0.552 | 0.1586 | 0.1079 | 0.1600 | 0.1100 | -0.0014 | -0.0021 |
| Pelvis | 0.468 | 0.2170 | 0.1569 | 0.2200 | 0.1600 | -0.0030 | -0.0031 |
| Knee | 0.215 | 0.0650 | 0.0736 | 0.0650 | 0.0700 | +0.0000 | +0.0036 |
| Calf | 0.141 | 0.0760 | 0.0791 | 0.0750 | 0.0850 | +0.0010 | -0.0059 |
| Ankle | 0.047 | 0.0425 | 0.0490 | 0.0450 | 0.0500 | -0.0025 | -0.0010 |

The main contract sections are close to target. The rib section remains slightly fuller and calf sagittal depth slightly lower than the target; those residuals are intentionally left for Task 3 anatomical sculpting rather than over-deforming the cage.

## Topology changes

- Replaced the tubular shoulder/upper-arm transition with an anatomical shoulder/axilla flow.
- Preserved a continuous arm-to-torso shell.
- Improved pelvis/inguinal/glute structure.
- Replaced primitive lower-limb rings with anatomical knee/calf/ankle geometry.
- Added real head, hand/finger and foot geometry suitable for subsequent refinement.
- Closed the small oral boundary so the candidate is one watertight shell.

## Review gate

This is a **visual-review candidate**. Do not merge into the viewer or begin muscle segmentation until the frontal, lateral, posterior and topology boards are approved.
