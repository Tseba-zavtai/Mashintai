const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function verification(allowTest = false) {
  const exports = {};
  const source = fs.readFileSync('supabase/functions/store-purchases/verification.ts', 'utf8').replace(/^import .*\n/gm, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Deno: { env: { get: key => key === 'IAP_ALLOW_TEST_PURCHASES' ? String(allowTest) : undefined } } });
  return exports;
}
const apple = extra => ({ bundleId: 'mn.tureestei.app', transactionId: '123', productId: 'mn.tureestei.app.credit1',
  type: 'Consumable', quantity: 1, inAppOwnershipType: 'PURCHASED', environment: 'Production',
  appAccountToken: '00000000-0000-4000-8000-000000000001', purchaseDate: 1793300000000, ...extra });
const google = extra => ({ purchaseState: 0, quantity: 1, orderId: 'GPA.test', productId: 'mn.tureestei.app.credit1',
  obfuscatedExternalAccountId: 'user1', obfuscatedExternalProfileId: 'intent1', purchaseTimeMillis: '1793300000000', ...extra });
test('Apple verifies only the expected bundle, consumable, quantity, owner and non-revoked transaction', () => {
  const v = verification();
  assert.equal(v.validateApple(apple(), '123', 'Production').intentId, apple().appAccountToken);
  for (const extra of [{ bundleId: 'foreign.app' }, { transactionId: 'other' }, { productId: '__proto__' }, { quantity: 2 },
    { revocationDate: 1 }, { type: 'Auto-Renewable Subscription' }, { inAppOwnershipType: 'FAMILY_SHARED' },
    { environment: 'Sandbox' }, { appAccountToken: null }, { purchaseDate: undefined }])
    assert.throws(() => v.validateApple(apple(extra), '123', 'Production'));
});
test('Google rejects pending, canceled, wrong-account, unknown-SKU and multi-quantity purchases', () => {
  const v = verification();
  assert.equal(v.validateGoogle(google(), google().productId, 'user1').intentId, 'intent1');
  for (const extra of [{ purchaseState: 1 }, { purchaseState: 2 }, { quantity: 2 }, { obfuscatedExternalAccountId: 'other' },
    { obfuscatedExternalProfileId: null }, { productId: 'foreign.sku' }, { orderId: null }, { purchaseTimeMillis: 'invalid' }, { purchaseType: 1 }])
    assert.throws(() => v.validateGoogle(google(extra), google().productId, 'user1'));
});
test('sandbox/test purchases are denied by default and require an explicit server flag', () => {
  assert.throws(() => verification().validateApple(apple({ environment: 'Sandbox' }), '123', 'Sandbox'));
  assert.throws(() => verification().validateGoogle(google({ purchaseType: 0 }), google().productId, 'user1'));
  assert.equal(verification(true).validateApple(apple({ environment: 'Sandbox' }), '123', 'Sandbox').environment, 'Sandbox');
  assert.equal(verification(true).validateGoogle(google({ purchaseType: 0 }), google().productId, 'user1').environment, 'Sandbox');
});

test('Apple test-only verification does not depend on production API access', () => {
  const source = fs.readFileSync('supabase/functions/store-purchases/verification.ts', 'utf8');
  assert.match(source, /if \(sandboxOnly && !allowTest\(\)\) throw/);
  assert.match(source, /sandboxOnly \? \[Environment\.SANDBOX\]/);
  const handler = fs.readFileSync('supabase/functions/store-purchases/index.ts', 'utf8');
  assert.match(handler, /verifyApple\(body\.transactionId, testOnly\)/);
});
test('client and server use exactly the same seven product IDs', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/storeProducts.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  assert.deepEqual(Array.from(exports.STORE_PRODUCT_IDS).sort(), Object.keys(verification().PRODUCT_PLANS).sort());
  assert.equal(exports.storePlanForProduct('unknown'), undefined);
  assert.equal(exports.STORE_PRODUCTS.bump.id, 'mn.tureestei.app.Pump');
  assert.equal(exports.STORE_PRODUCTS.weekly.id, 'mn.tureestei.app.sponsor2');
  assert.equal(exports.STORE_PRODUCTS.weekly.days, 7);
  assert.equal(exports.STORE_PRODUCTS.monthly.id, 'mn.tureestei.app.sponsor3');
  assert.equal(exports.STORE_PRODUCTS.monthly.days, 30);
  assert.equal(exports.storeProductId('bump', 'ios'), 'mn.tureestei.app.Pump');
  assert.equal(exports.storeProductId('bump', 'android'), 'mn.tureestei.app.bump');
  assert.equal(exports.storePlanForProduct('mn.tureestei.app.bump', 'android'), 'bump');
  assert.equal(exports.storePlanForProduct('mn.tureestei.app.Pump', 'android'), undefined);
  for (const oldId of ['bump', 'sponsor7', 'sponsor30']) {
    assert.equal(exports.storePlanForProduct(`mn.tureestei.app.${oldId}`), undefined);
  }
});

function endpoint({ enabled = true, user = 'u1', valid = true, dbError = null, testOnly = false, testers = '', platforms = 'ios', environment = 'Production' } = {}) {
  const calls = [], verifications = [];
  let handler;
  const source = fs.readFileSync('supabase/functions/store-purchases/index.ts', 'utf8').replace(/^import .*\n/gm, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    Deno: { env: { get: key => ({ STORE_PURCHASES_ENABLED:String(enabled), STORE_TEST_MODE_ENABLED:String(testOnly), STORE_TEST_USER_IDS:testers, STORE_TEST_PLATFORMS:platforms })[key] ?? '' }, serve: fn => handler = fn },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
      rpc: async (name, args) => { calls.push({ name, args }); return { data: name === 'prepare_store_purchase' ? 'intent' : {}, error: dbError }; } }),
    PRODUCT_PLANS: verification().PRODUCT_PLANS, isStoreProduct: verification().isStoreProduct, required: () => 'test',
    verifyApple: async id => { verifications.push(id); if (!valid) throw new Error('INVALID_PURCHASE');
      return { intentId: '00000000-0000-4000-8000-000000000001', productId: 'mn.tureestei.app.credit1', transactionId: id, environment, purchasedAt: new Date().toISOString() }; },
    verifyGoogle: async () => { throw new Error('INVALID_PURCHASE'); }, Response, URL,
  });
  return { calls, verifications, async call(body) {
    const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  } };
}
const request = { action: 'verify', platform: 'ios', productId: 'mn.tureestei.app.credit1', transactionId: '123' };
test('iOS-only test mode blocks Android and an empty platform list before any grant', async()=>{
  for (const options of [{platforms:'ios', platform:'android'},{platforms:'',platform:'ios'}]) {
    const uid='00000000-0000-4000-8000-000000000001';
    const h=endpoint({enabled:false,testOnly:true,user:uid,testers:uid,platforms:options.platforms});
    const result=await h.call({...request,platform:options.platform});
    assert.equal(result.status,403); assert.equal(result.body.error,'TEST_PLATFORM_DISABLED');
    assert.equal(h.calls.length,0); assert.equal(h.verifications.length,0);
  }
});
test('test-only mode requires an explicit account allowlist and rejects real receipts',async()=>{
  const uid='00000000-0000-4000-8000-000000000001';
  for(const options of [{testers:''},{testers:uid,user:'other'},{testers:uid,user:uid,environment:'Production'}]) {
    const h=endpoint({enabled:false,testOnly:true,...options});
    assert.equal((await h.call(request)).status,403); assert.equal(h.calls.length,0);
  }
  const h=endpoint({enabled:false,testOnly:true,testers:uid,user:uid,environment:'Sandbox'});
  assert.equal((await h.call(request)).body.granted,true);
});
test('disabled, unauthenticated and invalid transactions cannot call the grant RPC', async () => {
  for (const options of [{ enabled: false }, { user: null }, { valid: false }]) {
    const h = endpoint(options); assert.notEqual((await h.call(request)).status, 200); assert.equal(h.calls.length, 0);
  }
});
test('verified store binding is used instead of client user/listing/intent fields', async () => {
  const h = endpoint(); const result = await h.call({ ...request, userId: 'attacker', intentId: 'attacker', jobId: 'attacker', amount: 0 });
  assert.equal(result.body.granted, true);
  assert.equal(h.calls[0].args.p_user_id, 'u1');
  assert.equal(h.calls[0].args.p_intent_id, '00000000-0000-4000-8000-000000000001');
  assert.equal(h.calls[0].args.p_job_id, undefined);
});
test('a database error is not acknowledged as successful', async () => {
  const h = endpoint({ dbError: { message: 'PURCHASE_ALREADY_USED' } });
  const result = await h.call(request); assert.equal(result.status, 400); assert.equal(result.body.error, 'PURCHASE_ALREADY_USED');
});

test('client never finishes/consumes an unverified transaction, and surfaces finish failures for retry', async () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/completeStorePurchase.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const calls = [];
  const complete = exports.completeStorePurchase;
  await assert.rejects(complete({}, async () => { throw new Error('network'); }, async () => calls.push('finish')));
  await assert.rejects(complete({}, async () => ({ granted: false }), async () => calls.push('finish')));
  assert.deepEqual(calls, []);
  await complete({}, async () => { calls.push('verify'); return { granted: true }; }, async () => calls.push('finish'));
  assert.deepEqual(calls, ['verify', 'finish']);
  await assert.rejects(complete({}, async () => ({ granted: true }), async () => { throw new Error('finish interrupted'); }));
});

test('dual-payment variant explicitly offers QPay after store checkout and can be removed with a static switch', () => {
  const route = fs.readFileSync('app/sponsor-payment.tsx', 'utf8');
  assert.match(route, /NATIVE_QPAY_ENABLED && qpayPlan/);
  assert.match(route, /onChooseQPay=\{NATIVE_QPAY_ENABLED \? plan =>/);
  assert.match(route, /initialPlan=\{qpayPlan\}/);
  assert.match(route, /disabled=\{isSubmitting \|\| !!pendingPayment \|\| !!invoice\}/);
  const screen = fs.readFileSync('components/StorePaymentScreen.tsx', 'utf8');
  assert.doesNotMatch(screen, /callQPay|Linking\.openURL/);
  assert.ok(screen.indexOf("'Google Play'}-ээр төлөх") < screen.indexOf('QPay Mongolia'));
  assert.match(route, /initialPlan=\{qpayPlan\} directCheckout/);
  assert.match(route, /!directCheckout \|\| !restored/);
  assert.match(route, /step === "info" && !directCheckout/);
  assert.doesNotMatch(screen, /үнийг дараагийн алхамд/);
  assert.match(screen, /store\.prices\[productId\]/);
  assert.match(screen, /ids\.length === 1/);
  const provider = fs.readFileSync('contexts/StorePurchaseContext.tsx', 'utf8');
  assert.match(provider, /getPendingTransactionsIOS/);
  assert.match(provider, /andDangerouslyFinishTransactionAutomatically: false/);
  assert.match(provider, /obfuscatedProfileId: intentId/);
  assert.match(provider, /appAccountToken: intentId/);
});
