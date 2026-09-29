import { MUSCLE_IDS } from '../domain/muscles.js';
const VALID_IDS = new Set(MUSCLE_IDS);
export function muscleIdFromMeshName(name) {
    if (!name.startsWith('muscle__'))
        return undefined;
    const id = name.slice('muscle__'.length).split('__', 1)[0];
    return VALID_IDS.has(id) ? id : undefined;
}
export function buildMuscleRegistry(meshes) {
    const registry = new Map();
    for (const mesh of meshes) {
        const id = muscleIdFromMeshName(mesh.name);
        if (!id)
            continue;
        const list = registry.get(id) ?? [];
        list.push(mesh);
        registry.set(id, list);
    }
    return registry;
}
