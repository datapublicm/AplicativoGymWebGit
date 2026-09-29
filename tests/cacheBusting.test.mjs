import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('entry document versions css and main module', () => {
  const html = read('site/index.html');
  assert.match(html, /styles\.css\?v=0\.5\.2/);
  assert.match(html, /main\.js\?v=0\.5\.2/);
});

test('main and app version changed modules that must not come from old cache', () => {
  const main = read('site/main.js');
  const app = read('site/app/App.js');
  const viewer = read('site/viewer/createViewer.js');
  assert.match(main, /App\.js\?v=0\.5\.2/);
  assert.match(main, /bodyVariants\.js\?v=0\.5\.2/);
  assert.match(app, /bodyVariants\.js\?v=0\.5\.2/);
  assert.match(app, /bodyVariantSelection\.js\?v=0\.5\.2/);
  assert.match(app, /bodyVariantSelector\.js\?v=0\.5\.2/);
  assert.match(app, /createViewer\.js\?v=0\.5\.2/);
  assert.match(app, /switchModel\.js\?v=0\.5\.2/);
  assert.match(viewer, /ViewerController\.js\?v=0\.5\.2/);
});

test('header exposes a visible v0.5.2 marker for deployment verification', () => {
  assert.match(read('site/app/App.js'), /class="app-version">v0\.5\.2</);
});
