from __future__ import annotations
import numpy as np
from .body_loft import BodyCage

def shape_head_hands_feet(cage:BodyCage)->BodyCage:
    mesh=cage.mesh.copy(); v=mesh.vertices.copy(); labels=np.asarray(cage.vertex_labels)
    m=labels=='head'; v[m & (v[:,2]>=0),2]+=0.012; v[m & (v[:,2]<0),2]*=.94
    m=labels=='hand'; v[m,0]*=1.01; v[m & (v[:,2]>=0),2]+=0.004
    m=labels=='foot'; v[m & (v[:,2]>=0),2]+=0.018; v[m & (v[:,2]<0),2]-=.018
    mesh.vertices=v
    return BodyCage(mesh,cage.vertex_regions.copy(),cage.vertex_labels)
