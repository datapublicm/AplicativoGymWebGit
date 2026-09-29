import { ANATOMY_ZONES, getMuscleLabel } from './anatomy.js';

export const MUSCLE_IDS = ANATOMY_ZONES
  .filter((zone) => zone.active && zone.renderMeshId === zone.id)
  .map((zone) => zone.id);

export const MUSCLE_LABELS = Object.fromEntries(
  MUSCLE_IDS.map((id) => [id, getMuscleLabel(id)]),
);
