export const BODY_VARIANTS = Object.freeze({
  male: Object.freeze({
    id: 'male',
    label: 'Hombre',
    modelUrl: './models/human-muscle-male-v05.glb',
  }),
  female: Object.freeze({
    id: 'female',
    label: 'Mujer',
    modelUrl: './models/human-muscle-female-v05.glb',
  }),
});

export const DEFAULT_BODY_VARIANT = 'male';

export function getBodyVariant(id) {
  const variant = BODY_VARIANTS[id];
  if (!variant) throw new Error(`Unknown body variant: ${id}`);
  return variant;
}
