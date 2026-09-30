import unittest

from tools.male_v4_profile import MALE_V4_PROFILE, validate_profile


class MaleV4ProfileTests(unittest.TestCase):
    def test_profile_contains_explicit_body_dimensions(self):
        required = {
            'height', 'shoulder_width', 'chest_width', 'waist_width',
            'pelvis_width', 'upper_arm_diameter', 'forearm_diameter',
            'thigh_diameter', 'calf_diameter', 'short_length',
        }
        self.assertTrue(required.issubset(MALE_V4_PROFILE))

    def test_approved_v_taper_is_athletic_not_extreme(self):
        p = MALE_V4_PROFILE
        shoulder_ratio = p['shoulder_width'] / p['waist_width']
        chest_ratio = p['chest_width'] / p['waist_width']
        self.assertGreaterEqual(shoulder_ratio, 1.55)
        self.assertLessEqual(shoulder_ratio, 1.85)
        self.assertGreaterEqual(chest_ratio, 1.35)
        self.assertLessEqual(chest_ratio, 1.65)

    def test_legs_are_not_thin_relative_to_waist(self):
        p = MALE_V4_PROFILE
        self.assertGreaterEqual(p['thigh_diameter'] / p['waist_width'], 0.72)
        self.assertGreaterEqual(p['calf_diameter'] / p['thigh_diameter'], 0.62)

    def test_shorts_are_short_enough_to_expose_quads(self):
        p = MALE_V4_PROFILE
        self.assertLessEqual(p['short_length'] / p['height'], 0.18)

    def test_profile_validates(self):
        validate_profile(MALE_V4_PROFILE)


if __name__ == '__main__':
    unittest.main()
