import unittest
from pathlib import Path
class Tests(unittest.TestCase):
    def test_v5_has_no_implicit_or_marching_cubes_dependency(self):
        root=Path(__file__).resolve().parents[1]
        forbidden=('implicit_body','marching_cubes','skimage.measure')
        for p in list((root/'tools'/'v5').glob('*.py'))+[root/'tools'/'generate_male_v5.py']:
            text=p.read_text(encoding='utf-8')
            for item in forbidden:self.assertNotIn(item,text,p.name)
    def test_generator_cli_imports_from_repo_root(self):
        import subprocess,sys
        root=Path(__file__).resolve().parents[1]
        cp=subprocess.run([sys.executable,'tools/generate_male_v5.py','--help'],cwd=root,capture_output=True,text=True)
        self.assertEqual(cp.returncode,0,cp.stderr)
if __name__=='__main__':unittest.main()
