import test from 'node:test';
import assert from 'node:assert/strict';

import { requestBodyVariantChange } from '../site/domain/bodyVariantSelection.js';

test('selecting the current body variant does not invoke loader', async () => {
  let calls = 0;
  const result = await requestBodyVariantChange('male', 'male', async () => { calls += 1; });
  assert.equal(result, 'male');
  assert.equal(calls, 0);
});

test('successful male to female transition invokes loader once and returns female', async () => {
  const calls = [];
  const result = await requestBodyVariantChange('male', 'female', async (id) => { calls.push(id); });
  assert.equal(result, 'female');
  assert.deepEqual(calls, ['female']);
});

test('rejected loader keeps the previous effective body variant', async () => {
  let calls = 0;
  const result = await requestBodyVariantChange('male', 'female', async () => {
    calls += 1;
    throw new Error('load failed');
  });
  assert.equal(result, 'male');
  assert.equal(calls, 1);
});
