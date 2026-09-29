from __future__ import annotations

from pathlib import Path
import hashlib
import trimesh

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / 'site' / 'models'
MUSCLE_IDS = {
    'pectoralis', 'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior',
    'biceps', 'triceps', 'forearm', 'abdominals', 'obliques', 'latissimus',
    'trapezius', 'erector_spinae', 'gluteals', 'quadriceps', 'hamstrings',
    'adductors', 'abductors', 'calves',
}
MODELS = {
    'male': MODEL_DIR / 'human-muscle-male-v05.glb',
    'female': MODEL_DIR / 'human-muscle-female-v05.glb',
}


def muscle_nodes(scene: trimesh.Scene) -> set[str]:
    return {
        name.removeprefix('muscle__')
        for name in scene.graph.nodes_geometry
        if name.startswith('muscle__')
    }


def verify_one(variant: str, path: Path) -> tuple[set[str], str]:
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f'{variant} GLB missing or empty: {path}')
    loaded = trimesh.load(path, force='scene')
    if not isinstance(loaded, trimesh.Scene):
        raise RuntimeError(f'{variant} did not load as a scene')
    nodes = set(loaded.graph.nodes_geometry)
    body_name = f'body__{variant}'
    if body_name not in nodes:
        raise RuntimeError(f'{variant} missing body node {body_name}')
    muscles = muscle_nodes(loaded)
    if muscles != MUSCLE_IDS:
        missing = sorted(MUSCLE_IDS - muscles)
        extra = sorted(muscles - MUSCLE_IDS)
        raise RuntimeError(
            f'{variant} muscle contract mismatch: missing={missing}, extra={extra}'
        )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return muscles, digest


def body_geometry_digest(path: Path, variant: str) -> str:
    scene = trimesh.load(path, force='scene')
    transform, geometry_name = scene.graph.get(f'body__{variant}')
    if geometry_name is None:
        raise RuntimeError(f'{variant} body geometry missing')
    vertices = trimesh.transform_points(scene.geometry[geometry_name].vertices, transform)
    return hashlib.sha256(vertices.astype('float64').tobytes()).hexdigest()


def verify_pair(male_path: Path, female_path: Path) -> None:
    male_contract, _ = verify_one('male', male_path)
    female_contract, _ = verify_one('female', female_path)
    if male_contract != female_contract:
        raise RuntimeError('male/female muscle contracts differ')
    if body_geometry_digest(male_path, 'male') == body_geometry_digest(female_path, 'female'):
        raise RuntimeError('male/female body geometry is not distinct')


def main():
    verify_pair(MODELS['male'], MODELS['female'])
    for variant, path in MODELS.items():
        muscles, _ = verify_one(variant, path)
        print(f'{variant}: {path.stat().st_size} bytes, {len(muscles)} muscle nodes')
    print('contract OK; male/female body geometry is distinct')


if __name__ == '__main__':
    main()
