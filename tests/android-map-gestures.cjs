const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('Android map WebView retains drag gestures inside the scrolling listing form', () => {
  const source = fs.readFileSync('components/OpenStreetMap.tsx', 'utf8');
  const tree = ts.createSourceFile('OpenStreetMap.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let enabled = false;
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === 'WebView') {
      enabled = node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(tree) === 'nestedScrollEnabled' && !prop.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(enabled);
  const native = fs.readFileSync('node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java', 'utf8');
  assert.match(native, /if \(this.nestedScrollEnabled\)\s*\{\s*requestDisallowInterceptTouchEvent\(true\)/);
});

test('listing map remains inline and iOS retains its native Apple map', () => {
  const post = fs.readFileSync('app/(tabs)/post.tsx', 'utf8');
  assert.doesNotMatch(post, /locationModalVisible|draftLocation|Том дэлгэцээр/);
  assert.match(post, /mapContainer: \{ height: 300/);
  assert.match(post, /<MapView style=\{styles.map\} initialRegion=\{initialRegion\} onPress=\{handleMapPress\}/);
  const map = fs.readFileSync('components/AppMap.tsx', 'utf8');
  assert.match(map, /Platform.OS === "android" \? require\("\.\/OpenStreetMap"\)/);
  assert.match(map, /Platform.OS === "ios" \? require\("react-native-maps"\)/);
});
