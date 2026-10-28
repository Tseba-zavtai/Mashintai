const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

test('Android branding generates inset adaptive icons, idempotently', async () => {
  let callback;
  const source = await fs.readFile('plugins/with-android-branding.js','utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => name === 'expo/config-plugins'
    ? { withFinalizedMod: (config, [platform, mod]) => { assert.equal(platform,'android'); callback=mod; return config; } }
    : require(name) });
  module.exports({});
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'tureesly-branding-test-'));
  const config = { modRequest: { platformProjectRoot: root } };
  await callback(config);
  await callback(config);
  const res = path.join(root,'app/src/main/res');
  const foreground = await fs.readFile(path.join(res,'drawable/tureesly_launcher_foreground.xml'),'utf8');
  assert.match(foreground,/android:inset="12%"/);
  assert.match(foreground,/@mipmap\/ic_launcher_foreground/);
  for(const icon of ['ic_launcher','ic_launcher_round']) {
    const xml = await fs.readFile(path.join(res,`mipmap-anydpi-v26/${icon}.xml`),'utf8');
    assert.match(xml,/@drawable\/tureesly_launcher_foreground/);
  }
});
test('Android uses a compact mark while iOS retains its existing splash', () => {
  const config = require('../app.json').expo;
  const splash = config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')[1];
  assert.equal(splash.image,'./assets/logos/Logo-dark.png');
  assert.equal(splash.imageWidth,300);
  assert.equal(splash.android.image,'./assets/images/icon.png');
  assert.equal(splash.android.imageWidth,96);
  assert.equal(config.android.adaptiveIcon.backgroundColor,'#7409B7');
});
