from __future__ import annotations

import hashlib
import json
import urllib.request
from pathlib import Path

import numpy as np
import trimesh

UPSTREAM_REPO = "makehumancommunity/makehuman"
UPSTREAM_TAG = "v1.3.0"
UPSTREAM_COMMIT = "1f508f6083b2f823dab15de924b3bde72e08d77c"
BASE_URL = f"https://raw.githubusercontent.com/{UPSTREAM_REPO}/{UPSTREAM_COMMIT}/makehuman/data/3dobjs/base.obj"
EXPECTED_SHA256 = "8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c"
OUT_DIR = Path("artifacts/task-13-2c")
SOURCE_OBJ = OUT_DIR / "upstream_base_hm08.obj"
BODY_OBJ = OUT_DIR / "male_basemesh_hm08_body.obj"
BODY_GLB = OUT_DIR / "male_basemesh_hm08_body.glb"
MALE_GLB = OUT_DIR / "male_basemesh_hm08_male_v1.glb"
STATS = OUT_DIR / "basemesh_stats.json"

MALE_TARGETS = (
    "macrodetails/universal-male-young-maxmuscle-minweight.target",
    "macrodetails/universal-male-young-minmuscle-maxweight.target",
)

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def download_source() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE_URL, timeout=120) as response:
        SOURCE_OBJ.write_bytes(response.read())

    target_root = OUT_DIR / "targets"
    target_root.mkdir(parents=True, exist_ok=True)
    for rel in MALE_TARGETS:
        target_path = target_root / Path(rel).name
        url = f"https://raw.githubusercontent.com/{UPSTREAM_REPO}/{UPSTREAM_COMMIT}/makehuman/data/targets/{rel}"
        with urllib.request.urlopen(url, timeout=120) as response:
            target_path.write_bytes(response.read())

def extract_body_group() -> tuple[int, int]:
    vertices = []
    faces = []
    active = False
    with SOURCE_OBJ.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("v "):
                _, x, y, z = line.split()[:4]
                vertices.append((float(x), float(y), float(z)))
            elif line.startswith("g "):
                active = line.strip() == "g body"
            elif active and line.startswith("f "):
                refs = [int(token.split("/")[0]) for token in line.split()[1:]]
                if len(refs) >= 3:
                    faces.append(refs)
    used = sorted({idx for face in faces for idx in face})
    remap = {old: new for new, old in enumerate(used, start=1)}
    with BODY_OBJ.open("w", encoding="utf-8") as fh:
        fh.write("# Task 13.2C — body-only hm08 basemesh\n")
        fh.write(f"# upstream={UPSTREAM_REPO}@{UPSTREAM_COMMIT}\n")
        fh.write("# asset-license=CC0-1.0\n")
        for idx in used:
            x, y, z = vertices[idx - 1]
            fh.write(f"v {x:.7f} {y:.7f} {z:.7f}\n")
        fh.write("g body_hm08\n")
        for face in faces:
            fh.write("f " + " ".join(str(remap[idx]) for idx in face) + "\n")
    triangle_count = sum(max(0, len(face) - 2) for face in faces)
    return len(used), triangle_count

def count_face_components(faces: np.ndarray, vertex_count: int) -> int:
    parent = list(range(vertex_count))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for face in faces:
        a, b, c = (int(face[0]), int(face[1]), int(face[2]))
        union(a, b)
        union(b, c)
        union(c, a)

    used = {find(int(v)) for face in faces for v in face}
    return len(used)


def parse_target(path: Path) -> dict[int, np.ndarray]:
    deltas = {}
    with path.open("r", encoding="utf-8") as fh:
        for line_number, raw in enumerate(fh, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) != 4:
                raise ValueError(f"{path}:{line_number}: expected index dx dy dz")
            deltas[int(parts[0])] = np.asarray([float(parts[1]), float(parts[2]), float(parts[3])], dtype=np.float64)
    return deltas

def apply_male_targets(source_vertices: np.ndarray) -> np.ndarray:
    deltas = np.zeros_like(source_vertices, dtype=np.float64)
    for name in MALE_TARGETS:
        target = parse_target(OUT_DIR / "targets" / Path(name).name)
        for index, delta in target.items():
            if index < 0 or index >= len(source_vertices):
                raise ValueError(f"target index {index} out of range: {name}")
            deltas[index] += delta / len(MALE_TARGETS)
    return source_vertices + deltas

def export_glb(parsed_vertices: int, parsed_faces: int) -> dict:
    mesh = trimesh.load(BODY_OBJ, force="mesh", process=False)
    if not isinstance(mesh, trimesh.Trimesh):
        raise RuntimeError("body-only OBJ did not load as one mesh")
    mesh.remove_unreferenced_vertices()
    components = count_face_components(mesh.faces, len(mesh.vertices))
    if components != 1:
        raise RuntimeError(f"expected one connected body component, got {components}")
    if len(mesh.vertices) != parsed_vertices:
        raise RuntimeError(f"vertex mismatch: {len(mesh.vertices)} != {parsed_vertices}")
    if len(mesh.faces) != parsed_faces:
        raise RuntimeError(f"triangle mismatch: {len(mesh.faces)} != {parsed_faces}")
    mesh.vertices -= mesh.vertices.mean(axis=0)
    height = float(np.ptp(mesh.vertices[:, 1]))
    if height <= 0:
        raise RuntimeError("invalid vertical extent")
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name="body__male_basemesh_hm08", geom_name="body__male_basemesh_hm08")
    BODY_GLB.write_bytes(scene.export(file_type="glb"))

    source_vertices = []
    with SOURCE_OBJ.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("v "):
                _, x, y, z = line.split()[:4]
                source_vertices.append((float(x), float(y), float(z)))
    source_vertices = np.asarray(source_vertices, dtype=np.float64)
    male_vertices = apply_male_targets(source_vertices)
    body_obj_vertices = []
    with BODY_OBJ.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("v "):
                _, x, y, z = line.split()[:4]
                body_obj_vertices.append((float(x), float(y), float(z)))
    body_obj_vertices = np.asarray(body_obj_vertices, dtype=np.float64)
    lookup = {tuple(np.round(v, 7)): i for i, v in enumerate(source_vertices)}
    used_indices = [lookup[tuple(np.round(v, 7))] for v in body_obj_vertices]
    male_body_vertices = male_vertices[np.asarray(used_indices, dtype=np.int64)]
    male_mesh = trimesh.Trimesh(vertices=male_body_vertices, faces=mesh.faces.copy(), process=False)
    male_mesh.vertices -= male_mesh.vertices.mean(axis=0)
    male_scene = trimesh.Scene()
    male_scene.add_geometry(male_mesh, node_name="body__male_basemesh_hm08_male_v1", geom_name="body__male_basemesh_hm08_male_v1")
    MALE_GLB.write_bytes(male_scene.export(file_type="glb"))
    digest = sha256(SOURCE_OBJ)
    result = {
        "task": "13.2C",
        "asset": "MakeHuman hm08 body-only basemesh",
        "upstream_repo": UPSTREAM_REPO,
        "upstream_tag": UPSTREAM_TAG,
        "upstream_commit": UPSTREAM_COMMIT,
        "source_sha256": digest,
        "expected_sha256": EXPECTED_SHA256,
        "source_sha256_matches": digest == EXPECTED_SHA256,
        "vertices": int(len(mesh.vertices)),
        "faces": int(len(mesh.faces)),
        "components": int(count_face_components(mesh.faces, len(mesh.vertices))),
        "height_source_units": height,
        "glb_bytes": int(BODY_GLB.stat().st_size),
        "male_glb_bytes": int(MALE_GLB.stat().st_size),
        "male_target_blend": list(MALE_TARGETS),
        "node": "body__male_basemesh_hm08_male_v1",        "status": "GREEN",
    }
    STATS.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result

def main() -> None:
    download_source()
    digest = sha256(SOURCE_OBJ)
    if digest != EXPECTED_SHA256:
        raise RuntimeError(f"SHA-256 mismatch: got {digest}, expected {EXPECTED_SHA256}")
    parsed_vertices, parsed_faces = extract_body_group()
    print(json.dumps(export_glb(parsed_vertices, parsed_faces), indent=2))

if __name__ == "__main__":
    main()
