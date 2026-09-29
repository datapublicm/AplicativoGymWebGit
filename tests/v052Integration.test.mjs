import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('site/index.html', 'utf8');
const main = fs.readFileSync('site/main.js', 'utf8');
const app = fs.readFileSync('site/app/App.js', 'utf8');
const createViewer = fs.readFileSync('site/viewer/createViewer.js', 'utf8');
const controller = fs.readFileSync('site/viewer/ViewerController.js', 'utf8');
const highlighter = fs.readFileSync('site/viewer/highlightMuscles.js', 'utf8');
const loader = fs.readFileSync('site/viewer/loadHumanModel.js', 'utf8');

test('v0.5.2 entry assets are cache-busted', () => {
  assert.match(index, /styles\.css\?v=0\.5\.2/);
  assert.match(index, /main\.js\?v=0\.5\.2/);
});

test('v0.5.2 module chain is cache-busted and visible', () => {
  assert.match(main, /App\.js\?v=0\.5\.2/);
  assert.match(main, /bodyVariants\.js\?v=0\.5\.2/);
  assert.match(app, /createViewer\.js\?v=0\.5\.2/);
  assert.match(app, /switchModel\.js\?v=0\.5\.2/);
  assert.match(app, /v0\.5\.2/);
  assert.match(createViewer, /ViewerController\.js\?v=0\.5\.2/);
  assert.match(createViewer, /loadHumanModel\.js\?v=0\.5\.2/);
  assert.match(controller, /shaders\.js\?v=0\.5\.2/);
  assert.match(controller, /visualStyle\.js\?v=0\.5\.2/);
  assert.match(highlighter, /visualStyle\.js\?v=0\.5\.2/);
  assert.match(loader, /visualStyle\.js\?v=0\.5\.2/);
});
