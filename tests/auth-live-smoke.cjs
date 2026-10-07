// Read-only production endpoint checks: no sessions, identities or signup data.
const assert = require('node:assert/strict');
const base = 'https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/';
(async () => {
  for (const name of ['change-login-phone', 'dan-auth-finish-signup']) {
    const result = await fetch(base + name, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000) });
    assert.equal(result.status, 401, `${name}: unauthenticated request must be rejected`);
    console.log(`PASS ${name}: anonymous request rejected`);
  }
  const result = await fetch(base + 'dan-oauth-callback', { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert.equal(result.status, 302);
  assert.match(result.headers.get('location'), /^tureesly:\/\/dan-callback\?.*error=/);
  console.log('PASS DAN callback: missing state safely rejected');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
