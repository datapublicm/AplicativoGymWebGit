import test from 'node:test';
import assert from 'node:assert/strict';

import { BODY_VARIANTS, DEFAULT_BODY_VARIANT, getBodyVariant } from '../site/domain/bodyVariants.js';

test('catalog exposes exactly male and female variants with distinct model URLs', () => {
  assert.deepEqual(Object.keys(BODY_VARIANTS), ['male', 'female']);
  assert.equal(BODY_VARIANTS.male.label, 'Hombre');
  assert.equal(BODY_VARIANTS.female.label, 'Mujer');
  assert.notEqual(BODY_VARIANTS.male.modelUrl, BODY_VARIANTS.female.modelUrl);
  assert.equal(DEFAULT_BODY_VARIANT, 'male');
});

test('unknown body variant is rejected', () => {
  assert.throws(() => getBodyVariant('robot'), /Unknown body variant/);
});
