from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import json

ORDER=('planta','tobillo','gemelo_max','rodilla','entrepierna','pelvis','cintura','ombligo','pecho_max','hombros','cuello','menton','coronilla')

@dataclass(frozen=True)
class LandmarkSet:
    levels: dict[str,float]
    side_axis_x: float
    side_front_sign: int

def validate_landmarks(landmarks: LandmarkSet)->None:
    if landmarks.side_front_sign not in (-1,1): raise ValueError('side_front_sign must be -1 or 1')
    missing=[k for k in ORDER if k not in landmarks.levels]
    if missing: raise ValueError(f'missing landmarks: {missing}')
    vals=[float(landmarks.levels[k]) for k in ORDER]
    if any(v<0 or v>1 for v in vals): raise ValueError('landmark levels must be in [0,1]')
    if any(b<=a for a,b in zip(vals,vals[1:])): raise ValueError('landmarks must be strictly ordered bottom-to-top')

def load_landmarks(path: Path)->LandmarkSet:
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    lm=LandmarkSet({k:float(v) for k,v in data['levels'].items()},float(data['side_axis_x']),int(data['side_front_sign']))
    validate_landmarks(lm); return lm
