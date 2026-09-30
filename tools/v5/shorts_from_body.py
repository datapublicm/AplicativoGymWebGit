from __future__ import annotations
import numpy as np, trimesh

def _patch(body, face_mask, offset):
    if not np.any(face_mask): return None
    sub=body.submesh([face_mask],append=True,repair=False)
    if not isinstance(sub,trimesh.Trimesh): return None
    sub.vertices=sub.vertices+sub.vertex_normals.copy()*float(offset)
    return sub

def build_shorts_mesh(body:trimesh.Trimesh,vertex_labels:tuple[str,...],*,offset:float=.008)->trimesh.Trimesh:
    labels=np.asarray(vertex_labels); y=body.vertices[:,1]
    fl=labels[body.faces]; cent=body.triangles_center
    pelvis_v=np.isin(labels,['pelvis','gluteals']) & (y>=.49) & (y<=.62)
    pelvis=np.all(pelvis_v[body.faces],axis=1)
    thigh_v=np.isin(labels,['quadriceps','hamstrings','gluteals']) & (y>=.39) & (y<=.54)
    thigh=np.all(thigh_v[body.faces],axis=1)
    patches=[_patch(body,pelvis,offset),_patch(body,thigh & (cent[:,0]<0),offset),_patch(body,thigh & (cent[:,0]>0),offset)]
    patches=[p for p in patches if p is not None and len(p.faces)]
    if not patches: raise ValueError('no body faces available for shorts')
    return trimesh.util.concatenate(patches)
