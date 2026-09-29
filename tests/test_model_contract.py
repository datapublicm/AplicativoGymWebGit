from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import trimesh

from tools.verify_model_contract import MUSCLE_IDS, verify_one, verify_pair


def write_scene(path: Path, variant: str, omit: str | None = None) -> None:
    scene = trimesh.Scene()
    triangle = trimesh.Trimesh(
        vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
        faces=[[0, 1, 2]],
        process=False,
    )
    body_name = f'body__{variant}'
    scene.add_geometry(triangle.copy(), node_name=body_name, geom_name=body_name)
    for muscle_id in sorted(MUSCLE_IDS):
        if muscle_id == omit:
            continue
        name = f'muscle__{muscle_id}'
        scene.add_geometry(triangle.copy(), node_name=name, geom_name=name)
    path.write_bytes(scene.export(file_type='glb'))


class ContractVerificationTests(unittest.TestCase):
    def test_valid_scene_accepts_all_18_muscle_nodes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'male.glb'
            write_scene(path, 'male')
            muscles, digest = verify_one('male', path)
            self.assertEqual(muscles, MUSCLE_IDS)
            self.assertEqual(len(digest), 64)

    def test_missing_muscle_node_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'female.glb'
            write_scene(path, 'female', omit='quadriceps')
            with self.assertRaisesRegex(RuntimeError, 'contract mismatch'):
                verify_one('female', path)


class PairVerificationTests(unittest.TestCase):
    def test_pair_rejects_same_body_geometry_even_with_different_variant_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            male = root / 'male.glb'
            female = root / 'female.glb'
            write_scene(male, 'male')
            write_scene(female, 'female')
            with self.assertRaisesRegex(RuntimeError, 'geometry is not distinct'):
                verify_pair(male, female)


if __name__ == '__main__':
    unittest.main()
