from __future__ import annotations
import numpy as np, trimesh

def build_shorts_mesh(body:trimesh.Trimesh,vertex_labels:tuple[str,...],*,offset:float=.008)->trimesh.Trimesh:
    labels=np.asarray(vertex_labels)
    allowed=np.isin(labels,['pelvis','gluteals','quadriceps','hamstrings'])
    y=body.vertices[:,1]
    allowed &= (y>=.34)&(y<=.62)
    mask=np.all(allowed[body.faces],axis=1)
    if not np.any(mask): raise ValueError('no body faces available for shorts')
    sub=body.submesh([mask],append=True,repair=False)
    if not isinstance(sub,trimesh.Trimesh): raise ValueError('short extraction failed')
    normals=sub.vertex_normals.copy(); sub.vertices=sub.vertices+normals*float(offset)
    return sub
