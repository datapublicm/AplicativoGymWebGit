import unittest, numpy as np, trimesh
from tools.v5.body_sections import BodySection
class Tests(unittest.TestCase):
    def test_loft_three_rings(self):
        from tools.v5.body_loft import loft_rings
        t=np.linspace(0,2*np.pi,16,endpoint=False)
        rings=[np.c_[.2*np.cos(t),np.full(16,y),.1*np.sin(t)] for y in (0,.5,1)]
        m=loft_rings(rings,cap_start=True,cap_end=True)
        self.assertTrue(np.isfinite(m.vertices).all()); self.assertEqual(m.faces.shape[1],3); self.assertGreater(len(m.faces),64)
    def test_male_cage_connected_and_labeled(self):
        from tools.v5.body_loft import build_male_cage
        t=np.linspace(0,2*np.pi,48,endpoint=False)
        sections=[]
        for name,y,w,d in [('entrepierna',.53,.20,.12),('pelvis',.58,.22,.14),('cintura',.66,.18,.11),('pecho_max',.82,.28,.15),('hombros',.88,.32,.14),('cuello',.92,.09,.08),('menton',.95,.10,.09),('coronilla',1.0,.11,.10)]:
            sections.append(BodySection(name,y,np.c_[w*np.cos(t),d*np.sin(t)],name))
        cage=build_male_cage(sections,{})
        c=cage.mesh.copy(); c.merge_vertices()
        self.assertEqual(len(c.split(only_watertight=False)),1)
        expected={'head','neck','pectoralis','deltoid','upper_arm','forearm','hand','pelvis','gluteals','quadriceps','hamstrings','knee','calves','ankle','foot'}
        self.assertTrue(expected.issubset(set(cage.vertex_labels)))
        self.assertFalse(np.any(cage.mesh.faces[:,0]==cage.mesh.faces[:,1]))
        self.assertGreaterEqual(cage.mesh.vertices[:,1].min(), -0.01)
        self.assertLessEqual(cage.mesh.vertices[:,1].max(), 1.01)
        lab=np.array(cage.vertex_labels)
        self.assertGreater(cage.mesh.vertices[lab=='hand',1].min(), .45)
        self.assertGreaterEqual(len(np.unique(np.round(cage.mesh.vertices[lab=='upper_arm',1],4))),4)
        self.assertGreaterEqual(len(np.unique(np.round(cage.mesh.vertices[lab=='calves',1],4))),2)
        right_upper=cage.mesh.vertices[(lab=='upper_arm') & (cage.mesh.vertices[:,0]>0)]
        right_quad=cage.mesh.vertices[(lab=='quadriceps') & (cage.mesh.vertices[:,0]>0)]
        right_calf=cage.mesh.vertices[(lab=='calves') & (cage.mesh.vertices[:,0]>0)]
        self.assertLess(np.ptp(right_upper[:,0]),.11)
        self.assertLess(np.ptp(right_quad[:,0]),.18)
        self.assertLess(np.ptp(right_calf[:,0]),.12)
if __name__=='__main__':unittest.main()
