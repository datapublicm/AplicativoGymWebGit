from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import trimesh
from .body_sections import BodySection

@dataclass
class BodyCage:
    mesh: trimesh.Trimesh
    vertex_regions: np.ndarray
    vertex_labels: tuple[str,...]

def loft_rings(rings_xyz:list[np.ndarray],*,cap_start:bool,cap_end:bool)->trimesh.Trimesh:
    if len(rings_xyz)<2: raise ValueError('need at least two rings')
    n=len(rings_xyz[0])
    if n<3 or any(len(r)!=n for r in rings_xyz): raise ValueError('ring sizes must match and be >=3')
    vertices=np.vstack(rings_xyz).astype(float); faces=[]
    for k in range(len(rings_xyz)-1):
        a0=k*n; b0=(k+1)*n
        for i in range(n):
            j=(i+1)%n
            faces.append([a0+i,a0+j,b0+i]); faces.append([a0+j,b0+j,b0+i])
    if cap_start:
        ci=len(vertices); vertices=np.vstack([vertices,np.mean(rings_xyz[0],axis=0)])
        for i in range(n): faces.append([ci,(i+1)%n,i])
    if cap_end:
        ci=len(vertices); vertices=np.vstack([vertices,np.mean(rings_xyz[-1],axis=0)])
        base=(len(rings_xyz)-1)*n
        for i in range(n): faces.append([ci,base+i,base+(i+1)%n])
    return trimesh.Trimesh(vertices=vertices,faces=np.asarray(faces,dtype=np.int64),process=False)

def _ring(points_xz,y):
    return np.c_[points_xz[:,0],np.full(len(points_xz),y),points_xz[:,1]]

def _circle_ring(center_x,y,rx,rz,n=16,z_shift=0.0):
    t=np.linspace(0,2*np.pi,n,endpoint=False)
    return np.c_[center_x+rx*np.cos(t),np.full(n,y),z_shift+rz*np.sin(t)]

def _densify_specs(specs, subdivisions=2):
    out=[]
    for i,(a,b) in enumerate(zip(specs,specs[1:])):
        if not out: out.append(a)
        for j in range(1,subdivisions+1):
            t=j/(subdivisions+1); u=t*t*(3-2*t)
            vals=tuple((1-u)*a[k]+u*b[k] for k in range(3))
            label=a[3] if t<.5 else b[3]
            out.append((*vals,label))
        out.append(b)
    return out

def _append_mesh(vertices,faces,labels,new_mesh,new_labels):
    off=len(vertices); vertices.extend(new_mesh.vertices.tolist()); faces.extend((new_mesh.faces+off).tolist()); labels.extend(new_labels)
    return off

def _remove_one_face_with_edge(faces,a,b):
    for i,f in enumerate(faces):
        if a in f and b in f:
            faces.pop(i); return
    raise ValueError('bridge edge not found')

def _section_label(name,region=None):
    if region=='head' or name in ('coronilla','menton') or name.startswith('head_'): return 'head'
    if name=='cuello': return 'neck'
    if region=='pectoral' or name in ('pecho_max','hombros'): return 'pectoralis'
    if region=='pelvis' or name in ('pelvis','entrepierna'): return 'pelvis'
    return 'torso'

def build_male_cage(torso_sections:list[BodySection],measurements:dict[str,float])->BodyCage:
    if len(torso_sections)<4: raise ValueError('need torso sections')
    sections=sorted(torso_sections,key=lambda s:s.y)
    n=len(sections[0].points_xz)
    if any(len(s.points_xz)!=n for s in sections): raise ValueError('torso rings must match')
    torso_rings=[_ring(s.points_xz,s.y) for s in sections]
    torso=loft_rings(torso_rings,cap_start=True,cap_end=True)
    labels=[]
    for s in sections: labels.extend([_section_label(s.name,s.region)]*n)
    labels.extend([_section_label(sections[0].name,sections[0].region),_section_label(sections[-1].name,sections[-1].region)])
    vertices=torso.vertices.tolist(); faces=torso.faces.tolist()

    shoulder_idx=max(range(len(sections)),key=lambda i: sections[i].y if sections[i].name=='hombros' else -9)
    if sections[shoulder_idx].name!='hombros': shoulder_idx=len(sections)-3
    crotch_idx=min(range(len(sections)),key=lambda i: abs(sections[i].y-0.53))
    shoulder_y=sections[shoulder_idx].y; shoulder_half=float(np.max(np.abs(sections[shoulder_idx].points_xz[:,0])))

    for side in (-1,1):
        cx=side*(shoulder_half-0.025)
        arm_specs=_densify_specs([
            (.01,.048,.047,'deltoid'),(.055,.043,.041,'upper_arm'),(.10,.042,.040,'upper_arm'),
            (.15,.040,.038,'upper_arm'),(.20,.036,.034,'upper_arm'),(.24,.030,.030,'upper_arm'),
            (.27,.036,.032,'forearm'),(.32,.033,.030,'forearm'),(.36,.028,.027,'forearm'),(.39,.038,.025,'hand'),
        ],subdivisions=2)
        rings=[]; ring_labels=[]
        for j,(dy,rx,rz,label) in enumerate(arm_specs):
            rings.append(_circle_ring(cx+side*(.0007*j),shoulder_y-dy,rx,rz))
            ring_labels.extend([label]*16)
        arm=loft_rings(rings,cap_start=False,cap_end=True)
        ring_labels.append('hand')
        off=_append_mesh(vertices,faces,labels,arm,ring_labels)
        tr_base=shoulder_idx*n
        if side==1: ta,tb=tr_base+0,tr_base+1; ai,aj=off+8,off+9
        else: ta,tb=tr_base+n//2,tr_base+n//2+1; ai,aj=off+0,off+1
        _remove_one_face_with_edge(faces,ta,tb)
        faces.extend([[ta,tb,ai],[tb,aj,ai]])

    crotch_y=sections[crotch_idx].y
    for side in (-1,1):
        cx=side*.075
        key_specs=[
            (.005,.074,.078,0.0,'thigh'),(.06,.078,.080,0.0,'thigh'),(.12,.076,.077,0.0,'thigh'),(.18,.068,.069,0.0,'thigh'),
            (.235,.052,.052,0.0,'knee'),(.29,.050,.047,-.003,'calves'),(.34,.055,.050,-.006,'calves'),(.40,.046,.043,-.005,'calves'),
            (.455,.034,.034,0.0,'ankle'),(.505,.045,.095,.045,'foot')]
        leg_specs=[]
        for ii,(a,b) in enumerate(zip(key_specs,key_specs[1:])):
            if not leg_specs: leg_specs.append(a)
            for jj in range(1,3):
                t=jj/3; u=t*t*(3-2*t)
                nums=tuple((1-u)*a[k]+u*b[k] for k in range(4)); label=a[4] if t<.5 else b[4]
                leg_specs.append((*nums,label))
            leg_specs.append(b)
        rings=[]; leg_labels=[]
        for dy,rx,rz,zs,label in leg_specs:
            rings.append(_circle_ring(cx,max(.02,crotch_y-dy),rx,rz,z_shift=zs))
            if label=='thigh':
                for v in rings[-1]: leg_labels.append('quadriceps' if v[2]>=0 else 'hamstrings')
            else: leg_labels.extend([label]*16)
        leg=loft_rings(rings,cap_start=False,cap_end=True)
        leg_labels.append('foot')
        off=_append_mesh(vertices,faces,labels,leg,leg_labels)
        tr_base=crotch_idx*n
        if side==1: ta,tb=tr_base+2,tr_base+3; ai,aj=off+8,off+9
        else: ta,tb=tr_base+n//2+2,tr_base+n//2+3; ai,aj=off+0,off+1
        _remove_one_face_with_edge(faces,ta,tb)
        faces.extend([[ta,tb,ai],[tb,aj,ai]])
        for k in range(16):
            if vertices[off+k][2]<0: labels[off+k]='gluteals'

    mesh=trimesh.Trimesh(vertices=np.asarray(vertices,float),faces=np.asarray(faces,np.int64),process=False)
    regions=np.arange(len(mesh.vertices),dtype=np.int64)
    return BodyCage(mesh,regions,tuple(labels))
