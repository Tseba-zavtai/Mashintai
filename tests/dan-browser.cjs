const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(os) {
  let options;
  const exports = {};
  const modules = {
    'expo-linking': {},
    'react-native': { Platform: { OS: os } },
    'expo-web-browser': { openAuthSessionAsync: async (url, callback, params) => {
      assert.equal(url, 'https://sso.gov.mn/synthetic');
      assert.equal(callback, 'tureesly://dan-callback');
      options = params;
      return { type: 'cancel' };
    } },
    '@/lib/supabase': { supabase: { functions: { invoke: async () => ({ data: { authorize_url: 'https://sso.gov.mn/synthetic' }, error: null }) } } },
  };
  const source = fs.readFileSync('lib/danAuth.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { exports, require: name => modules[name] });
  return { run: () => exports.authenticateWithDan('sign_up'), options: () => options };
}

test('Android DAN browser survives SMS switching: a visible retained browser task', async () => {
  const flow = load('android');
  await assert.rejects(flow.run(), /цуцлагдсан/);
  assert.deepEqual(JSON.parse(JSON.stringify(flow.options())), { createTask: true, showInRecents: true });
  // Verify why this option matters against the installed native implementation.
  const native = fs.readFileSync('node_modules/expo-web-browser/android/src/main/java/expo/modules/webbrowser/WebBrowserModule.kt', 'utf8');
  assert.match(native, /if \(!options.showInRecents\)\s*\{[^}]*FLAG_ACTIVITY_NO_HISTORY/s);
});

test('iOS DAN browser retains its existing native auth-session options', async () => {
  const flow = load('ios');
  await assert.rejects(flow.run(), /цуцлагдсан/);
  assert.equal(flow.options(), undefined);
});
