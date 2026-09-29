export const BODY_COLOR = [0.56, 0.58, 0.62, 1];
export const INACTIVE_MUSCLE_COLOR = [...BODY_COLOR];
export const PRIMARY_MUSCLE_COLOR = [0.96, 0.10, 0.06, 1];
export const SECONDARY_MUSCLE_COLOR = [1.00, 0.46, 0.05, 1];
export const LIGHTING_PRESET = Object.freeze({
    key: [0.42, 0.78, 0.62],
    fill: [-0.58, 0.26, 0.76],
    ambient: 0.30,
    keyStrength: 0.58,
    fillStrength: 0.18,
    rimStrength: 0.10,
    specularStrength: 0.16,
});
export function cameraDistanceForAspect(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0)
        return 10;
    if (aspect >= 0.9)
        return 10;
    const portraitFactor = Math.min(1, Math.max(0, (0.9 - aspect) / 0.45));
    return 10 + portraitFactor * 2.4;
}
