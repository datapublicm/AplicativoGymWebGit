import test from 'node:test';
import assert from 'node:assert/strict';

import { ViewerController } from '../site/viewer/ViewerController.js';
import { switchViewerModel } from '../site/viewer/switchModel.js';
import { PRIMARY_MUSCLE_COLOR } from '../site/viewer/visualStyle.js';

function mesh(name) {
  const baseColor = [0.62, 0.65, 0.70, 1];
  return { name, baseColor, color: [...baseColor] };
}

test('replaceModel preserves camera and exercise, rebuilds registry, highlights without auto-rotation', () => {
  let oldDisposed = 0;
  let cancelCalls = 0;
  const oldModel = { meshes: [mesh('muscle__pectoralis')], dispose: () => { oldDisposed += 1; } };
  const quad = mesh('muscle__quadriceps');
  const newModel = { meshes: [quad], dispose() {} };
  const controller = Object.create(ViewerController.prototype);
  controller.model = oldModel;
  controller.registry = new Map([['pectoralis', oldModel.meshes]]);
  controller.state = { yaw: 1.2, pitch: -0.2, distance: 11.5 };
  controller.currentExercise = { primary: ['vastus_medialis'], secondary: [], preferredView: 'front' };
  controller.rotationAbort = undefined;
  controller.cancelAutoRotation = () => { cancelCalls += 1; };
  const before = { ...controller.state };

  controller.replaceModel(newModel);

  assert.equal(oldDisposed, 1);
  assert.equal(cancelCalls, 1);
  assert.deepEqual(controller.state, before);
  assert.equal(controller.model, newModel);
  assert.deepEqual(controller.registry.get('quadriceps'), [quad]);
  assert.deepEqual(quad.color, [...PRIMARY_MUSCLE_COLOR]);
  assert.equal(controller.currentExercise.primary[0], 'vastus_medialis');
});

test('switchViewerModel leaves previous model intact when loading fails', async () => {
  const oldModel = { meshes: [], dispose() {} };
  const viewer = { gl: {}, model: oldModel, replaceModel() { throw new Error('must not replace'); } };
  await assert.rejects(
    switchViewerModel(viewer, './broken.glb', async () => { throw new Error('load failed'); }),
    /load failed/,
  );
  assert.equal(viewer.model, oldModel);
});

test('selectExercise remembers the current exercise for later model replacement', async () => {
  const controller = Object.create(ViewerController.prototype);
  controller.registry = new Map();
  controller.state = { yaw: 0, pitch: 0, distance: 10 };
  controller.cancelAutoRotation = () => {};
  const exercise = { primary: [], secondary: [], preferredView: 'front' };
  await controller.selectExercise(exercise);
  assert.equal(controller.currentExercise, exercise);
});
