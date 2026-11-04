const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/listingFormFields.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const fields = exportsObject.getListingFormFields;
const schema = [{ name: 'size', label: 'Размер', type: 'dropdown', options: ['S','M','L','XL'] },
  { name: 'brand', label: 'Брэнд', type: 'text' }];
test('shoes and dress shoes use EU 36–44, preserving the existing storage key', () => {
  for (const sub of ['Гутал', 'Гоёлын туфль', 'Эмэгтэй пүүз', 'Shoes']) {
    const result = fields(schema, 'Хувцас, хэрэглэл', sub);
    assert.equal(result[0].name, 'size'); assert.equal(result[0].allowCustomSize, true);
    assert.deepEqual(Array.from(result[0].options), ['36','37','38','39','40','41','42','43','44']);
    assert.equal(result[1].name, 'brand');
  }
});
test('clothing retains letter sizes and permits a custom size', () => {
  const result = fields(schema, 'Хувцас, хэрэглэл', 'Үндэсний хувцас');
  assert.deepEqual(Array.from(result[0].options), ['S','M','L','XL']);
  assert.equal(result[0].allowCustomSize, true);
});
test('shoe-only categories and empty schemas get a size field', () => {
  const result = fields([], 'Гутал', 'Эрэгтэй');
  assert.equal(result.length, 1); assert.equal(result[0].name, 'Размер');
  assert.equal(result[0].allowCustomSize, true);
});
test('unrelated dimensions and shared schema objects are not changed', () => {
  const snapshot = JSON.stringify(schema);
  assert.equal(fields(schema, 'Багаж', 'Өрөм')[0].allowCustomSize, undefined);
  fields(schema, 'Хувцас', 'Гутал'); assert.equal(JSON.stringify(schema), snapshot);
});
test('size input is unrestricted text for half-sizes and values outside the quick list', () => {
  const source = fs.readFileSync('app/(tabs)/post.tsx', 'utf8');
  assert.match(source, /Размер сонгох эсвэл өөрөө бичих/);
  assert.match(source, /\[field\.name\]: value/);
});
