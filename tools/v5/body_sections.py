from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .silhouette_sampling import SilhouetteSample

@dataclass(frozen=True)
class BodySection:
    name:str; y:float; points_xz:np.ndarray; region:str

def _profile(width,front,back,n,exponent=1.0,flatten=0.0):
    if min(width,front,back)<=0: raise ValueError('section dimensions must be positive')
    t=np.linspace(0,2*np.pi,n,endpoint=False)
    c=np.cos(t); s=np.sin(t)
    x=width*np.sign(c)*np.abs(c)**exponent
    z=np.where(s>=0,front,back)*np.sign(s)*np.abs(s)**exponent
    if flatten:
        x=x*(1-flatten*np.abs(s)**2)
    return np.c_[x,z]

def section_from_sample(sample:SilhouetteSample,*,shape:str,angular_samples:int=48)->BodySection:
    exp={'pectoral':0.78,'waist':0.72,'pelvis':0.82,'head':0.88}.get(shape,0.9)
    flatten={'waist':0.06,'pectoral':0.03}.get(shape,0.0)
    pts=_profile(sample.half_width,sample.front_depth,sample.back_depth,angular_samples,exp,flatten)
    return BodySection(sample.name,sample.y_norm,pts,shape)

def build_torso_sections(samples:list[SilhouetteSample])->list[BodySection]:
    shapes=[]
    for s in samples:
        shape='pectoral' if 'pecho' in s.name or s.name=='hombros' else 'waist' if s.name in ('cintura','ombligo') else 'pelvis' if s.name in ('pelvis','entrepierna') else 'head' if s.name in ('menton','coronilla') else 'torso'
        shapes.append(section_from_sample(s,shape=shape))
    return shapes

def build_limb_station_profile(width:float,front_depth:float,back_depth:float,*,angular_samples:int=32,flatten:float=0.0)->np.ndarray:
    return _profile(width,front_depth,back_depth,angular_samples,0.9,flatten)
