import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Environment, SignedDataVerifier } from 'npm:@apple/app-store-server-library@2.0.0';
import { Buffer } from 'node:buffer';
import { BUNDLE_ID, checkStoreCredentials, googleAccessToken, required } from '../store-purchases/verification.ts';

// Apple authenticates through JWS; Google polling is operator/cron-only, never a client action.
// This durable inbox does NOT silently deduct spent credits or unrelated QPay benefits.
Deno.serve(async req => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
  const source = new URL(req.url).searchParams.get('source');
  if (source !== 'readiness' && Deno.env.get('STORE_REFUNDS_ENABLED') !== 'true') return reply(503, { error: 'NOT_CONFIGURED' });
  try {
    if (source === 'readiness') {
      const expected = required('STORE_REFUNDS_CRON_SECRET');
      const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
      const [a,b] = await Promise.all([digest(req.headers.get('x-refunds-secret') ?? ''),digest(expected)]);
      let mismatch=0; for(let n=0;n<a.length;n++) mismatch |= a[n]^b[n];
      if(mismatch!==0) return reply(401,{error:'UNAUTHORIZED'});
      return reply(200, { ...await checkStoreCredentials(),
        realPaymentsEnabled:Deno.env.get('STORE_PURCHASES_ENABLED')==='true',
        testModeEnabled:Deno.env.get('STORE_TEST_MODE_ENABLED')==='true' });
    }
    const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const save = async (row: Record<string, unknown>) => {
      // Ignore duplicates without overwriting an operator's resolution.
      const { error } = await db.from('store_refund_events').upsert(row, {
        onConflict: 'platform,event_id', ignoreDuplicates: true,
      });
      if (error) throw new Error('PERSIST_FAILED');
      const { data: event, error: lookupError } = await db.from('store_refund_events').select('id')
        .eq('platform',row.platform).eq('event_id',row.event_id).single();
      if (lookupError || !event) throw new Error('PERSIST_FAILED');
      const { error: reconcileError } = await db.rpc('reconcile_store_refund', { p_event_id: event.id });
      if (reconcileError) throw new Error('RECONCILE_FAILED');
    };
    if (source === 'apple') {
      const raw = await req.text();
      if (raw.length > 100000) return reply(413, { error: 'TOO_LARGE' });
      const body = JSON.parse(raw);
      if (typeof body.signedPayload !== 'string') return reply(400, { error: 'INVALID_PAYLOAD' });
      const roots: string[] = JSON.parse(required('APPLE_IAP_ROOT_CERTS_BASE64'));
      if (!Array.isArray(roots) || roots.length === 0) throw new Error('NOT_CONFIGURED');
      const appId = Number(required('APPLE_IAP_APP_ID'));
      if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error('NOT_CONFIGURED');
      let event;
      let verifier: SignedDataVerifier | undefined;
      for (const env of [Environment.PRODUCTION, ...(Deno.env.get('IAP_ALLOW_TEST_PURCHASES') === 'true' ? [Environment.SANDBOX] : [])]) {
        const candidate = new SignedDataVerifier(roots.map(root => Buffer.from(root, 'base64')), true, env, BUNDLE_ID, appId);
        try { event = await candidate.verifyAndDecodeNotification(body.signedPayload); verifier = candidate; break; }
        catch { /* Never decode unverified payloads to choose an environment. */ }
      }
      if (!event || !verifier || !event.notificationUUID) return reply(400, { error: 'INVALID_SIGNATURE' });
      if (event.notificationType === 'TEST') return reply(200, { received: true });
      if (!['REFUND','REVOKE','REFUND_REVERSED'].includes(event.notificationType ?? '')) return reply(200, { received: true });
      if (!event.data?.signedTransactionInfo) return reply(400, { error: 'MISSING_TRANSACTION' });
      const transaction = await verifier.verifyAndDecodeTransaction(event.data.signedTransactionInfo);
      if (transaction.bundleId !== BUNDLE_ID || !transaction.transactionId || !transaction.environment
        || !Number.isFinite(event.signedDate)) return reply(400, { error: 'INVALID_TRANSACTION' });
      await save({ platform: 'ios', event_id: event.notificationUUID, transaction_id: transaction.transactionId,
        environment: transaction.environment, event_type: event.notificationType,
        full_refund: (transaction as Record<string, unknown>).revocationPercentage === 100000,
        occurred_at: new Date(event.signedDate!).toISOString() });
      return reply(200, { received: true });
    }
    if (source === 'google') {
      const expected = required('STORE_REFUNDS_CRON_SECRET');
      const actual = req.headers.get('x-refunds-secret') ?? '';
      // Compare SHA-256 digests rather than a variable-length secret directly.
      const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
      const [a,b] = await Promise.all([digest(actual),digest(expected)]);
      let mismatch = 0; for (let n=0;n<a.length;n++) mismatch |= a[n]^b[n];
      if (mismatch !== 0) return reply(401, { error: 'UNAUTHORIZED' });
      const token = await googleAccessToken();
      // 30-day overlap makes interrupted runs retryable. Every page must be persisted.
      let next: string | undefined; let count = 0;
      do {
        const url = new URL(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${BUNDLE_ID}/purchases/voidedpurchases`);
        url.searchParams.set('startTime', String(Date.now()-29*86400000));
        url.searchParams.set('type','0'); // one-time products only
        if (next) url.searchParams.set('token', next);
        const result = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!result.ok) throw new Error('STORE_UNAVAILABLE');
        const data = await result.json();
        for (const purchase of data.voidedPurchases ?? []) {
          if (!purchase.orderId || !/^\d+$/.test(String(purchase.voidedTimeMillis))) throw new Error('INVALID_STORE_RESPONSE');
          // Match a verified local receipt to avoid guessing test-vs-production environment.
          const { data: receipt, error } = await db.from('store_purchase_receipts').select('environment')
            .eq('platform','android').eq('transaction_id',purchase.orderId).maybeSingle();
          if (error) throw new Error('PERSIST_FAILED');
          // Unmatched voids are retained too; Google order IDs identify real purchases.
          await save({ platform: 'android', event_id: `${purchase.orderId}:${purchase.voidedTimeMillis}`,
            transaction_id: purchase.orderId, environment: receipt?.environment ?? 'Unknown', event_type: 'VOIDED',
            full_refund: true, // API excludes quantity-based partial refunds by default; only quantity-one products are sold.
            occurred_at: new Date(Number(purchase.voidedTimeMillis)).toISOString() });
          count++;
        }
        next = data.tokenPagination?.nextPageToken;
      } while (next);
      return reply(200, { received: count });
    }
    return reply(400, { error: 'INVALID_SOURCE' });
  } catch {
    // Do not acknowledge a failed durable write; Apple/cron must retry. No raw receipts/keys logged.
    return reply(503, { error: 'REFUND_PROCESSING_FAILED' });
  }
});
