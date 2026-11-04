const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('components/StorePaymentScreen.tsx', 'utf8');
test('checkout keeps recovery but removes confusing repeated warnings', () => {
  for (const text of ['Автоматаар сунгах захиалга биш', 'Эцсийн үнэ дэлгүүрийн', 'Ашиглагдсан зарын эрхийг дахин олгохгүй']) assert.ok(!source.includes(text));
  assert.ok(source.includes('await store.recover()'));
  assert.ok(source.includes('await store.buy('));
  assert.ok(source.includes('onChooseQPay(selected)'));
  assert.ok(source.includes('showPurchaseHelp &&'));
  assert.ok(source.includes('Таны сонголт'));
  assert.ok(source.includes('Дахин төлөх шаардлагагүй.'));
});
