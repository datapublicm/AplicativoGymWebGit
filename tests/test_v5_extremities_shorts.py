import unittest, numpy as np
from tests.test_v5_anatomical_refinement import cage
class Tests(unittest.TestCase):
    def test_extremities_shape_and_shorts_are_separate(self):
        from tools.v5.extremity_detail import shape_head_hands_feet
        from tools.v5.shorts_from_body import build_shorts_mesh
        c=shape_head_hands_feet(cage()); lab=np.array(c.vertex_labels); v=c.mesh.vertices
        head=v[lab=='head']; hand=v[lab=='hand']; fore=v[lab=='forearm']; foot=v[lab=='foot']; ankle=v[lab=='ankle']
        self.assertGreater(head[:,2].max(),-head[:,2].min()); self.assertGreater(np.ptp(hand[:,0]),.5*np.ptp(fore[:,0]))
        self.assertGreater(foot[:,2].max(),ankle[:,2].max()); self.assertLess(foot[:,2].min(),ankle[:,2].min())
        shorts=build_shorts_mesh(c.mesh,c.vertex_labels)
        self.assertGreater(len(shorts.faces),0); self.assertIsNot(shorts,c.mesh)
        self.assertGreater(shorts.vertices[:,1].min(),.30); self.assertLess(shorts.vertices[:,1].max(),.65)
if __name__=='__main__':unittest.main()
