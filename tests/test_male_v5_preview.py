import tempfile,unittest
from pathlib import Path
from tests.test_male_v5_generation import refs
class Tests(unittest.TestCase):
    def test_render_four_views_from_real_glb(self):
        from tools.generate_male_v5 import generate_male_v5
        from tools.v5.male_v5_preview import render_views
        with tempfile.TemporaryDirectory() as td:
            r=Path(td); f,s,l=refs(r); glb=generate_male_v5(f,s,l,r/'m.glb')
            out=render_views(glb,r/'views')
            self.assertEqual(set(out),{'front','front_3q','side','back'})
            self.assertTrue(all(p.is_file() and p.stat().st_size>1000 for p in out.values()))
if __name__=='__main__':unittest.main()
