import unittest, numpy as np
from tools.v5.silhouette_sampling import SilhouetteSample
class Tests(unittest.TestCase):
    def test_asymmetric_section_hits_extrema_and_is_not_ellipse(self):
        from tools.v5.body_sections import section_from_sample
        s=SilhouetteSample('pecho_max',.82,.25,.14,.11)
        sec=section_from_sample(s,shape='pectoral')
        p=sec.points_xz
        self.assertAlmostEqual(np.max(np.abs(p[:,0])),.25,places=6)
        self.assertAlmostEqual(np.max(p[:,1]),.14,places=6)
        self.assertAlmostEqual(-np.min(p[:,1]),.11,places=6)
        theta=np.linspace(0,2*np.pi,48,endpoint=False)
        ellipse=np.c_[.25*np.cos(theta),np.where(np.sin(theta)>=0,.14,.11)*np.sin(theta)]
        self.assertGreater(np.max(np.abs(p-ellipse)),1e-3)
    def test_invalid_dimensions_fail(self):
        from tools.v5.body_sections import build_limb_station_profile
        with self.assertRaises(ValueError): build_limb_station_profile(0,.1,.1)
if __name__=='__main__':unittest.main()
