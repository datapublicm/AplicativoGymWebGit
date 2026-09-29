from __future__ import annotations

from pathlib import Path

import numpy as np


def parse_target(path: Path) -> dict[int, np.ndarray]:
    deltas: dict[int, np.ndarray] = {}
    with path.open('r', encoding='utf-8') as handle:
        for line_number, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split()
            if len(parts) != 4:
                raise ValueError(f'{path}:{line_number}: expected index dx dy dz')
            index = int(parts[0])
            deltas[index] = np.asarray([float(parts[1]), float(parts[2]), float(parts[3])], dtype=np.float64)
    return deltas


def blend_targets(paths: list[Path], vertex_count: int) -> np.ndarray:
    if vertex_count < 0:
        raise ValueError('vertex_count must be non-negative')
    if not paths:
        return np.zeros((vertex_count, 3), dtype=np.float64)

    blended = np.zeros((vertex_count, 3), dtype=np.float64)
    weight = 1.0 / len(paths)
    for path in paths:
        for index, delta in parse_target(path).items():
            if index < 0 or index >= vertex_count:
                raise ValueError(f'target index {index} out of range for {vertex_count} vertices: {path}')
            blended[index] += delta * weight
    return blended


def apply_target_deltas(vertices: np.ndarray, deltas: np.ndarray) -> np.ndarray:
    if vertices.shape != deltas.shape:
        raise ValueError(f'vertices/deltas shape mismatch: {vertices.shape} != {deltas.shape}')
    return np.asarray(vertices, dtype=np.float64) + np.asarray(deltas, dtype=np.float64)
