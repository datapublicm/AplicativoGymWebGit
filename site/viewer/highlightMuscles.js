import { PRIMARY_MUSCLE_COLOR, SECONDARY_MUSCLE_COLOR } from './visualStyle.js';
export function applyMuscleHighlight(registry, primary, secondary) {
    for (const meshes of registry.values()) {
        for (const mesh of meshes)
            mesh.color = [...mesh.baseColor];
    }
    const missing = [];
    const apply = (ids, color) => {
        for (const id of ids) {
            const meshes = registry.get(id);
            if (!meshes?.length) {
                if (!missing.includes(id))
                    missing.push(id);
                continue;
            }
            for (const mesh of meshes)
                mesh.color = [...color];
        }
    };
    apply(secondary, SECONDARY_MUSCLE_COLOR);
    apply(primary, PRIMARY_MUSCLE_COLOR);
    return { missing };
}
