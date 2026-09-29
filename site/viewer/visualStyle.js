export const BODY_COLOR = [0.62, 0.65, 0.70, 1];
export const INACTIVE_MUSCLE_COLOR = [...BODY_COLOR];
export const PRIMARY_MUSCLE_COLOR = [0.98, 0.16, 0.08, 1];
export const SECONDARY_MUSCLE_COLOR = [1.00, 0.58, 0.08, 1];
export function cameraDistanceForAspect(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0)
        return 10;
    if (aspect >= 0.9)
        return 10;
    const portraitFactor = Math.min(1, Math.max(0, (0.9 - aspect) / 0.45));
    return 10 + portraitFactor * 2.4;
}
