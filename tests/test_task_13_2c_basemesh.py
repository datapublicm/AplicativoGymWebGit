from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.task_13_2c_prepare_basemesh import extract_body_group

class Task132CBasemeshTests(unittest.TestCase):
    def test_extract_body_group_preserves_only_body_geometry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "base.obj"
            source.write_text(
                "v 0 0 0\n"
                "v 1 0 0\n"
                "v 0 1 0\n"
                "v 0 0 1\n"
                "g body\n"
                "f 1 2 3\n"
                "g joint-head\n"
                "f 1 3 4\n",
                encoding="utf-8",
            )
            import tools.task_13_2c_prepare_basemesh as mod
            old_source, old_body = mod.SOURCE_OBJ, mod.BODY_OBJ
            try:
                mod.SOURCE_OBJ = source
                mod.BODY_OBJ = root / "body.obj"
                vertices, faces = extract_body_group()
            finally:
                mod.SOURCE_OBJ, mod.BODY_OBJ = old_source, old_body
            self.assertEqual(vertices, 3)
            self.assertEqual(faces, 1)
            text = (root / "body.obj").read_text(encoding="utf-8")
            self.assertIn("g body_hm08", text)
            self.assertNotIn("joint-head", text)

    def test_pinned_source_hash_is_fixed(self):
        from tools.task_13_2c_prepare_basemesh import EXPECTED_SHA256
        self.assertEqual(len(EXPECTED_SHA256), 64)
        int(EXPECTED_SHA256, 16)

if __name__ == "__main__":
    unittest.main()
