from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .silhouette_input import SilhouetteView
from .anatomical_landmarks import LandmarkSet, validate_landmarks

@dataclass(frozen=True)
class SilhouetteSample:
    name: str; y_norm: float; half_width: float; front_depth: float; back_depth: float

def _row_for(view,y_norm): return int(round((1.0-y_norm)*(view.height_px-1)))

def _runs(row: np.ndarray):
    xs=np.flatnonzero(row)
    if len(xs)==0:return []
    cuts=np.where(np.diff(xs)>1)[0]+1
    return [g for g in np.split(xs,cuts) if len(g)]

def _valid_row(view:SilhouetteView,row:int,max_gap:int=2):
    for d in range(max_gap+1):
        for rr in ({row} if d==0 else {row-d,row+d}):
            if 0<=rr<view.height_px and np.any(view.mask[rr]): return rr
    raise ValueError('silhouette gap exceeds 2 rows at mandatory level')

def _central_run(view,row):
    rr=_valid_row(view,row); runs=_runs(view.mask[rr]); c=view.center_x_px
    containing=[r for r in runs if r[0]<=c<=r[-1]]
    if containing:return max(containing,key=len)
    return min(runs,key=lambda r:min(abs(r[0]-c),abs(r[-1]-c)))

def sample_profile(front:SilhouetteView,side:SilhouetteView,landmarks:LandmarkSet,names:tuple[str,...])->list[SilhouetteSample]:
    validate_landmarks(landmarks); out=[]
    axis=landmarks.side_axis_x*(side.width_px-1) if 0<=landmarks.side_axis_x<=1 else landmarks.side_axis_x
    for name in names:
        y=float(landmarks.levels[name])
        fr=_central_run(front,_row_for(front,y)); sr=_central_run(side,_row_for(side,y))
        half=((fr[-1]-fr[0]+1)/2.0)/front.height_px
        l=max(0.5,axis-sr[0]); r=max(0.5,sr[-1]-axis)
        if landmarks.side_front_sign==1: front_d,back_d=r,l
        else: front_d,back_d=l,r
        out.append(SilhouetteSample(name,y,half,front_d/side.height_px,back_d/side.height_px))
    return out
