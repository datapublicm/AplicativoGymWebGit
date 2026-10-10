import { resolveRenderableMuscles } from '../domain/anatomy.js';

export function resolveExerciseMuscleTargets(exercise) {
  const primaryResult = resolveRenderableMuscles(exercise.primary ?? []);
  const secondaryResult = resolveRenderableMuscles(exercise.secondary ?? []);
  const unresolved = [];

  for (const id of [...primaryResult.unresolved, ...secondaryResult.unresolved]) {
    if (!unresolved.includes(id)) unresolved.push(id);
  }

  return {
    primary: primaryResult.ids,
    secondary: secondaryResult.ids,
    unresolved,
  };
}
