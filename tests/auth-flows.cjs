// Runs the actual Edge Function handlers against deterministic service doubles.
// No production identities, passwords or DAN requests are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

function load(name, state = {}) {
  const user = { id: 'user-1', email: 'u97699112233@example.com', user_metadata: {}, ...state.user };
  const profile = { id: user.id, terms_accepted_at: 'accepted', dan_onboarding_completed_at: null, phone: '+97699112233', ...state.profile };
  const writes = [];
  const admin = {
    async rpc(_name, body) {
      if (state.profileFailure || state.contactFailure) return { error: new Error('database unavailable') };
      profile.phone = body.p_phone;
      if (body.p_complete_signup) profile.dan_onboarding_completed_at = new Date().toISOString();
      writes.push({ kind: 'profile', ...body });
      return { error: null };
    },
    auth: {
      getUser: async token => ({ data: { user: token === 'valid' ? user : null }, error: null }),
      signInWithPassword: async body => ({ data: { user: body.email === user.email && body.password === 'secret123' ? user : null }, error: body.password === 'secret123' ? null : new Error('invalid') }),
      admin: { updateUserById: async (_id, update) => {
        writes.push({ kind: 'auth', ...update });
        if (state.duplicate && update.email !== 'u97699112233@example.com') return { error: new Error('email already registered') };
        Object.assign(user, update); return { error: null };
      }, createUser: async update => { writes.push({ kind: 'createUser', ...update }); Object.assign(user, update); return { data: { user }, error: null }; } },
    },
    from(table) {
      let update;
      const chain = {
        select() { return chain; }, eq() { return chain; }, is() { return chain; }, gt() { return chain; },
        update(value) { update = value; return chain; },
        async upsert(value, options) { writes.push({ kind: 'upsert', options, ...value }); Object.assign(profile, value); return { error: null }; },
        async insert(value) { writes.push({ kind: table, ...value }); return { error: state.contactFailure ? new Error('contact unavailable') : null }; },
        async maybeSingle() {
          if (table === 'dan_auth_states') return { data: state.expired ? null : { mode: state.mode ?? 'sign_up', terms_accepted_at: 'accepted', link_user_id: null }, error: null };
          if (table === 'dan_auth_handoffs') return { data: null, error: null };
          return { data: table === 'users' ? profile : table === 'dan_identities' ? (state.newIdentity ? null : { user_id: user.id }) : null, error: null };
        },
        async single() {
          if (state.profileFailure) return { error: new Error('profile unavailable') };
          if (update) { Object.assign(profile, update); writes.push({ kind: 'profile', ...update }); }
          return { data: profile, error: null };
        },
      };
      return chain;
    },
  };
  let handler;
  let source = fs.readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, {
    serve: fn => { handler = fn; }, adminClient: () => admin,
    getDanConfig: () => ({}), getAuthenticatedUserId: async req => req.headers.get('authorization') === 'Bearer valid' ? user.id : null,
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    corsHeaders: {}, Deno: { env: { get: () => 'test-only' } }, Response, URL, console: { error() {} }, Date,
    crypto: webcrypto, randomToken: () => 'handoff-for-test', sha256: async value => value, hmacSha256: async value => value,
    exchangeDanCode: async () => 'dan-token-test', getDanCitizen: async () => ({ registerNumber: 'synthetic-test', publicName: 'Test', verifiedName: 'Test' }),
    redirectToApp: body => new Response(JSON.stringify(body), { status: 302 }), appCallbackUrl: () => 'https://test.invalid',
  });
  return {
    user, profile, writes,
    async callback() { const result = await handler(new Request('https://test.invalid?code=test&state=test')); return { status: result.status, body: await result.json() }; },
    async call(body, token = 'valid') {
      const result = await handler(new Request('https://test.invalid', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return { status: result.status, body: await result.json() };
    },
  };
}

test('phone change: password required; no writes on rejection', async () => {
  const flow = load('change-login-phone');
  assert.equal((await flow.call({ phone: '88112233', currentPassword: 'wrong' })).status, 403);
  assert.equal(flow.writes.length, 0);
});
test('phone change: saved login identifier and profile agree; password unchanged', async () => {
  const flow = load('change-login-phone');
  assert.equal((await flow.call({ phone: '+97688112233', currentPassword: 'secret123' })).status, 200);
  assert.equal(flow.user.email, 'u97688112233@example.com');
  assert.equal(flow.profile.phone, '+97688112233');
  assert.equal(flow.writes[0].password, undefined);
});
test('phone change: duplicate number preserves old credentials', async () => {
  const flow = load('change-login-phone', { duplicate: true });
  assert.equal((await flow.call({ phone: '88112233', currentPassword: 'secret123' })).status, 409);
  assert.equal(flow.user.email, 'u97699112233@example.com');
});
test('phone change: failed profile save rolls login email back', async () => {
  const flow = load('change-login-phone', { profileFailure: true });
  assert.equal((await flow.call({ phone: '88112233', currentPassword: 'secret123' })).status, 500);
  assert.equal(flow.user.email, 'u97699112233@example.com');
});
for (const name of ['change-login-phone', 'dan-auth-finish-signup']) {
  test(`${name}: anonymous request rejected without writes`, async () => {
    const flow = load(name);
    assert.equal((await flow.call({ phone: '88112233', password: 'secret123', currentPassword: 'secret123' }, 'invalid')).status, 401);
    assert.equal(flow.writes.length, 0);
  });
  test(`${name}: malformed number rejected`, async () => {
    const flow = load(name);
    assert.equal((await flow.call({ phone: '123', password: 'secret123', currentPassword: 'secret123' })).status, 400);
    assert.equal(flow.writes.length, 0);
  });
}
test('DAN completion: missing consent blocks credentials', async () => {
  const flow = load('dan-auth-finish-signup', { profile: { terms_accepted_at: null } });
  assert.equal((await flow.call({ phone: '88112233', password: 'secret123' })).status, 422);
  assert.equal(flow.writes.length, 0);
});
test('DAN completion: credentials and completion marker saved', async () => {
  const flow = load('dan-auth-finish-signup');
  assert.equal((await flow.call({ phone: '88112233', password: 'secret123' })).status, 200);
  assert.equal(flow.user.email, 'u97688112233@example.com');
  assert.equal(flow.user.password, 'secret123');
  assert.equal(flow.profile.phone, '+97688112233');
  assert.ok(flow.profile.dan_onboarding_completed_at);
});
test('DAN completion: contact failure leaves signup resumable', async () => {
  const flow = load('dan-auth-finish-signup', { contactFailure: true });
  assert.equal((await flow.call({ phone: '88112233', password: 'secret123' })).status, 500);
  assert.equal(flow.profile.dan_onboarding_completed_at, null);
});
test('DAN completion: completed signup cannot overwrite password', async () => {
  const flow = load('dan-auth-finish-signup', { profile: { dan_onboarding_completed_at: 'done' } });
  assert.equal((await flow.call({ phone: '88112233', password: 'secret123' })).status, 409);
  assert.equal(flow.writes.length, 0);
});

test('DAN callback: new signup saves consent even when auth trigger created profile', async () => {
  const flow = load('dan-oauth-callback', { newIdentity: true, profile: { terms_accepted_at: null } });
  const result = await flow.callback();
  assert.ok(result.body.handoff);
  assert.equal(flow.profile.terms_accepted_at, 'accepted');
  assert.equal(flow.writes.find(item => item.kind === 'upsert').options.ignoreDuplicates, undefined);
});
test('DAN callback: incomplete signup resumes without creating another identity', async () => {
  const flow = load('dan-oauth-callback');
  assert.ok((await flow.callback()).body.handoff);
  assert.equal(flow.writes.some(item => item.kind === 'createUser'), false);
});
test('DAN callback: completed identity cannot register twice', async () => {
  const flow = load('dan-oauth-callback', { profile: { dan_onboarding_completed_at: 'done' } });
  assert.equal((await flow.callback()).body.error, 'identity_already_registered');
  assert.equal(flow.writes.length, 0);
});
test('DAN callback: expired state cannot create account', async () => {
  const flow = load('dan-oauth-callback', { expired: true, newIdentity: true });
  assert.equal((await flow.callback()).body.error, 'expired_or_invalid');
  assert.equal(flow.writes.length, 0);
});
test('auth listener: actual callback returns before server work (auth lock released)', async () => {
  const source = fs.readFileSync('contexts/AuthContext.tsx', 'utf8');
  const tree = ts.createSourceFile('AuthContext.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'supabase.auth.onAuthStateChange') callback = node.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const queued = [];
  let serverCalls = 0;
  const callbackJs = ts.transpileModule(`const listener = ${callback}; listener;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const listener = vm.runInNewContext(callbackJs, {
    setTimeout: fn => queued.push(fn), mountedRef: { current: true },
    fetchProfile: async () => { serverCalls++; }, touchLastActive: async () => {}, clearLocalAuthState: async () => {},
  });
  assert.equal(listener('SIGNED_IN', { user: { id: 'user-1', user_metadata: {} } }), undefined);
  assert.equal(serverCalls, 0);
  queued[0]();
  await new Promise(setImmediate);
  assert.equal(serverCalls, 1);
});

test('phone change: existing listings remain owned by the same account ID', () => {
  const source = fs.readFileSync('lib/jobOwnership.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports });
  assert.equal(exports.isJobOwnedBy({ postedBy: { id: 'user-1', phone: '+97699112233' } }, { id: 'user-1', phone: '+97688112233' }), true);
  assert.equal(exports.isJobOwnedBy({ postedBy: { id: 'other', phone: '+97688112233' } }, { id: 'user-1', phone: '+97688112233' }), false);
  assert.equal(exports.isJobOwnedBy({ posted_by_id: 'user-1' }, { id: 'user-1' }), true);
  assert.equal(exports.isJobOwnedBy({}, { id: 'user-1' }), false);
});
