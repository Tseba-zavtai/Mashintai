const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('new QPay prices agree across client, edge, and reservation migration', () => {
  const client = fs.readFileSync('app/sponsor-payment.tsx', 'utf8');
  const edge = fs.readFileSync('supabase/functions/qpay-service/index.ts', 'utf8');
  const sql = fs.readFileSync('supabase/migrations/20261103000000_qpay_price_update.sql', 'utf8');
  for (const [plan, price] of Object.entries({credit:3200,credit2:5200,credit3:7200,bump:1200,daily:4000,weekly:20000,monthly:60000})) {
    assert.match(client, new RegExp('id: "' + plan + '".*price: ' + price + ','));
    assert.match(edge, new RegExp(plan + ': ' + price + '[, }]'));
    assert.ok(sql.includes("when '" + plan + "' then " + price));
  }
  assert.ok(sql.includes("grant execute"));
  assert.ok(sql.includes("reserved',false"));
});
