const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

function endpoint({ enabled = true, valid = true, persistError = false } = {}) {
  let handler; const saved = [];
  const source = fs.readFileSync('supabase/functions/store-refunds/index.ts','utf8').replace(/^import .*\n/gm,'');
  class Verifier {
    async verifyAndDecodeNotification() {
      if (!valid) throw Error('bad signature');
      return { notificationUUID: 'event1', notificationType: 'REFUND', signedDate: Date.now(), data: { signedTransactionInfo: 'signed' } };
    }
    async verifyAndDecodeTransaction() { return { bundleId: 'mn.tureestei.app', transactionId: '123', environment: 'Production' }; }
  }
  vm.runInNewContext(ts.transpileModule(source,{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    Deno: { serve: fn => handler=fn, env: { get: name => name==='STORE_REFUNDS_ENABLED' ? String(enabled) : 'false' } },
    required: name => name==='APPLE_IAP_ROOT_CERTS_BASE64' ? '["dGVzdA=="]' : name==='APPLE_IAP_APP_ID' ? '6777877910' : 'secret',
    createClient: () => ({ from: () => ({ upsert: async row => { saved.push(row); return { error: persistError ? {} : null }; },
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id:'event1' }, error:null }) }) }) }) }),
      rpc: async () => ({ error:null }) }),
    SignedDataVerifier: Verifier, Environment: { PRODUCTION: 'Production', SANDBOX: 'Sandbox' }, Buffer,
    BUNDLE_ID: 'mn.tureestei.app', Response, URL, TextEncoder, crypto: webcrypto,
  });
  return { saved, call: async (source='apple', secret='wrong') => handler(new Request(`https://test.invalid?source=${source}`, {
    method:'POST', headers:{'x-refunds-secret':secret}, body:JSON.stringify({ signedPayload:'signed' }),
  })) };
}
test('refund endpoint fails closed when disabled, unsigned or cron authentication is wrong', async () => {
  assert.equal((await endpoint({enabled:false}).call()).status,503);
  const invalid=endpoint({valid:false}); assert.equal((await invalid.call()).status,400); assert.equal(invalid.saved.length,0);
  const cron=endpoint(); assert.equal((await cron.call('google')).status,401); assert.equal(cron.saved.length,0);
});
test('verified Apple event is persisted; database failure requests retry instead of acknowledging', async () => {
  const good=endpoint(); assert.equal((await good.call()).status,200); assert.equal(good.saved[0].transaction_id,'123');
  assert.equal((await endpoint({persistError:true}).call()).status,503);
});
test('refund inbox is durable, idempotent and inaccessible to app users',async () => {
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
    await db.exec(fs.readFileSync('supabase/migrations/20261102000000_store_refund_inbox.sql','utf8'));
    const sql="insert into store_refund_events(platform,event_id,transaction_id,environment,event_type,occurred_at) values('ios','event1','123','Production','REFUND',now()) on conflict(platform,event_id) do nothing";
    await db.exec(sql); await db.exec(sql);
    assert.equal((await db.query('select count(*)::int n from store_refund_events')).rows[0].n,1);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from store_refund_events'));
      await assert.rejects(db.exec(sql));
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
