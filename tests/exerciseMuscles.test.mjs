import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveExerciseMuscleTargets } from '../site/viewer/exerciseMuscles.js';

test('primary subzone falls back to renderable parent', () => {
  assert.deepEqual(
    resolveExerciseMuscleTargets({
      primary: ['vastus_medialis'],
      secondary: [],
    }),
    { primary: ['quadriceps'], secondary: [], unresolved: [] },
  );
});

test('fallback ids are deduplicated within each role', () => {
  assert.deepEqual(
    resolveExerciseMuscleTargets({
      primary: ['vastus_medialis', 'vastus_lateralis'],
      secondary: ['triceps_long_head', 'triceps_lateral_head'],
    }),
    { primary: ['quadriceps'], secondary: ['triceps'], unresolved: [] },
  );
});

test('unknown ids remain unresolved without guessing', () => {
  assert.deepEqual(
    resolveExerciseMuscleTargets({
      primary: ['zona_inexistente'],
      secondary: ['otra_zona_inexistente'],
    }),
    {
      primary: [],
      secondary: [],
      unresolved: ['zona_inexistente', 'otra_zona_inexistente'],
    },
  );
});

test('unresolved ids are deduplicated across primary and secondary roles', () => {
  assert.deepEqual(
    resolveExerciseMuscleTargets({
      primary: ['zona_inexistente'],
      secondary: ['zona_inexistente'],
    }),
    { primary: [], secondary: [], unresolved: ['zona_inexistente'] },
  );
});
