const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/similarListings.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject });
const similar = exportsObject.getSimilarListings;
const current = { id: 'current', category_id: 'tools', subcategory_id: 'drills', price: 100, price_type: 'daily', location: { latitude: 47.9, longitude: 106.9 } };
const item = (id, extra = {}) => ({ ...current, id, ...extra });
const ids = rows => Array.from(rows, row => row.id);

test('new visitors get contextual results with no history; self and unrelated category excluded', () => {
  assert.deepEqual(ids(similar(current, [current, item('alternative'), item('unrelated', { category_id: 'cars' })])), ['alternative']);
});
test('inactive, hidden, deleted, expired and unavailable listings are excluded', () => {
  const rows = [item('inactive', { isActive: false }), item('hidden', { is_hidden: true }), item('deleted', { is_deleted: true }), item('expired', { listing_expires_at: '2020-01-01' }), item('empty', { available_quantity: 0 }), item('valid')];
  assert.deepEqual(ids(similar(current, rows)), ['valid']);
});
test('same subcategory ranks ahead of broader category even with closer price', () => {
  assert.deepEqual(ids(similar(current, [item('broad', { subcategory_id: 'saws' }), item('exact', { price: 1000 })])), ['exact', 'broad']);
});
test('nearby and comparable prices rank higher within a subcategory', () => {
  const rows = [item('far', { location: { latitude: 40, longitude: 90 } }), item('expensive', { price: 1000 }), item('best')];
  assert.equal(similar(current, rows)[0].id, 'best');
});
test('duplicate IDs, other post types and result limit are handled', () => {
  assert.deepEqual(ids(similar(current, [item('a'), item('a'), item('worker', { postType: 'worker' }), item('b'), item('c')], 2)), ['a', 'b']);
});
test('missing category and no similar inventory return empty, without mutating input', () => {
  const rows = [item('a')];
  const snapshot = JSON.stringify(rows);
  assert.equal(similar(undefined, rows).length, 0);
  assert.equal(similar({ id: 'unknown' }, rows).length, 0);
  similar(current, rows);
  assert.equal(JSON.stringify(rows), snapshot);
});
