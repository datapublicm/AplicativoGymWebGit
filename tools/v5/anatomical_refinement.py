from __future__ import annotations
import numpy as np, trimesh
from .body_loft import BodyCage

def refine_anatomy(cage:BodyCage,measurements:dict[str,float])->BodyCage:
    mesh=cage.mesh.copy(); v=mesh.vertices.copy(); labels=np.asarray(cage.vertex_labels)
    m=labels=='pectoralis'; front=m & (v[:,2]>=0); v[front,2]=v[front,2]*1.08+0.008
    back=m & (v[:,2]<0); v[back,2]*=1.04
    m=labels=='gluteals'; v[m & (v[:,2]<0),2]-=.018
    m=labels=='deltoid'; v[m,0]*=1.025
    m=labels=='upper_arm'; v[m,0]*=1.012
    m=labels=='quadriceps'; v[m & (v[:,2]>=0),2]+=0.008
    m=labels=='hamstrings'; v[m & (v[:,2]<0),2]-=0.006
    mesh.vertices=v
    return BodyCage(mesh,cage.vertex_regions.copy(),cage.vertex_labels)

def silhouette_extents(mesh:trimesh.Trimesh,y:float,band:float)->tuple[float,float,float]:
    pts=mesh.vertices[np.abs(mesh.vertices[:,1]-y)<=band]
    if len(pts)==0: raise ValueError('no vertices in requested band')
    return float(np.max(np.abs(pts[:,0]))), float(max(0,np.max(pts[:,2]))), float(max(0,-np.min(pts[:,2])))
