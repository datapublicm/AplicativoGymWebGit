from __future__ import annotations
import trimesh

def subdivide_for_export(mesh: trimesh.Trimesh, *, min_triangles: int = 20000, max_triangles: int = 110000) -> trimesh.Trimesh:
    out = mesh.copy()
    while len(out.faces) < min_triangles:
        nxt = out.subdivide()
        if len(nxt.faces) > max_triangles or len(nxt.vertices) > 65536:
            raise ValueError('subdivision would exceed export budget')
        out = nxt
    if len(out.faces) > max_triangles or (len(out.faces) and int(out.faces.max()) > 65535):
        raise ValueError('mesh exceeds GLB viewer budget')
    return out

def build_scene(body: trimesh.Trimesh, shorts: trimesh.Trimesh) -> trimesh.Scene:
    scene = trimesh.Scene()
    scene.add_geometry(body, node_name='body__male_v5', geom_name='body__male_v5')
    scene.add_geometry(shorts, node_name='clothes__shorts_male_v5', geom_name='clothes__shorts_male_v5')
    return scene
