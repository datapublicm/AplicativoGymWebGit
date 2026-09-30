from __future__ import annotations
from pathlib import Path
import argparse, sys
if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.v5.silhouette_input import normalize_reference_pair
from tools.v5.anatomical_landmarks import load_landmarks
from tools.v5.silhouette_sampling import sample_profile
from tools.v5.body_sections import build_torso_sections
from tools.v5.body_loft import build_male_cage
from tools.v5.anatomical_refinement import refine_anatomy
from tools.v5.extremity_detail import shape_head_hands_feet
from tools.v5.shorts_from_body import build_shorts_mesh
from tools.v5.male_v5_export import subdivide_for_export, build_scene

TORSO_NAMES=('entrepierna','pelvis','cintura','ombligo','pecho_max','hombros','cuello','menton','coronilla')

def generate_male_v5(front_path:Path,side_path:Path,landmarks_path:Path,output_path:Path)->Path:
    front,side=normalize_reference_pair(Path(front_path),Path(side_path))
    lm=load_landmarks(Path(landmarks_path))
    samples=sample_profile(front,side,lm,TORSO_NAMES)
    sections=build_torso_sections(samples)
    cage=build_male_cage(sections,{})
    cage=refine_anatomy(cage,{})
    cage=shape_head_hands_feet(cage)
    shorts=build_shorts_mesh(cage.mesh,cage.vertex_labels)
    body=subdivide_for_export(cage.mesh)
    if len(shorts.faces)<2000: shorts=shorts.subdivide()
    scene=build_scene(body,shorts)
    output_path=Path(output_path); output_path.parent.mkdir(parents=True,exist_ok=True)
    output_path.write_bytes(scene.export(file_type='glb'))
    return output_path

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--front',type=Path,required=True); ap.add_argument('--side',type=Path,required=True); ap.add_argument('--landmarks',type=Path,required=True); ap.add_argument('--out',type=Path,required=True)
    a=ap.parse_args(); print(generate_male_v5(a.front,a.side,a.landmarks,a.out))
if __name__=='__main__': main()
