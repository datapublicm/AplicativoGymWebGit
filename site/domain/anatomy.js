const renderableZones = [
  ['pectoralis', 'Pectoral'],
  ['deltoid_anterior', 'Deltoides anterior'],
  ['deltoid_lateral', 'Deltoides lateral'],
  ['deltoid_posterior', 'Deltoides posterior'],
  ['biceps', 'Bíceps'],
  ['triceps', 'Tríceps'],
  ['forearm', 'Antebrazo'],
  ['abdominals', 'Abdominales'],
  ['obliques', 'Oblicuos'],
  ['latissimus', 'Dorsal ancho'],
  ['trapezius', 'Trapecio'],
  ['erector_spinae', 'Erectores espinales'],
  ['gluteals', 'Glúteos'],
  ['quadriceps', 'Cuádriceps'],
  ['hamstrings', 'Isquiotibiales'],
  ['adductors', 'Aductores'],
  ['abductors', 'Abductores / glúteo medio'],
  ['calves', 'Gemelos / sóleo'],
].map(([id, nameEs]) => ({
  id,
  nameEs,
  parentId: null,
  zoneType: 'muscle',
  renderMeshId: id,
  active: true,
}));

const subzones = [
  ['pectoralis_clavicular', 'Pectoral · porción clavicular', 'pectoralis', 'portion'],
  ['pectoralis_sternal', 'Pectoral · porción esternal', 'pectoralis', 'portion'],
  ['triceps_long_head', 'Tríceps · cabeza larga', 'triceps', 'head'],
  ['triceps_lateral_head', 'Tríceps · cabeza lateral', 'triceps', 'head'],
  ['triceps_medial_head', 'Tríceps · cabeza medial', 'triceps', 'head'],
  ['rectus_femoris', 'Cuádriceps · recto femoral', 'quadriceps', 'muscle'],
  ['vastus_lateralis', 'Cuádriceps · vasto lateral', 'quadriceps', 'muscle'],
  ['vastus_medialis', 'Cuádriceps · vasto medial', 'quadriceps', 'muscle'],
  ['vastus_intermedius', 'Cuádriceps · vasto intermedio', 'quadriceps', 'muscle'],
  ['gastrocnemius', 'Pantorrilla · gastrocnemio', 'calves', 'muscle'],
  ['soleus', 'Pantorrilla · sóleo', 'calves', 'muscle'],
].map(([id, nameEs, parentId, zoneType]) => ({
  id,
  nameEs,
  parentId,
  zoneType,
  renderMeshId: null,
  active: true,
}));

export const ANATOMY_ZONES = Object.freeze([...renderableZones, ...subzones]);

const ZONES_BY_ID = new Map(ANATOMY_ZONES.map((zone) => [zone.id, zone]));

export function getAnatomyZone(id) {
  return ZONES_BY_ID.get(id);
}

export function getMuscleLabel(id) {
  return getAnatomyZone(id)?.nameEs;
}

function resolveRenderableId(id) {
  const visited = new Set();
  let zone = getAnatomyZone(id);

  while (zone && !visited.has(zone.id)) {
    visited.add(zone.id);
    if (zone.renderMeshId) return zone.renderMeshId;
    zone = zone.parentId ? getAnatomyZone(zone.parentId) : undefined;
  }

  return undefined;
}

export function resolveRenderableMuscles(ids) {
  const resolved = [];
  const unresolved = [];

  for (const id of ids) {
    const renderableId = resolveRenderableId(id);
    if (!renderableId) {
      if (!unresolved.includes(id)) unresolved.push(id);
      continue;
    }
    if (!resolved.includes(renderableId)) resolved.push(renderableId);
  }

  return { ids: resolved, unresolved };
}
