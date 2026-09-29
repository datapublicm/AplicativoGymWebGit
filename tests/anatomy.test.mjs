import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANATOMY_ZONES,
  getAnatomyZone,
  getMuscleLabel,
  resolveRenderableMuscles,
} from '../site/domain/anatomy.js';
import { MUSCLE_IDS, MUSCLE_LABELS } from '../site/domain/muscles.js';

test('subzone falls back to its nearest renderable ancestor', () => {
  assert.deepEqual(
    resolveRenderableMuscles(['vastus_medialis']),
    { ids: ['quadriceps'], unresolved: [] },
  );
});

test('already renderable zone stays unchanged', () => {
  assert.deepEqual(
    resolveRenderableMuscles(['deltoid_lateral']),
    { ids: ['deltoid_lateral'], unresolved: [] },
  );
});

test('unknown anatomical id remains unresolved', () => {
  assert.deepEqual(
    resolveRenderableMuscles(['zona_inexistente']),
    { ids: [], unresolved: ['zona_inexistente'] },
  );
});

test('subzones expose human-readable labels', () => {
  assert.equal(getMuscleLabel('triceps_long_head'), 'Tríceps · cabeza larga');
});

test('compatibility layer keeps exactly 18 renderable muscle ids', () => {
  assert.equal(MUSCLE_IDS.length, 18);
  assert.equal(new Set(MUSCLE_IDS).size, 18);
  assert.equal(MUSCLE_LABELS.quadriceps, 'Cuádriceps');
});

test('anatomy exposes active nodes and lookup by id', () => {
  assert.ok(Array.isArray(ANATOMY_ZONES));
  assert.equal(getAnatomyZone('vastus_medialis')?.parentId, 'quadriceps');
  assert.equal(getAnatomyZone('quadriceps')?.renderMeshId, 'quadriceps');
});

test('fallback results are deduplicated while preserving first occurrence', () => {
  assert.deepEqual(
    resolveRenderableMuscles(['vastus_medialis', 'vastus_lateralis', 'quadriceps']),
    { ids: ['quadriceps'], unresolved: [] },
  );
});
