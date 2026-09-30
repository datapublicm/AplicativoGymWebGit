from __future__ import annotations

import numpy as np


def ellipsoid_field(points: np.ndarray, center, radii) -> np.ndarray:
    points = np.asarray(points, dtype=np.float64)
    center = np.asarray(center, dtype=np.float64)
    radii = np.asarray(radii, dtype=np.float64)
    if np.any(radii <= 0):
        raise ValueError('ellipsoid radii must be positive')
    q = (points - center) / radii
    return 1.0 - np.linalg.norm(q, axis=-1)


def capsule_field(points: np.ndarray, a, b, radius: float) -> np.ndarray:
    points = np.asarray(points, dtype=np.float64)
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    if radius <= 0:
        raise ValueError('capsule radius must be positive')
    ab = b - a
    denom = float(np.dot(ab, ab))
    if denom <= 1e-12:
        dist = np.linalg.norm(points - a, axis=-1)
    else:
        t = np.clip(((points - a) @ ab) / denom, 0.0, 1.0)
        nearest = a + t[..., None] * ab
        dist = np.linalg.norm(points - nearest, axis=-1)
    return 1.0 - dist / radius


def smooth_union(fields: list[np.ndarray], softness: float = 28.0) -> np.ndarray:
    if not fields:
        raise ValueError('smooth_union requires at least one field')
    if softness <= 0:
        raise ValueError('softness must be positive')
    stack = np.stack(fields, axis=0).astype(np.float64, copy=False)
    m = np.max(stack, axis=0)
    return m + np.log(np.sum(np.exp((stack - m) * softness), axis=0)) / softness


def _sym_ellipsoids(fields, points, x, y, z, rx, ry, rz):
    for side in (-1.0, 1.0):
        fields.append(ellipsoid_field(points, (side * x, y, z), (rx, ry, rz)))


def _sym_capsules(fields, points, a, b, radius):
    for side in (-1.0, 1.0):
        aa = (side * a[0], a[1], a[2])
        bb = (side * b[0], b[1], b[2])
        fields.append(capsule_field(points, aa, bb, radius))


def male_body_field(points: np.ndarray, profile: dict) -> np.ndarray:
    p = profile
    pts = np.asarray(points, dtype=np.float64)
    fields: list[np.ndarray] = []

    fields.append(ellipsoid_field(pts, (0.0, p['head_y'], 0.0),
                                  (p['head_width']/2.0, p['head_height']/2.0, p['head_depth']/2.0)))
    fields.append(capsule_field(pts, (0.0, 0.84, 0.0), (0.0, p['neck_y'] + 0.05, 0.0), 0.105))
    fields.append(ellipsoid_field(pts, (0.0, 0.80, -0.015), (0.31, 0.13, 0.13)))
    fields.append(ellipsoid_field(pts, (0.0, 0.68, -0.005), (p['chest_width']/2.0, 0.235, p['chest_depth'])))
    fields.append(ellipsoid_field(pts, (0.0, 0.55, -0.025), (0.285, 0.250, 0.185)))
    fields.append(ellipsoid_field(pts, (0.0, p['waist_y'], 0.0), (p['waist_width']/2.0, 0.205, p['waist_depth'])))
    fields.append(ellipsoid_field(pts, (0.0, 0.28, 0.0), (0.205, 0.205, 0.155)))
    fields.append(ellipsoid_field(pts, (0.0, p['hip_y'], -0.015), (p['pelvis_width']/2.0, 0.190, p['pelvis_depth'])))
    _sym_ellipsoids(fields, pts, 0.135, 0.675, 0.155, p['pec_width_each'], p['pec_height'], p['pec_depth'])
    _sym_ellipsoids(fields, pts, 0.235, 0.57, -0.105, 0.165, 0.245, 0.115)
    _sym_ellipsoids(fields, pts, p['shoulder_x'], p['shoulder_y'], 0.0,
                    p['deltoid_radius']*1.05, p['deltoid_radius']*0.92, p['deltoid_radius'])
    _sym_capsules(fields, pts, (p['shoulder_x'], p['shoulder_y']-0.015, 0.0),
                  (p['elbow_x'], p['elbow_y'], 0.0), p['upper_arm_diameter']/2.0)
    _sym_ellipsoids(fields, pts, 0.405, 0.595, 0.040, 0.105, 0.190, 0.095)
    _sym_ellipsoids(fields, pts, 0.410, 0.580, -0.045, 0.100, 0.205, 0.100)
    _sym_capsules(fields, pts, (p['elbow_x'], p['elbow_y']+0.015, 0.0),
                  (p['wrist_x'], p['wrist_y'], 0.0), p['forearm_diameter']/2.0)
    _sym_ellipsoids(fields, pts, p['wrist_x']+0.005, p['wrist_y']-0.065, 0.02, 0.070, 0.095, 0.050)
    _sym_ellipsoids(fields, pts, p['hip_x'], 0.16, -0.125,
                    p['glute_width_each'], 0.185, p['glute_depth'])
    _sym_capsules(fields, pts, (p['hip_x'], 0.19, -0.005),
                  (p['knee_x'], p['knee_y'], 0.0), p['thigh_diameter']/2.0)
    _sym_ellipsoids(fields, pts, p['hip_x'], -0.11, 0.085, 0.150, 0.285, p['quad_depth'])
    _sym_ellipsoids(fields, pts, p['hip_x'], -0.13, -0.075, 0.145, 0.275, 0.075)
    _sym_ellipsoids(fields, pts, p['knee_x'], p['knee_y'], 0.0, 0.118, 0.105, 0.105)
    _sym_capsules(fields, pts, (p['knee_x'], p['knee_y']-0.02, 0.0),
                  (p['ankle_x'], p['ankle_y'], 0.0), 0.078)
    _sym_ellipsoids(fields, pts, p['ankle_x'], p['calf_y'], -0.025,
                    p['calf_diameter']/2.0, 0.205, p['calf_depth'])
    _sym_ellipsoids(fields, pts, p['ankle_x'], p['ankle_y'], 0.0, 0.072, 0.080, 0.065)
    _sym_ellipsoids(fields, pts, p['ankle_x'], p['foot_y']+0.005, 0.075, 0.082, 0.060, 0.175)
    return smooth_union(fields, softness=30.0)
