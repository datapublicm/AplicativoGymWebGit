import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const env = read('.env.example');
const auth = read('web/auth-cloud.js');
const shared = read('src/shared/contrato-gymlytics.js');

test('Gymlytics usa exclusivamente el esquema y backend de Pruebas configurados', () => {
  assert.match(env, /^VITE_SUPABASE_URL=https:\/\/jasuqnxrskhqfobsazwd\.supabase\.co$/m);
  assert.match(env, /^VITE_SUPABASE_SCHEMA=sch_android_gymlytics$/m);
  assert.match(env, /^VITE_GYMLYTICS_ENVIRONMENT=pruebas$/m);
  assert.match(auth, /client\?\.schema\(config\.schema\)/);
  assert.match(shared, /GYMLYTICS_SCHEMA = 'sch_android_gymlytics'/);
  assert.doesNotMatch(env, /^VITE_\w*(?:SERVICE_ROLE|SECRET)\w*=/mi);
  assert.doesNotMatch(auth, /sb_secret_[A-Za-z0-9]+/);
});

test('Login de correo y usuario conservan el control de acceso por perfil', () => {
  assert.match(auth, /client\.auth\.signInWithPassword\(/);
  assert.match(auth, /client\.functions\.invoke\('gymlytics-login-usuario'/);
  assert.doesNotMatch(auth, /client\.functions\.invoke\('gymlog-login-usuario'/);
  assert.match(auth, /await updateState\(session\)/);
  assert.match(auth, /assertGymlyticsAccess\(user\)/);
  assert.match(auth, /if\(!owns\(\)\)throw new Error\('Se autenticó la identidad/);
});

test('Renombrado: paquete, identificador, manifest y RPC mantienen Gymlytics', () => {
  const packageJson = JSON.parse(read('package.json'));
  const capacitor = JSON.parse(read('capacitor.config.json'));
  const manifest = JSON.parse(read('web/manifest.webmanifest'));
  assert.equal(packageJson.name, 'gymlytics');
  assert.equal(capacitor.appId, 'com.datapublicm.gymlytics');
  assert.equal(capacitor.appName, 'Gymlytics');
  assert.equal(manifest.name, 'Gymlytics');
  assert.match(auth, /db\.rpc\('guardar_entrenamiento'/);
  // Los nombres históricos de Storage son excepciones documentadas; no renombrar sin políticas.
  assert.match(shared, /userPhotos:'gymlog-usuarios'/);
  assert.match(shared, /sharedAnatomy:'gymlog-anatomia'/);
});

test('El CI de la rama Android ejecuta solo pruebas y nunca compila la APK', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/validar-android-gymlytics.yml', root), 'utf8');
  assert.match(workflow, /branches: \[Android-Gymlytics\]/);
  assert.match(workflow, /npm run test:static/);
  assert.doesNotMatch(workflow, /npx cap|gradlew|assembleDebug|assembleRelease|npm run build:web/);
  for (const folder of ['android/app/', 'dist/', 'node_modules/']) {
    assert.equal(fs.existsSync(new URL(folder, root)), false, folder);
  }
});
