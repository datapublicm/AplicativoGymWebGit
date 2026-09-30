import unittest, numpy as np
from tools.v5.body_sections import BodySection
from tools.v5.body_loft import build_male_cage

def cage():
    t=np.linspace(0,2*np.pi,48,endpoint=False); ss=[]
    for name,y,w,d in [('entrepierna',.53,.20,.12),('pelvis',.58,.22,.14),('cintura',.66,.18,.10),('ombligo',.72,.20,.11),('pecho_max',.82,.28,.14),('hombros',.88,.32,.13),('cuello',.92,.09,.08),('menton',.95,.10,.09),('coronilla',1.0,.11,.10)]: ss.append(BodySection(name,y,np.c_[w*np.cos(t),d*np.sin(t)],name))
    return build_male_cage(ss,{})
class Tests(unittest.TestCase):
    def test_refinement_changes_anatomical_extrema_without_nans(self):
        from tools.v5.anatomical_refinement import refine_anatomy
        c=cage(); before=c.mesh.vertices.copy(); r=refine_anatomy(c,{})
        self.assertTrue(np.isfinite(r.mesh.vertices).all()); self.assertEqual(r.mesh.faces.shape,c.mesh.faces.shape)
        labels=np.array(r.vertex_labels)
        p=r.mesh.vertices[labels=='pectoralis']; waist=r.mesh.vertices[labels=='torso']; glut=r.mesh.vertices[labels=='gluteals']; calf=r.mesh.vertices[labels=='calves']; ankle=r.mesh.vertices[labels=='ankle']
        self.assertGreater(p[:,2].max(),waist[:,2].max()); self.assertLess(glut[:,2].min(),-.08); self.assertGreater(np.ptp(calf[:,0]),np.ptp(ankle[:,0]))
        self.assertGreater(np.max(np.abs(r.mesh.vertices-before)),0)
if __name__=='__main__':unittest.main()
