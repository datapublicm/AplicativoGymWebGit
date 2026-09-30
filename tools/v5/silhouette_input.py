from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from PIL import Image

@dataclass(frozen=True)
class SilhouetteView:
    mask: np.ndarray
    width_px: int
    height_px: int
    center_x_px: float
    top_y_px: int
    bottom_y_px: int

def load_silhouette_mask(path: Path, *, threshold: int=128, invert: bool=False) -> np.ndarray:
    im=Image.open(path)
    arr=np.asarray(im)
    if arr.ndim==3 and arr.shape[2]>=4 and np.ptp(arr[...,3])>0:
        mask=arr[...,3] > 0
    else:
        gray=np.asarray(im.convert('L'))
        mask=gray < threshold
    if invert: mask=~mask
    return mask.astype(bool)

def normalize_view(mask: np.ndarray) -> SilhouetteView:
    mask=np.asarray(mask,dtype=bool)
    ys,xs=np.nonzero(mask)
    if len(xs)==0: raise ValueError('empty silhouette mask')
    top,bottom=int(ys.min()),int(ys.max())
    if bottom-top+1 < 8: raise ValueError('silhouette occupied height must be at least 8 pixels')
    left,right=int(xs.min()),int(xs.max())
    crop=mask[top:bottom+1,left:right+1]
    h,w=crop.shape
    return SilhouetteView(crop,w,h,(w-1)/2.0,0,h-1)

def _resize_to_height(view: SilhouetteView, target_h: int) -> SilhouetteView:
    if view.height_px==target_h: return view
    scale=target_h/view.height_px
    target_w=max(1,round(view.width_px*scale))
    im=Image.fromarray((view.mask.astype(np.uint8)*255),'L').resize((target_w,target_h),Image.Resampling.NEAREST)
    mask=np.asarray(im)>0
    return SilhouetteView(mask,target_w,target_h,(target_w-1)/2.0,0,target_h-1)

def normalize_reference_pair(front_path: Path, side_path: Path, *, threshold: int=128) -> tuple[SilhouetteView,SilhouetteView]:
    front=normalize_view(load_silhouette_mask(front_path,threshold=threshold))
    side=normalize_view(load_silhouette_mask(side_path,threshold=threshold))
    target=max(front.height_px,side.height_px)
    return _resize_to_height(front,target), _resize_to_height(side,target)
