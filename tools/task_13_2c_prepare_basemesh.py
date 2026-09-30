from __future__ import annotations

import hashlib
import json
import urllib.request
from pathlib import Path

import numpy as np
import trimesh

UPSTREAM_REPO = "makehumancommunity/makehuman"
UPSTREAM_COMMIT = "1f508f6083b2f823dab15de924b3bde72e08d77c"
BASE_URL = f"https://raw.githubusercontent.com/{UPSTREAM_REPO}/{UPSTREAM_COMMIT}/makehuman/data/3dobjs/base.obj"
EXPECTED_SHA256 = "8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c"
OUT = Path("artifacts/task-13-2c")

def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r:
        path.write_bytes(r.read())

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def parse_body_group(src: Path, out_obj: Path) -> tuple[int, int]:
    vertices: list[tuple[float, float, float]] = []
    body_faces: list[list[int]] = []
    active = False
    with src.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("v "):
                _, x, y, z = line.split()[:4]
                vertices.append((float(x), float(y), float(z)))
                continue
            if line.startswith("g "):
                active = line.strip() == "g body"
                continue
            if active and line.startswith("f "):
                refs = [int(tok.split("/")[0]) for tok in line.split()[1:]]
                if len(refs) >= 3:
                    body_faces.append(refs)

    used = sorted({idx for face in body_faces for idx in face})
    remap = {old: new for new, old in enumerate(used, start=1)}

    with out_obj.open("w", encoding="utf-8") as f:
        f.write("# Task 13.2C prepared MakeHuman hm08 body-only basemesh\n")
        f.write(f"# upstream={UPSTREAM_REPO}@{UPSTREAM_COMMIT}\n")
        f.write("# license=CC0-1.0 (upstream asset)\n")
        for old in used:
            x, y, z = vertices[old - 1]
            f.write(f"v {x:.7f} {y:.7f} {z:.7f}\n")
        f.write("g body_hm08\n")
        for face in body_faces:
            f.write("f " + " ".join(str(remap[i]) for i in face) + "\n")

    return len(used), len(body_faces)

def build_artifacts(src: Path) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    body_obj = OUT / "male_basemesh_hm08_body.obj"
    verts, faces = parse_body_group(src, body_obj)

    mesh = trimesh.load(body_obj, force="mesh", process=False)
    if not isinstance(mesh, trimesh.Trimesh):
        raise RuntimeError("prepared OBJ did not load as a single mesh")

    mesh.remove_unreferenced_vertices()
    components = mesh.split(only_watertight=False)
    if len(components) != 1:
        raise RuntimeError(f"body mesh must be one connected component, got {len(components)}")

    if len(mesh.vertices) != verts:
        raise RuntimeError(f"vertex mismatch: parsed={verts}, loaded={len(mesh.vertices)}")
    if len(mesh.faces) != faces:
        raise RuntimeError(f"face mismatch: parsed={faces}, loaded={len(mesh.faces)}")

    mesh.remove_degenerate_faces()
    mesh.remove_duplicate_faces()
    mesh.fix_normals()
    mesh.vertices -= mesh.vertices.mean(axis=0)

    height = float(np.ptp(mesh.vertices[:, 1]))
    if height <= 0:
        raise RuntimeError("invalid vertical extent")

    glb = OUT / "male_basemesh_hm08_body.glb"
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name="body__male_basemesh_hm08", geom_name="body__male_basemesh_hm08")
    glb.write_bytes(scene.export(file_type="glb"))

    stats = {
        "upstream_repo": UPSTREAM_REPO,
        "upstream_commit": UPSTREAM_COMMIT,
        "source_sha256": sha256(src),
        "expected_sha256": EXPECTED_SHA256,
        "source_sha256_matches": sha256(src) == EXPECTED_SHA256,
        "body_vertices": int(len(mesh.vertices)),
        "body_faces": int(len(mesh.faces)),
        "body_components": int(len(mesh.split(only_watertight=False))),
        "height_source_units": height,
        "glb_bytes": int(glb.stat().st_size),
        "node": "body__male_basemesh_hm08",
        "status": "GREEN",
    }
    (OUT / "basemesh_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats

def main() -> None:
    src = OUT / "upstream_base.obj"
    download(BASE_URL, src)
    if sha256(src) != EXPECTED_SHA256:
        raise RuntimeError("upstream base.obj SHA-256 mismatch")
    print(json.dumps(build_artifacts(src), indent=2))

if __name__ == "__main__":
    main()
