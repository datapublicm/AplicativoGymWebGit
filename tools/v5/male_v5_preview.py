from __future__ import annotations
from pathlib import Path
import numpy as np, trimesh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

VIEWS={'front':0.0,'front_3q':np.deg2rad(45),'side':np.deg2rad(90),'back':np.deg2rad(180)}

def _scene_meshes(glb_path:Path):
    scene=trimesh.load(Path(glb_path),force='scene')
    out=[]
    for node in scene.graph.nodes_geometry:
        tf,name=scene.graph.get(node)
        m=scene.geometry[name].copy(); m.apply_transform(tf)
        out.append((node,m))
    return out

def _rotate_y(v,angle):
    c,s=np.cos(angle),np.sin(angle)
    x=v[:,0]*c+v[:,2]*s
    z=-v[:,0]*s+v[:,2]*c
    return np.c_[x,v[:,1],z]

def _render_one(meshes,angle,path):
    fig,ax=plt.subplots(figsize=(5,8),dpi=160)
    entries=[]; allxy=[]
    for node,m in meshes:
        rv=_rotate_y(m.vertices,angle); xy=rv[:,[0,1]]; z=rv[:,2]
        allxy.append(xy); face_xy=xy[m.faces]; depth=z[m.faces].mean(axis=1)
        color='#d8d8d8' if node.startswith('body__') else '#333333'
        for poly,d in zip(face_xy,depth): entries.append((float(d),poly,color))
    entries.sort(key=lambda x:x[0])
    for color in ('#d8d8d8','#333333'):
        polys=[p for _,p,c in entries if c==color]
        if polys: ax.add_collection(PolyCollection(polys,facecolor=color,edgecolor='none',linewidth=0))
    pts=np.vstack(allxy); xmin,ymin=pts.min(axis=0); xmax,ymax=pts.max(axis=0); pad=max(xmax-xmin,ymax-ymin)*.06
    ax.set_xlim(xmin-pad,xmax+pad); ax.set_ylim(ymin-pad,ymax+pad); ax.set_aspect('equal'); ax.axis('off')
    fig.patch.set_facecolor('#f3f3f3'); ax.set_facecolor('#f3f3f3')
    path.parent.mkdir(parents=True,exist_ok=True); fig.savefig(path,bbox_inches='tight',pad_inches=.05); plt.close(fig)

def render_views(glb_path:Path,output_dir:Path)->dict[str,Path]:
    meshes=_scene_meshes(glb_path); output_dir=Path(output_dir); out={}
    for key,angle in VIEWS.items():
        p=output_dir/f'male-v5-{key.replace("_","-")}.png'; _render_one(meshes,angle,p); out[key]=p
    return out

def projected_silhouette_iou(mesh:trimesh.Trimesh,reference_mask:np.ndarray,view:str)->float:
    from PIL import Image,ImageDraw
    mask=np.asarray(reference_mask,dtype=bool); h,w=mask.shape
    angle=VIEWS.get(view,0.0); rv=_rotate_y(mesh.vertices,angle); xy=rv[:,[0,1]]
    xmin,ymin=xy.min(axis=0); xmax,ymax=xy.max(axis=0); sx=(w*.9)/max(xmax-xmin,1e-9); sy=(h*.9)/max(ymax-ymin,1e-9); sc=min(sx,sy)
    px=(xy[:,0]-(xmin+xmax)/2)*sc+w/2; py=h/2-(xy[:,1]-(ymin+ymax)/2)*sc
    im=Image.new('1',(w,h),0); d=ImageDraw.Draw(im)
    for f in mesh.faces: d.polygon([(float(px[i]),float(py[i])) for i in f],fill=1)
    pred=np.asarray(im,dtype=bool); inter=np.logical_and(pred,mask).sum(); union=np.logical_or(pred,mask).sum()
    return float(inter/union) if union else 1.0

def render_comparison(glb_path:Path,front_reference:Path,side_reference:Path,output_path:Path)->Path:
    from PIL import Image
    views=render_views(glb_path,Path(output_path).parent/'_comparison_views')
    fig,axes=plt.subplots(2,2,figsize=(10,10),dpi=140)
    for ax,p,title in [(axes[0,0],front_reference,'Referencia frontal'),(axes[0,1],views['front'],'GLB frontal'),(axes[1,0],side_reference,'Referencia lateral'),(axes[1,1],views['side'],'GLB lateral')]:
        ax.imshow(Image.open(p),cmap='gray'); ax.set_title(title); ax.axis('off')
    Path(output_path).parent.mkdir(parents=True,exist_ok=True); fig.savefig(output_path,bbox_inches='tight'); plt.close(fig); return Path(output_path)
