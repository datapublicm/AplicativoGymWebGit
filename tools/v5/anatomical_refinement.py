from __future__ import annotations
import numpy as np, trimesh
from .body_loft import BodyCage

def refine_anatomy(cage:BodyCage,measurements:dict[str,float])->BodyCage:
    mesh=cage.mesh.copy(); v=mesh.vertices.copy(); labels=np.asarray(cage.vertex_labels)
    m=(labels=='pectoralis') & (v[:,2]>=0)
    if np.any(m):
        x=np.abs(v[m,0]); y=v[m,1]
        bulge=.013*np.exp(-((x-.055)/.055)**2-((y-.75)/.065)**2)
        groove=.0035*np.exp(-(x/.016)**2-((y-.75)/.075)**2)
        v[m,2]+=bulge-groove
    m=(labels=='torso') & (v[:,2]>=0) & (v[:,1]>=.56) & (v[:,1]<=.70) & (np.abs(v[:,0])<.075)
    if np.any(m):
        x=np.abs(v[m,0]); y=v[m,1]; bulge=np.zeros_like(y)
        for cy in (.585,.625,.665): bulge += .0032*np.exp(-((y-cy)/.018)**2)*np.exp(-((x-.027)/.028)**2)
        v[m,2]+=bulge
    m=(labels=='torso') & (v[:,2]<0) & (v[:,1]>=.68) & (v[:,1]<=.80); v[m,2]-=.004
    m=labels=='gluteals'; v[m & (v[:,2]<0),2]-=.018
    m=labels=='deltoid'; v[m,0]*=1.018
    m=labels=='upper_arm'; v[m,0]*=1.006
    m=labels=='quadriceps'; v[m & (v[:,2]>=0),2]+=0.006
    m=labels=='hamstrings'; v[m & (v[:,2]<0),2]-=0.005
    mesh.vertices=v
    return BodyCage(mesh,cage.vertex_regions.copy(),cage.vertex_labels)

def silhouette_extents(mesh:trimesh.Trimesh,y:float,band:float)->tuple[float,float,float]:
    pts=mesh.vertices[np.abs(mesh.vertices[:,1]-y)<=band]
    if len(pts)==0: raise ValueError('no vertices in requested band')
    return float(np.max(np.abs(pts[:,0]))), float(max(0,np.max(pts[:,2]))), float(max(0,-np.min(pts[:,2])))
