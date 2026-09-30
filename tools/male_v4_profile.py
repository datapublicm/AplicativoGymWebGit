from __future__ import annotations

MALE_V4_PROFILE = {
    'height': 2.04,
    'shoulder_width': 0.70,
    'chest_width': 0.58,
    'waist_width': 0.39,
    'pelvis_width': 0.43,
    'upper_arm_diameter': 0.155,
    'forearm_diameter': 0.120,
    'thigh_diameter': 0.300,
    'calf_diameter': 0.200,
    'short_length': 0.30,
    'foot_y': -0.98,
    'ankle_y': -0.87,
    'calf_y': -0.66,
    'knee_y': -0.37,
    'thigh_y': -0.11,
    'hip_y': 0.18,
    'waist_y': 0.40,
    'chest_y': 0.63,
    'shoulder_y': 0.79,
    'neck_y': 0.91,
    'head_y': 1.04,
    'chest_depth': 0.215,
    'waist_depth': 0.155,
    'pelvis_depth': 0.180,
    'head_width': 0.185,
    'head_depth': 0.205,
    'head_height': 0.245,
    'shoulder_x': 0.345,
    'elbow_x': 0.455,
    'wrist_x': 0.505,
    'elbow_y': 0.47,
    'wrist_y': 0.16,
    'hip_x': 0.155,
    'knee_x': 0.150,
    'ankle_x': 0.145,
    'deltoid_radius': 0.145,
    'pec_width_each': 0.205,
    'pec_height': 0.145,
    'pec_depth': 0.095,
    'lat_width': 0.335,
    'glute_width_each': 0.185,
    'glute_depth': 0.105,
    'quad_depth': 0.080,
    'calf_depth': 0.082,
    'short_waist_y': 0.37,
    'short_hem_y': 0.07,
}


def validate_profile(profile: dict) -> None:
    required = {
        'height', 'shoulder_width', 'chest_width', 'waist_width',
        'pelvis_width', 'upper_arm_diameter', 'forearm_diameter',
        'thigh_diameter', 'calf_diameter', 'short_length',
    }
    missing = required.difference(profile)
    if missing:
        raise ValueError(f'missing male v4 profile keys: {sorted(missing)}')
    for key in required:
        if float(profile[key]) <= 0:
            raise ValueError(f'{key} must be positive')

    shoulder_ratio = profile['shoulder_width'] / profile['waist_width']
    chest_ratio = profile['chest_width'] / profile['waist_width']
    thigh_ratio = profile['thigh_diameter'] / profile['waist_width']
    calf_ratio = profile['calf_diameter'] / profile['thigh_diameter']
    short_ratio = profile['short_length'] / profile['height']

    if not 1.55 <= shoulder_ratio <= 1.85:
        raise ValueError('shoulder/waist ratio outside approved athletic range')
    if not 1.35 <= chest_ratio <= 1.65:
        raise ValueError('chest/waist ratio outside approved range')
    if thigh_ratio < 0.72:
        raise ValueError('thigh mass too low for approved silhouette')
    if calf_ratio < 0.62:
        raise ValueError('calf mass too low for approved silhouette')
    if short_ratio > 0.18:
        raise ValueError('shorts too long for approved quad exposure')


validate_profile(MALE_V4_PROFILE)
