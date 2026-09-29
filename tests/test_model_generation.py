from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np

from tools.makehuman_targets import apply_target_deltas, blend_targets, parse_target


class MakeHumanTargetTests(unittest.TestCase):
    def write_target(self, directory: Path, name: str, body: str) -> Path:
        path = directory / name
        path.write_text(body, encoding='utf-8')
        return path

    def test_parse_and_apply_changes_only_named_vertex(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self.write_target(
                root,
                'one.target',
                '# comment\n2 0.5 -0.25 1.0\n',
            )
            parsed = parse_target(target)
            self.assertEqual(set(parsed), {2})
            np.testing.assert_allclose(parsed[2], np.array([0.5, -0.25, 1.0]))

            vertices = np.zeros((4, 3), dtype=np.float64)
            deltas = np.zeros_like(vertices)
            deltas[2] = parsed[2]
            result = apply_target_deltas(vertices, deltas)

            np.testing.assert_allclose(result[0], [0.0, 0.0, 0.0])
            np.testing.assert_allclose(result[1], [0.0, 0.0, 0.0])
            np.testing.assert_allclose(result[2], [0.5, -0.25, 1.0])
            np.testing.assert_allclose(result[3], [0.0, 0.0, 0.0])
            np.testing.assert_allclose(vertices, np.zeros((4, 3)))

    def test_blend_targets_uses_equal_one_third_weight(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            paths = [
                self.write_target(root, 'a.target', '1 3 0 0\n'),
                self.write_target(root, 'b.target', '1 0 6 0\n'),
                self.write_target(root, 'c.target', '1 0 0 9\n'),
            ]
            blended = blend_targets(paths, vertex_count=3)
            np.testing.assert_allclose(blended[0], [0.0, 0.0, 0.0])
            np.testing.assert_allclose(blended[1], [1.0, 2.0, 3.0])
            np.testing.assert_allclose(blended[2], [0.0, 0.0, 0.0])

    def test_blend_targets_rejects_out_of_range_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self.write_target(root, 'bad.target', '4 1 2 3\n')
            with self.assertRaisesRegex(ValueError, 'out of range'):
                blend_targets([target], vertex_count=4)


class VariantGenerationTests(unittest.TestCase):
    def test_variant_catalog_uses_six_distinct_official_target_names(self):
        from tools.generate_model import VARIANTS

        male = VARIANTS['male']['targets']
        female = VARIANTS['female']['targets']
        self.assertEqual(len(male), 3)
        self.assertEqual(len(female), 3)
        self.assertEqual(len(set(male + female)), 6)
        self.assertTrue(all(name.endswith('-young.target') for name in male + female))

    def test_fitness_adjustment_changes_width_but_not_height_or_depth(self):
        from tools.generate_model import apply_fitness_adjustment

        vertices = np.array([
            [1.0, 4.0, 0.5],
            [1.0, 2.0, 0.5],
            [1.0, 0.0, 0.5],
            [1.0, -2.0, 0.5],
        ], dtype=np.float64)
        male = apply_fitness_adjustment(vertices, 'male')
        female = apply_fitness_adjustment(vertices, 'female')

        np.testing.assert_allclose(male[:, 1:], vertices[:, 1:])
        np.testing.assert_allclose(female[:, 1:], vertices[:, 1:])
        self.assertGreater(male[0, 0], vertices[0, 0])
        self.assertLess(male[1, 0], vertices[1, 0])
        self.assertLess(female[1, 0], vertices[1, 0])
        self.assertGreater(female[2, 0], vertices[2, 0])
        self.assertGreater(female[3, 0], vertices[3, 0])


if __name__ == '__main__':
    unittest.main()
