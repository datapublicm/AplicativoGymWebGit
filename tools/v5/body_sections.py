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

def stabilize_torso_samples(samples:list[SilhouetteSample])->list[SilhouetteSample]:
    data={s.name:s for s in samples}
    if 'pecho_max' in data and 'hombros' in data:
        chest=data['pecho_max']; sh=data['hombros']
        data['hombros']=SilhouetteSample(sh.name,sh.y_norm,max(sh.half_width,chest.half_width*1.12),max(sh.front_depth,chest.front_depth*.78),max(sh.back_depth,chest.back_depth*.78))
    return [data[s.name] for s in samples]

def build_torso_sections(samples:list[SilhouetteSample])->list[BodySection]:
    ordered=sorted(samples,key=lambda s:s.y_norm)
    base=[]
    for s in ordered:
        shape='pectoral' if 'pecho' in s.name or s.name=='hombros' else 'waist' if s.name in ('cintura','ombligo') else 'pelvis' if s.name in ('pelvis','entrepierna') else 'head' if s.name in ('menton','coronilla') else 'torso'
        base.append(section_from_sample(s,shape=shape))
    out=[]
    for i,(a,b) in enumerate(zip(base,base[1:])):
        if not out: out.append(a)
        if a.name=='menton' and b.name=='coronilla':
            jaw=a.points_xz
            for j,(t,wm,dm) in enumerate(((.28,1.12,1.10),(.56,1.16,1.13),(.80,1.02,1.02),(.94,.82,.86))):
                pts=jaw.copy(); pts[:,0]*=wm; pts[:,1]*=dm
                out.append(BodySection(f'head_{j}',a.y+(b.y-a.y)*t,pts,'head'))
            crown=jaw.copy(); crown[:,0]*=.58; crown[:,1]*=.62
            out.append(BodySection('coronilla',b.y,crown,'head'))
            continue
        steps=5
        for j in range(1,steps+1):
            t=j/(steps+1); u=t*t*(3-2*t)
            pts=(1-u)*a.points_xz+u*b.points_xz
            region=b.region if t>.5 else a.region
            out.append(BodySection(f'{a.name}__{j}',a.y+(b.y-a.y)*t,pts,region))
        out.append(b)
    return out

def build_limb_station_profile(width:float,front_depth:float,back_depth:float,*,angular_samples:int=32,flatten:float=0.0)->np.ndarray:
    return _profile(width,front_depth,back_depth,angular_samples,0.9,flatten)
