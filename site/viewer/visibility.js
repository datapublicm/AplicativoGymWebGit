import { muscleIdFromMeshName } from './muscleRegistry.js';
export const AUTO_ROTATE_THRESHOLD = 0.55;
const FRONT = new Set([
    'pectoralis', 'deltoid_anterior', 'biceps', 'forearm', 'abdominals', 'obliques',
    'quadriceps', 'adductors',
]);
const BACK = new Set([
    'deltoid_posterior', 'triceps', 'latissimus', 'trapezius', 'erector_spinae',
    'gluteals', 'hamstrings', 'calves',
]);
const SIDE = new Set(['deltoid_lateral', 'abductors']);
function wrap(angle) {
    let value = angle % (Math.PI * 2);
    if (value > Math.PI)
        value -= Math.PI * 2;
    if (value < -Math.PI)
        value += Math.PI * 2;
    return value;
}
function scoreForAngle(yaw, facing) {
    return Math.max(0, Math.min(1, (Math.cos(wrap(yaw - facing)) + 1) / 2));
}
export function getMuscleVisibility(id, view) {
    if (BACK.has(id))
        return scoreForAngle(view.yaw, Math.PI);
    if (SIDE.has(id))
        return Math.max(scoreForAngle(view.yaw, Math.PI / 2), scoreForAngle(view.yaw, -Math.PI / 2));
    if (FRONT.has(id))
        return scoreForAngle(view.yaw, 0);
    return 0.5;
}
export function getTargetVisibility(meshes, view) {
    const ids = [];
    for (const mesh of meshes) {
        const id = muscleIdFromMeshName(mesh.name);
        if (id && !ids.includes(id))
            ids.push(id);
    }
    if (!ids.length)
        return 0;
    return ids.reduce((sum, id) => sum + getMuscleVisibility(id, view), 0) / ids.length;
}
export function shouldAutoRotate(visibility, threshold = AUTO_ROTATE_THRESHOLD) {
    return visibility < threshold;
}
