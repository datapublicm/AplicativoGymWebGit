import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecoveryUrl } from '../web/recovery-url.js';

test('No URL means no recovery email may be sent',()=>{
  assert.equal(resolveRecoveryUrl(''),null);
  assert.equal(resolveRecoveryUrl(undefined),null);
  assert.equal(resolveRecoveryUrl('not a url'),null);
});
test('Rejects HTTP, local Android return, credentials, query and fragment',()=>{
  for(const value of [
   'http://example.com/gymlog/',
   'https://localhost/',
   'https://127.0.0.1/',
   'https://test:secret@example.com/gymlog/',
   'https://gym.example.test/app/?next=https://other.example',
   'https://gym.example.test/app/#access_token=hidden'
  ])assert.equal(resolveRecoveryUrl(value),null,value);
});
test('Accepts fixed production-style HTTPS return only',()=>{
  assert.equal(resolveRecoveryUrl('https://gym.example.test/app/'),'https://gym.example.test/app/');
});
