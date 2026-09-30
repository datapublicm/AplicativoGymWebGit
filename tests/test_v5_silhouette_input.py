import tempfile, unittest
from pathlib import Path
import numpy as np
from PIL import Image

class Tests(unittest.TestCase):
    def test_alpha_and_gray_masks_normalize(self):
        from tools.v5.silhouette_input import load_silhouette_mask, normalize_reference_pair
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)
            a=np.zeros((20,12,4),dtype=np.uint8); a[3:18,4:8,:3]=255; a[3:18,4:8,3]=255
            g=np.full((30,14),255,dtype=np.uint8); g[5:28,5:10]=0
            Image.fromarray(a,'RGBA').save(p/'a.png'); Image.fromarray(g,'L').save(p/'g.png')
            m=load_silhouette_mask(p/'a.png'); self.assertEqual(m.dtype, np.bool_); self.assertTrue(m.any())
            f,s=normalize_reference_pair(p/'a.png',p/'g.png')
            self.assertEqual(f.height_px,s.height_px); self.assertTrue(np.isfinite(f.center_x_px)); self.assertLess(f.top_y_px,f.bottom_y_px)
    def test_degenerate_masks_fail(self):
        from tools.v5.silhouette_input import normalize_view
        with self.assertRaises(ValueError): normalize_view(np.zeros((10,10),dtype=bool))
        m=np.zeros((10,10),dtype=bool); m[4,2:8]=1
        with self.assertRaises(ValueError): normalize_view(m)
if __name__=='__main__': unittest.main()
