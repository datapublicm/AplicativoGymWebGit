from pathlib import Path
import argparse,sys
if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.v5.male_v5_preview import render_views

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('glb',type=Path); ap.add_argument('--out',type=Path,default=Path('artifacts/task-13-2b-v5')); a=ap.parse_args(); print(render_views(a.glb,a.out))
if __name__=='__main__': main()
