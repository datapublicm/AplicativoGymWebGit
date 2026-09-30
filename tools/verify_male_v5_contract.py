from __future__ import annotations
from pathlib import Path
import numpy as np, trimesh

def _geom(scene,node):
    transform,name=scene.graph.get(node)
    if name is None: raise RuntimeError(f'missing node {node}')
    m=scene.geometry[name].copy(); m.apply_transform(transform); return m

def verify_male_v5(path:Path)->dict[str,int|float|bool]:
    path=Path(path)
    if not path.is_file() or path.stat().st_size==0: raise RuntimeError('GLB missing or empty')
    scene=trimesh.load(path,force='scene')
    nodes=set(scene.graph.nodes_geometry)
    required={'body__male_v5','clothes__shorts_male_v5'}
    if not required.issubset(nodes): raise RuntimeError(f'missing nodes: {required-nodes}')
    if any(n.startswith('muscle__') for n in nodes): raise RuntimeError('v5 must not export muscle nodes yet')
    body=_geom(scene,'body__male_v5'); shorts=_geom(scene,'clothes__shorts_male_v5')
    for m in (body,shorts):
        if not np.isfinite(m.vertices).all(): raise RuntimeError('non-finite vertices')
        if m.faces.ndim!=2 or m.faces.shape[1]!=3: raise RuntimeError('non-triangular geometry')
    connected=len(body.copy().split(only_watertight=False))==1
    if not connected: raise RuntimeError('body is not connected')
    total=len(body.faces)+len(shorts.faces); max_index=max(int(body.faces.max()),int(shorts.faces.max()))
    if not 20000<=total<=120000: raise RuntimeError(f'triangle budget violated: {total}')
    if max_index>65535: raise RuntimeError('16-bit index contract violated')
    return {'body_connected':True,'triangles_total':total,'max_index':max_index,'body_vertices':len(body.vertices),'shorts_vertices':len(shorts.vertices)}

def main():
    import argparse; ap=argparse.ArgumentParser(); ap.add_argument('path',type=Path); a=ap.parse_args(); print(verify_male_v5(a.path))
if __name__=='__main__': main()
