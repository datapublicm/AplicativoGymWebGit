from __future__ import annotations

from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.build-assets' / 'makehuman-base.obj'
OUT = ROOT / 'site' / 'models' / 'human-muscle-v2.glb'

MUSCLE_IDS = [
    'pectoralis', 'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior',
    'biceps', 'triceps', 'forearm', 'abdominals', 'obliques', 'latissimus',
    'trapezius', 'erector_spinae', 'gluteals', 'quadriceps', 'hamstrings',
    'adductors', 'abductors', 'calves',
]

SCALE = 0.38
SOURCE_Y_CENTER = (8.4913 + -8.1676) / 2.0
SOURCE_Z_CENTER = 0.15
TARGET_Y_CENTER = 1.35
OVERLAY_OFFSET = 0.025


def parse_makehuman_obj(path: Path):
    vertices: list[list[float]] = []
    body_polygons: list[list[int]] = []
    group: str | None = None
    with path.open('r', encoding='utf-8') as fh:
        for raw in fh:
            if raw.startswith('v '):
                vertices.append([float(x) for x in raw.split()[1:4]])
            elif raw.startswith('g '):
                group = raw.split(None, 1)[1].strip()
            elif raw.startswith('f ') and group == 'body':
                body_polygons.append([int(tok.split('/')[0]) - 1 for tok in raw.split()[1:]])
    if not vertices or not body_polygons:
        raise RuntimeError('MakeHuman body geometry not found in OBJ')
    return np.asarray(vertices, dtype=np.float64), body_polygons


def triangulate(polygons: list[list[int]]) -> np.ndarray:
    triangles: list[list[int]] = []
    for poly in polygons:
        if len(poly) < 3:
            continue
        for i in range(1, len(poly) - 1):
            triangles.append([poly[0], poly[i], poly[i + 1]])
    return np.asarray(triangles, dtype=np.int64)


def remap_geometry(vertices: np.ndarray, faces: np.ndarray):
    used = np.unique(faces.reshape(-1))
    mapping = np.full(vertices.shape[0], -1, dtype=np.int64)
    mapping[used] = np.arange(len(used), dtype=np.int64)
    return vertices[used], mapping[faces], used


def face_geometry(vertices: np.ndarray, faces: np.ndarray):
    tri = vertices[faces]
    centers = tri.mean(axis=1)
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    lengths = np.linalg.norm(normals, axis=1)
    normals = normals / np.maximum(lengths[:, None], 1e-12)
    return centers, normals


def distance_to_segment_xy(points: np.ndarray, a: np.ndarray, b: np.ndarray):
    p = points[:, :2]
    aa = a[:2]
    bb = b[:2]
    ab = bb - aa
    t = np.clip(((p - aa) @ ab) / (ab @ ab), 0.0, 1.0)
    q = aa + t[:, None] * ab
    return np.linalg.norm(p - q, axis=1), t


def muscle_masks(centers: np.ndarray, normals: np.ndarray):
    xabs = np.abs(centers[:, 0])
    front = normals[:, 2] > 0.20
    back = normals[:, 2] < -0.20
    side_out = np.sign(centers[:, 0]) * normals[:, 0] > 0.22
    shoulder_side = side_out & (np.abs(normals[:, 2]) < 0.45)

    symmetric_points = np.column_stack([xabs, centers[:, 1], centers[:, 2]])
    shoulder = np.array([1.677, 5.246, 0.146])
    elbow = np.array([3.129, 3.493, 0.132])
    wrist = np.array([4.312, 2.452, 0.250])
    d_upper, t_upper = distance_to_segment_xy(symmetric_points, shoulder, elbow)
    d_fore, t_fore = distance_to_segment_xy(symmetric_points, elbow, wrist)

    masks = {
        'pectoralis': (xabs < 1.45) & (centers[:,1] > 3.55) & (centers[:,1] < 4.90) & front,
        'deltoid_anterior': (d_upper < 0.55) & (t_upper < 0.22) & front,
        'deltoid_lateral': (d_upper < 0.62) & (t_upper < 0.24) & shoulder_side,
        'deltoid_posterior': (d_upper < 0.55) & (t_upper < 0.22) & back,
        'biceps': (d_upper < 0.50) & (t_upper > 0.20) & (t_upper < 0.82) & front,
        'triceps': (d_upper < 0.52) & (t_upper > 0.18) & (t_upper < 0.86) & back,
        'forearm': (d_fore < 0.50) & (t_fore > 0.08) & (t_fore < 0.80) & front,
        'abdominals': (xabs < 0.62) & (centers[:,1] > 1.15) & (centers[:,1] < 3.55) & front,
        'obliques': (xabs > 0.58) & (xabs < 1.35) & (centers[:,1] > 1.15) & (centers[:,1] < 3.65) & (front | side_out),
        'latissimus': (xabs > 0.42) & (xabs < 1.55) & (centers[:,1] > 2.00) & (centers[:,1] < 4.35) & back,
        'trapezius': (xabs < 1.35) & (centers[:,1] > 3.75) & (centers[:,1] < 5.45) & back,
        'erector_spinae': (xabs > 0.10) & (xabs < 0.52) & (centers[:,1] > 0.80) & (centers[:,1] < 3.75) & back,
        'gluteals': (xabs > 0.20) & (xabs < 1.45) & (centers[:,1] > -0.65) & (centers[:,1] < 1.15) & back,
        'quadriceps': (xabs > 0.72) & (xabs < 1.75) & (centers[:,1] > -3.45) & (centers[:,1] < 0.45) & front,
        'hamstrings': (xabs > 0.72) & (xabs < 1.78) & (centers[:,1] > -3.45) & (centers[:,1] < 0.35) & back,
        'adductors': (xabs > 0.38) & (xabs < 1.18) & (centers[:,1] > -2.70) & (centers[:,1] < 0.35) & (front | (np.abs(normals[:,0]) > 0.25)),
        'abductors': (xabs > 0.95) & (xabs < 1.75) & (centers[:,1] > -0.20) & (centers[:,1] < 1.55) & side_out,
        'calves': (xabs > 1.20) & (xabs < 2.45) & (centers[:,1] > -6.95) & (centers[:,1] < -3.85) & back,
    }
    return masks


def transform(vertices: np.ndarray):
    out = vertices.copy()
    out[:, 0] *= SCALE
    out[:, 1] = (out[:, 1] - SOURCE_Y_CENTER) * SCALE + TARGET_Y_CENTER
    out[:, 2] = (out[:, 2] - SOURCE_Z_CENTER) * SCALE
    return out


def patch_mesh(body_vertices: np.ndarray, body_faces: np.ndarray, body_vertex_normals: np.ndarray, selected: np.ndarray):
    selected_faces = body_faces[selected]
    if len(selected_faces) == 0:
        raise RuntimeError('Empty muscle selection')
    used = np.unique(selected_faces.reshape(-1))
    mapping = np.full(body_vertices.shape[0], -1, dtype=np.int64)
    mapping[used] = np.arange(len(used), dtype=np.int64)
    vertices = body_vertices[used] + body_vertex_normals[used] * OVERLAY_OFFSET
    faces = mapping[selected_faces]
    return transform(vertices), faces


def main():
    source_vertices, polygons = parse_makehuman_obj(SOURCE)
    source_faces = triangulate(polygons)
    body_vertices, body_faces, _ = remap_geometry(source_vertices, source_faces)

    body_source = trimesh.Trimesh(vertices=body_vertices, faces=body_faces, process=False)
    body_vertex_normals = body_source.vertex_normals.copy()
    centers, normals = face_geometry(body_vertices, body_faces)
    masks = muscle_masks(centers, normals)

    missing = [name for name in MUSCLE_IDS if int(masks[name].sum()) < 10]
    if missing:
        raise RuntimeError(f'Muscle masks too small: {missing}')

    skin_mat = PBRMaterial(
        name='skin_neutral',
        baseColorFactor=[0.58, 0.61, 0.65, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.88,
    )
    muscle_mat = PBRMaterial(
        name='muscle_overlay',
        baseColorFactor=[0.35, 0.11, 0.13, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.78,
    )

    scene = trimesh.Scene()
    rendered_body = trimesh.Trimesh(vertices=transform(body_vertices), faces=body_faces, process=False)
    rendered_body.visual.material = skin_mat
    scene.add_geometry(rendered_body, node_name='body__makehuman', geom_name='body__makehuman')

    counts: dict[str, int] = {}
    for muscle_id in MUSCLE_IDS:
        selected = masks[muscle_id]
        vertices, faces = patch_mesh(body_vertices, body_faces, body_vertex_normals, selected)
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        mesh.visual.material = muscle_mat
        node_name = f'muscle__{muscle_id}'
        scene.add_geometry(mesh, node_name=node_name, geom_name=node_name)
        counts[muscle_id] = int(len(faces))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(scene.export(file_type='glb'))
    print(f'wrote {OUT} ({OUT.stat().st_size} bytes)')
    print('body vertices:', len(body_vertices), 'triangles:', len(body_faces))
    print('muscle triangles:', counts)


if __name__ == '__main__':
    main()
