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

    def test_torso_builder_densifies_and_rounds_head(self):
        from tools.v5.body_sections import build_torso_sections
        samples=[SilhouetteSample('entrepierna',.415,.16,.10,.10),SilhouetteSample('pelvis',.51,.19,.12,.13),SilhouetteSample('cintura',.565,.15,.09,.10),SilhouetteSample('ombligo',.625,.16,.10,.10),SilhouetteSample('pecho_max',.735,.23,.13,.12),SilhouetteSample('hombros',.805,.27,.12,.12),SilhouetteSample('cuello',.835,.08,.07,.07),SilhouetteSample('menton',.88,.10,.08,.08),SilhouetteSample('coronilla',1.0,.04,.03,.03)]
        out=build_torso_sections(samples)
        self.assertGreater(len(out),len(samples)*2)
        head=[x for x in out if x.region=='head']
        widths=[np.max(np.abs(x.points_xz[:,0])) for x in head]
        self.assertGreater(max(widths),widths[-1]*1.4)

    def test_stabilize_torso_repairs_occluded_shoulder_sample(self):
        from tools.v5.body_sections import stabilize_torso_samples
        samples=[SilhouetteSample('pecho_max',.735,.14,.07,.08),SilhouetteSample('hombros',.805,.11,.03,.05)]
        out={x.name:x for x in stabilize_torso_samples(samples)}
        self.assertGreaterEqual(out['hombros'].half_width,out['pecho_max'].half_width*1.10)
        self.assertGreaterEqual(out['hombros'].front_depth,out['pecho_max'].front_depth*.75)
        self.assertGreaterEqual(out['hombros'].back_depth,out['pecho_max'].back_depth*.75)

    def test_invalid_dimensions_fail(self):
        from tools.v5.body_sections import build_limb_station_profile
        with self.assertRaises(ValueError): build_limb_station_profile(0,.1,.1)
if __name__=='__main__':unittest.main()
