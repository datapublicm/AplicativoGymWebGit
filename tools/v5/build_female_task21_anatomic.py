import argparse
from pathlib import Path

import numpy as np
import trimesh
import matplotlib.pyplot as plt
from scipy.interpolate import PchipInterpolator
from matplotlib.collections import LineCollection
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

parser = argparse.ArgumentParser(description='Build Gym female Task 2.1 anatomical cage from a CC0 topology guide.')
parser.add_argument('--source', type=Path, required=True, help='Path to WomanBody13.obj (CC0 topology guide).')
parser.add_argument('--out', type=Path, default=Path('build/task21_female_anatomic'), help='Output directory.')
args = parser.parse_args()
SRC = args.source
OUT = args.out
OUT.mkdir(parents=True, exist_ok=True)

scene=trimesh.load(SRC, force='mesh', process=False)
parts=scene.split(only_watertight=False)
m=max(parts,key=lambda g: len(g.faces)).copy()
m.remove_unreferenced_vertices()
# close the small oral boundary so final base is a single closed body shell
trimesh.repair.fill_holes(m)
trimesh.repair.fix_normals(m)
V0=np.asarray(m.vertices).copy(); F=np.asarray(m.faces).copy()
V=V0.copy()

# --- 1. Anatomical arm posing: T-pose -> relaxed low A/neutral pose ---
def smoothstep(t):
    t=np.clip(t,0.0,1.0); return t*t*(3.0-2.0*t)
absx=np.abs(V0[:,0])
# shoulder blend: no hard cut at deltoid/axilla
wx=smoothstep((absx-0.52)/(1.05-0.52))
wy=smoothstep((V0[:,1]-7.25)/(7.88-7.25))
arm_w=wx*wy
# soften weights for central neck/chest even if x threshold catches them
arm_w*=smoothstep((absx-0.45)/0.35)

for side in (-1.0,1.0):
    idx=np.where(np.sign(V0[:,0])==side)[0]
    pivot=np.array([side*0.84, 8.04, 0.13])
    P=V0[idx].copy()
    D=P-pivot
    # shorten along former arm axis only; keep anatomical circumference/hand size
    D[:,0]*=0.82
    theta=np.deg2rad(-78.0*side)
    c,s=np.cos(theta),np.sin(theta)
    # rotation around Z in frontal plane
    x=D[:,0]*c - D[:,1]*s
    y=D[:,0]*s + D[:,1]*c
    D[:,0]=x; D[:,1]=y
    Pfull=pivot+D
    w=arm_w[idx,None]
    V[idx]=V0[idx]*(1-w)+Pfull*w

# --- 2. Torso athleticization, applied in source anatomical coordinates ---
# Ratios derived from Task 1 target cross-sections vs this source cage.
y_nodes=np.array([5.00,5.10,5.70,6.45,6.90,7.55,8.05,8.45,9.83])
fx_nodes=np.array([1.05,1.18,1.27,1.78,1.62,1.62,1.08,1.04,1.08])
fz_nodes=np.array([1.05,1.22,1.34,1.72,1.48,1.20,1.15,1.08,1.05])
fx=np.interp(V0[:,1],y_nodes,fx_nodes,left=1.0,right=1.08)
fz=np.interp(V0[:,1],y_nodes,fz_nodes,left=1.0,right=1.05)
torso_w=smoothstep((V0[:,1]-4.95)/0.65)*(1.0-arm_w)
# Reduce scaling on neck/head center; head gets mild independent width/depth correction.
head_w=smoothstep((V0[:,1]-8.45)/0.35)
torso_w*=1.0-0.88*head_w
V[:,0]*=(1.0+torso_w*(fx-1.0))
V[:,2]*=(1.0+torso_w*(fz-1.0))
# head: slightly fuller than source but not cylindrical
V[:,0]*=(1.0+head_w*0.09)
V[:,2]*=(1.0+head_w*0.04)

# --- 3. Vertical landmark warp to approved female v5 profile ---
# source anatomical Y -> normalized bottom-up target Y
source_y=np.array([0.00,0.80,2.80,5.10,5.70,6.45,6.90,7.55,8.05,8.62,9.82788])
target_y=np.array([0.000,0.047,0.215,0.426,0.468,0.552,0.616,0.710,0.809,0.861,1.000])
warp=PchipInterpolator(source_y,target_y,extrapolate=True)
V[:,1]=warp(np.clip(V[:,1],source_y.min(),source_y.max()))
# normalize exact sole/top and center depth
V[:,1]=(V[:,1]-V[:,1].min())/(V[:,1].max()-V[:,1].min())
# Center model in X; set posterior/anterior around zero without flattening profile
V[:,0]-=(V[:,0].min()+V[:,0].max())/2
V[:,2]-=(np.percentile(V[:,2],2)+np.percentile(V[:,2],98))/2
# normalize horizontal/depth axes to the same H=1.0 scale
SOURCE_H=9.82788
V[:,0]/=SOURCE_H
V[:,2]/=SOURCE_H

# final targeted mild limb adjustments by vertical zone, around each leg center
# Preserve source anatomy; only reduce exaggerated source calf/stance slightly.
for side in (-1.0,1.0):
    sel=(np.sign(V[:,0])==side)&(V[:,1]<0.43)
    # centerline estimated dynamically per vertical band; smooth global shift toward target stance
    V[sel,0]*=0.92

# --- 3b. Lower-limb contract fit (each leg around its own centerline) ---
leg_y=np.array([0.000,0.047,0.141,0.215,0.300])
leg_sx=np.array([1.00,1.66,1.27,1.14,1.00])
leg_sz=np.array([1.00,1.30,1.42,0.95,1.00])
center_abs=np.array([0.095,0.095,0.093,0.083,0.065])
for i in range(len(V)):
    yy=V[i,1]
    if yy<0 or yy>0.30: continue
    side=1.0 if V[i,0]>=0 else -1.0
    cx=side*np.interp(yy,leg_y,center_abs)
    sx=np.interp(yy,leg_y,leg_sx); sz=np.interp(yy,leg_y,leg_sz)
    V[i,0]=cx+(V[i,0]-cx)*sx
    V[i,2]*=sz

# --- 4. Contract fit: match the locked Task-1 torso cross-sections ---
fit_y=np.array([0.468,0.552,0.616,0.710,0.809])
target_w=np.array([0.22,0.16,0.19,0.22,0.25])
target_d=np.array([0.16,0.11,0.13,0.15,0.13])
cur_w=[]; cur_d=[]
for yy in fit_y:
    band=np.abs(V[:,1]-yy)<0.022
    if yy<0.78:
        band &= (arm_w<0.25)
    P=V[band]
    cur_w.append(np.ptp(P[:,0])); cur_d.append(np.ptp(P[:,2]))
cur_w=np.asarray(cur_w); cur_d=np.asarray(cur_d)
wx_fit=np.clip(target_w/np.maximum(cur_w,1e-6),0.72,1.35)
wz_fit=np.clip(target_d/np.maximum(cur_d,1e-6),0.72,1.35)
# Extend with neutral anchors so the fit doesn't distort crotch/neck/head.
fy=np.r_[0.43,fit_y,0.86]
fxfit=np.r_[1.0,wx_fit,1.0]
fzfit=np.r_[1.0,wz_fit,1.0]
for i in range(len(V)):
    yy=V[i,1]
    if yy<0.43 or yy>0.86: continue
    sx=np.interp(yy,fy,fxfit); sz=np.interp(yy,fy,fzfit)
    # Torso gets full fit. Upper deltoid gets shoulder fit; hanging arms below it stay anatomical.
    if yy>=0.76:
        bw=1.0
    else:
        bw=float(1.0-arm_w[i])
    bw=np.clip(bw,0.0,1.0)
    V[i,0]*=(1.0+bw*(sx-1.0))
    V[i,2]*=(1.0+bw*(sz-1.0))
# flatten only the anterior abdominal wall slightly; preserve breast and glute depth
ab=smoothstep((V[:,1]-0.50)/0.035)*(1.0-smoothstep((V[:,1]-0.675)/0.035))
front=(V[:,2]<0)&(arm_w<0.25)
V[front,2]*=(1.0-0.04*ab[front])

# Fine anatomical fit from true plane-section inspection.
# Widen the central waist without moving the hanging forearms.
yy=V[:,1]
waist_g=np.exp(-((yy-0.552)/0.050)**2)
central_waist=np.abs(V[:,0])<0.105
V[central_waist,0]*=(1.0+0.16*waist_g[central_waist])
V[central_waist,2]*=(1.0+0.12*waist_g[central_waist])
# Restore target depth at ribs/pelvis/shoulder while keeping front profile restrained.
for cy,amp,sig,xlim in [(0.616,0.08,0.050,0.115),(0.468,0.08,0.050,0.125),(0.809,0.07,0.045,0.14)]:
    g=np.exp(-((yy-cy)/sig)**2)
    mask=np.abs(V[:,0])<xlim
    V[mask,2]*=(1.0+amp*g[mask])

m2=trimesh.Trimesh(vertices=V, faces=F, process=False)
trimesh.repair.fix_normals(m2)
# Cap the source's single small oral boundary loop to keep one closed shell.
edges=m2.edges_sorted
u,cnt=np.unique(edges,axis=0,return_counts=True)
boundary=u[cnt==1]
if len(boundary):
    import networkx as nx
    G=nx.Graph(); G.add_edges_from(map(tuple,boundary))
    comps=sorted(nx.connected_components(G), key=len, reverse=True)
    # only cap compact loops; source has one 26-edge mouth loop
    for comp in comps:
        ids=list(comp)
        if len(ids)<3: continue
        sub=G.subgraph(ids)
        start=ids[0]; loop=[start]; prev=None; cur=start
        while True:
            nxts=[n for n in sub.neighbors(cur) if n!=prev]
            if not nxts: break
            nxt=nxts[0]
            if nxt==start: break
            loop.append(nxt); prev,cur=cur,nxt
            if len(loop)>len(ids)+2: break
        pts=np.asarray(m2.vertices)[loop]
        center=pts.mean(axis=0)
        center_idx=len(m2.vertices)
        vv=np.vstack([np.asarray(m2.vertices),center])
        ff=np.asarray(m2.faces).tolist()
        # choose winding, then fix normals globally
        for i in range(len(loop)):
            ff.append([loop[i],loop[(i+1)%len(loop)],center_idx])
        m2=trimesh.Trimesh(vertices=vv,faces=np.asarray(ff),process=False)
trimesh.repair.fix_normals(m2)
m2.remove_unreferenced_vertices()

# neutral matte visual
rgba=np.tile(np.array([188,181,174,255],dtype=np.uint8),(len(m2.vertices),1))
m2.visual=trimesh.visual.ColorVisuals(mesh=m2,vertex_colors=rgba)

glb=OUT/'Gym_Female_v5_Task2_1_Anatomic.glb'
m2.export(glb)

# Validation metrics
reload=trimesh.load(glb, force='mesh', process=False)
components=reload.split(only_watertight=False)
edges=reload.edges_sorted
_,counts=np.unique(edges,axis=0,return_counts=True)
boundary=int(np.sum(counts==1)); nonmanifold=int(np.sum(counts>2))
finite=bool(np.isfinite(reload.vertices).all())

# Landmark section measurements via true mesh-plane intersections.
landmarks={
 'shoulders':(0.809,0.25,0.13),'chest':(0.710,0.22,0.15),'ribs':(0.616,0.19,0.13),
 'waist':(0.552,0.16,0.11),'pelvis':(0.468,0.22,0.16),
 'knee':(0.215,0.065,0.070),'calf':(0.141,0.075,0.085),'ankle':(0.047,0.045,0.050)
}
rows=[]
for name,(y,tw,td) in landmarks.items():
    sec=reload.section(plane_origin=[0,y,0],plane_normal=[0,1,0])
    if sec is None:
        rows.append((name,y,float('nan'),float('nan'),tw,td)); continue
    planar,_=sec.to_2D()
    loops=[]
    for p in planar.discrete:
        q=np.asarray(p)[:,:2]
        if len(q)<3: continue
        area=abs(np.dot(q[:,0],np.roll(q[:,1],-1))-np.dot(q[:,1],np.roll(q[:,0],-1)))/2
        span=np.ptp(q,axis=0)
        loops.append((float(area),span))
    if not loops:
        rows.append((name,y,float('nan'),float('nan'),tw,td)); continue
    loops.sort(key=lambda z:z[0],reverse=True)
    span=np.asarray(loops[0][1])
    if y>=0.43:
        width=float(max(span)); depth=float(min(span))
    else:
        # one leg loop: width is the smaller frontal span, depth the larger sagittal span
        width=float(min(span)); depth=float(max(span))
    rows.append((name,y,width,depth,tw,td))

report=OUT/'Gym_Female_v5_Task2_1_Validation.txt'
with open(report,'w',encoding='utf-8') as f:
    f.write('Task 13.2B-v5.0 — Task 2.1 anatomical topology correction\n')
    f.write('source_topology_guide=WomanBody13.obj (CC0; adapted, not used at original proportions)\n')
    f.write(f'vertices={len(reload.vertices)}\nfaces={len(reload.faces)}\ncomponents={len(components)}\n')
    f.write(f'watertight={reload.is_watertight}\nboundary_edges={boundary}\nnonmanifold_edges={nonmanifold}\nfinite={finite}\n')
    f.write(f'euler={reload.euler_number}\nbounds={reload.bounds.tolist()}\nextents={reload.extents.tolist()}\n')
    f.write('\nTrue plane-section spans, normalized H=1.0:\n')
    f.write('zone y measured_width measured_depth target_width target_depth width_delta depth_delta\n')
    for name,y,w,d,tw,td in rows:
        f.write(f'{name} {y:.3f} {w:.4f} {d:.4f} {tw:.4f} {td:.4f} {w-tw:+.4f} {d-td:+.4f}\n')

# Render helpers: projection edge plot + filled tris
faces=np.asarray(reload.faces); verts=np.asarray(reload.vertices)

def draw_proj(ax, a,b, topology=False, title=''):
    tri=verts[faces][:,:,[a,b]]
    # painter sort by omitted axis approximate; flat neutral fill
    coll=Poly3DCollection([]) if False else None
    from matplotlib.collections import PolyCollection
    pc=PolyCollection(tri, facecolors=(0.73,0.70,0.68,1), edgecolors=((0.22,0.22,0.22,0.34) if topology else (0.18,0.18,0.18,0.07)), linewidths=(0.22 if topology else 0.08))
    ax.add_collection(pc); ax.autoscale(); ax.set_aspect('equal'); ax.axis('off'); ax.set_title(title,fontsize=14)

# Front/side/posterior/topology board
fig,axs=plt.subplots(1,4,figsize=(18,8),dpi=150)
draw_proj(axs[0],0,1,True,'Frontal')
draw_proj(axs[1],0,1,True,'Frontal · loops')
draw_proj(axs[2],2,1,True,'Lateral')
# posterior same silhouette but useful topology view
# mirror display x only via normal front projection label posterior
tri=verts[faces][:,:,[0,1]].copy(); tri[:,:,0]*=-1
from matplotlib.collections import PolyCollection
pc=PolyCollection(tri,facecolors=(0.73,0.70,0.68,1),edgecolors=(0.22,0.22,0.22,0.34),linewidths=0.22)
axs[3].add_collection(pc); axs[3].autoscale(); axs[3].set_aspect('equal'); axs[3].axis('off'); axs[3].set_title('Posterior',fontsize=14)
fig.suptitle('Task 13.2B-v5.0 · Task 2.1 — Topología anatómica femenina',fontsize=18)
plt.tight_layout(rect=[0,0,1,.95]); fig.savefig(OUT/'Gym_Female_v5_Task2_1_Topology.png',bbox_inches='tight'); plt.close(fig)

# 3D preview, four views
fig=plt.figure(figsize=(15,8),dpi=150)
views=[('Frontal',(0,-90)),('3/4',(8,-40)),('Lateral',(0,0)),('Posterior',(0,90))]
# coordinate: z depth; matplotlib view azim adjusted empirically
for i,(title,(elev,azim)) in enumerate(views,1):
    ax=fig.add_subplot(1,4,i,projection='3d')
    # for speed render all triangles
    plotv=verts[:,[0,2,1]]
    poly=Poly3DCollection(plotv[faces], linewidths=0.02, alpha=1.0)
    poly.set_facecolor((0.73,0.70,0.68,1)); poly.set_edgecolor((0.18,0.18,0.18,0.05))
    ax.add_collection3d(poly)
    mn=plotv.min(0); mx=plotv.max(0); spans=np.maximum(mx-mn,1e-6)
    ax.set_xlim(mn[0],mx[0]); ax.set_ylim(mn[1],mx[1]); ax.set_zlim(mn[2],mx[2])
    ax.set_box_aspect(spans)
    ax.view_init(elev=elev,azim=azim); ax.set_axis_off(); ax.set_title(title,fontsize=14)
fig.suptitle('Task 13.2B-v5.0 · Task 2.1 — Cage anatómica corregida',fontsize=18)
plt.tight_layout(rect=[0,0,1,.94]); fig.savefig(OUT/'Gym_Female_v5_Task2_1_Preview.png',bbox_inches='tight'); plt.close(fig)

print(report.read_text())
print('GLB',glb)
