import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAGMENT_SHADER_SOURCE } from '../site/viewer/shaders.js';
import { BODY_COLOR, PRIMARY_MUSCLE_COLOR, SECONDARY_MUSCLE_COLOR, LIGHTING_PRESET } from '../site/viewer/visualStyle.js';

test('semi-realistic lighting shader uses key, fill, rim and specular terms', () => {
  assert.match(FRAGMENT_SHADER_SOURCE, /uKeyLightDirection/);
  assert.match(FRAGMENT_SHADER_SOURCE, /uFillLightDirection/);
  assert.match(FRAGMENT_SHADER_SOURCE, /specular/);
  assert.match(FRAGMENT_SHADER_SOURCE, /rim/);
});

test('visual palette keeps neutral anatomy with strong primary and secondary contrast', () => {
  assert.deepEqual(BODY_COLOR, [0.56, 0.58, 0.62, 1]);
  assert.deepEqual(PRIMARY_MUSCLE_COLOR, [0.96, 0.10, 0.06, 1]);
  assert.deepEqual(SECONDARY_MUSCLE_COLOR, [1.00, 0.46, 0.05, 1]);
  assert.equal(LIGHTING_PRESET.key.length, 3);
  assert.equal(LIGHTING_PRESET.fill.length, 3);
});
