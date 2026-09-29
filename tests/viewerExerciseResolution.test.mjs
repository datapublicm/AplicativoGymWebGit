import test from 'node:test';
import assert from 'node:assert/strict';

import { ViewerController } from '../site/viewer/ViewerController.js';
import { PRIMARY_MUSCLE_COLOR } from '../site/viewer/visualStyle.js';

test('viewer resolves a hierarchical primary target before highlight and visibility', async () => {
  const mesh = {
    name: 'muscle__quadriceps',
    baseColor: [0.62, 0.65, 0.70, 1],
    color: [0.62, 0.65, 0.70, 1],
  };
  const controller = Object.create(ViewerController.prototype);
  controller.registry = new Map([['quadriceps', [mesh]]]);
  controller.state = { yaw: 0, pitch: 0, distance: 10 };
  controller.rotationAbort = undefined;
  controller.cancelAutoRotation = () => {};

  const result = await controller.selectExercise({
    primary: ['vastus_medialis'],
    secondary: [],
    preferredView: 'front',
  });

  assert.deepEqual(result, { rotated: false, missing: [] });
  assert.deepEqual(mesh.color, [...PRIMARY_MUSCLE_COLOR]);
});
