import json,tempfile,unittest
from pathlib import Path
import numpy as np
from tools.v5.silhouette_input import SilhouetteView

LEVELS={'planta':0.0,'tobillo':0.08,'gemelo_max':0.22,'rodilla':0.36,'entrepierna':0.53,'pelvis':0.58,'cintura':0.66,'ombligo':0.72,'pecho_max':0.82,'hombros':0.88,'cuello':0.92,'menton':0.95,'coronilla':1.0}

class Tests(unittest.TestCase):
    def test_load_validate_and_sample(self):
        from tools.v5.anatomical_landmarks import load_landmarks
        from tools.v5.silhouette_sampling import sample_profile
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'l.json'; p.write_text(json.dumps({'levels':LEVELS,'side_axis_x':0.5,'side_front_sign':1}))
            lm=load_landmarks(p); self.assertEqual(lm.side_front_sign,1)
            front=np.zeros((101,80),bool); side=np.zeros((101,60),bool)
            for y in range(101):
                yy=100-y; half=12 if 15<yy<90 else 5
                front[y,40-half:41+half]=1; side[y,25:37]=1
            front[18,2:12]=1; front[18,68:78]=1
            fv=SilhouetteView(front,80,101,39.5,0,100); sv=SilhouetteView(side,60,101,29.5,0,100)
            out=sample_profile(fv,sv,lm,('pecho_max','cintura'))
            self.assertEqual(len(out),2); self.assertGreater(out[0].half_width,0); self.assertGreater(out[0].front_depth,0); self.assertGreater(out[0].back_depth,0)
            self.assertLess(out[0].half_width,0.2)
    def test_invalid_order_and_front_sign_fail(self):
        from tools.v5.anatomical_landmarks import LandmarkSet, validate_landmarks
        bad=LandmarkSet({'planta':0.0,'tobillo':0.2,'gemelo_max':0.1,'rodilla':0.3,'entrepierna':0.5,'pelvis':0.6,'cintura':0.65,'ombligo':0.7,'pecho_max':0.8,'hombros':0.88,'cuello':0.92,'menton':0.95,'coronilla':1.0},.5,1)
        with self.assertRaises(ValueError): validate_landmarks(bad)
        bad2=LandmarkSet(LEVELS,.5,0)
        with self.assertRaises(ValueError): validate_landmarks(bad2)
if __name__=='__main__':unittest.main()
