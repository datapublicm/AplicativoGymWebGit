import json,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageDraw

LEVELS={'planta':0.0,'tobillo':0.08,'gemelo_max':0.22,'rodilla':0.36,'entrepierna':0.53,'pelvis':0.58,'cintura':0.66,'ombligo':0.72,'pecho_max':0.82,'hombros':0.88,'cuello':0.92,'menton':0.95,'coronilla':1.0}

def refs(root):
    f=Image.new('L',(180,320),255); d=ImageDraw.Draw(f)
    d.ellipse((70,5,110,55),fill=0); d.rectangle((82,45,98,72),fill=0)
    d.polygon([(45,70),(135,70),(122,160),(112,180),(68,180),(58,160)],fill=0); d.rectangle((68,175,112,205),fill=0)
    d.polygon([(68,200),(88,200),(84,315),(68,315)],fill=0); d.polygon([(92,200),(112,200),(112,315),(96,315)],fill=0)
    d.polygon([(45,72),(35,80),(28,190),(42,192),(55,95)],fill=0); d.polygon([(135,72),(145,80),(152,190),(138,192),(125,95)],fill=0)
    s=Image.new('L',(120,320),255); q=ImageDraw.Draw(s)
    q.ellipse((43,5,77,55),fill=0); q.rectangle((50,45,68,72),fill=0)
    q.polygon([(42,68),(79,75),(76,162),(70,185),(45,182),(39,150)],fill=0); q.polygon([(48,180),(74,180),(70,315),(49,315)],fill=0)
    f.save(root/'front.png'); s.save(root/'side.png')
    (root/'landmarks.json').write_text(json.dumps({'levels':LEVELS,'side_axis_x':0.5,'side_front_sign':1}),encoding='utf-8')
    return root/'front.png',root/'side.png',root/'landmarks.json'

class Tests(unittest.TestCase):
    def test_generate_nonempty_glb_and_verify_contract(self):
        from tools.generate_male_v5 import generate_male_v5
        from tools.verify_male_v5_contract import verify_male_v5
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); front,side,lm=refs(root); out=root/'m.glb'
            self.assertEqual(generate_male_v5(front,side,lm,out),out); self.assertGreater(out.stat().st_size,10000)
            report=verify_male_v5(out)
            self.assertTrue(report['body_connected']); self.assertGreaterEqual(report['triangles_total'],20000); self.assertLessEqual(report['max_index'],65535)
if __name__=='__main__':unittest.main()
