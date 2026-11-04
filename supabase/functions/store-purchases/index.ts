import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isStoreProduct, required, verifyApple, verifyGoogle } from './verification.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
Deno.serve(async req => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  let diagnosticUser: string | undefined, diagnosticPlatform: string | undefined;
  let stage = 'authentication';
  try {
    // Disabled until the catalog, credentials and sandbox tests have been configured.
    const productionEnabled = Deno.env.get('STORE_PURCHASES_ENABLED') === 'true';
    const testOnly = !productionEnabled && Deno.env.get('STORE_TEST_MODE_ENABLED') === 'true';
    if (!productionEnabled && !testOnly) return reply({ error: 'STORE_NOT_CONFIGURED' }, 503);
    const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const { data: { user }, error: authError } = await db.auth.getUser(bearer);
    if (authError || !user) return reply({ error: 'UNAUTHORIZED' }, 401);
    diagnosticUser = user.id;
    if (testOnly) {
      const testers = (Deno.env.get('STORE_TEST_USER_IDS') ?? '').split(',').map(id => id.trim()).filter(id => uuid.test(id));
      if (!testers.includes(user.id)) return reply({ error: 'TEST_ACCOUNT_REQUIRED' }, 403);
    }
    const raw = await req.text();
    if (raw.length > 20000) return reply({ error: 'INVALID_REQUEST' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'INVALID_REQUEST' }, 400); }
    if (!body || !['ios', 'android'].includes(body.platform)) return reply({ error: 'INVALID_REQUEST' }, 400);
    diagnosticPlatform = body.platform;
    if (testOnly) {
      const platforms = (Deno.env.get('STORE_TEST_PLATFORMS') ?? 'ios').split(',').map(value => value.trim());
      if (!platforms.includes(body.platform)) return reply({ error: 'TEST_PLATFORM_DISABLED' }, 403);
    }
    if (body.action === 'prepare') {
      stage = 'prepare';
      // Fail before opening store checkout when verification credentials are not configured.
      for (const name of body.platform === 'ios'
        ? ['APPLE_IAP_PRIVATE_KEY','APPLE_IAP_KEY_ID','APPLE_IAP_ISSUER_ID','APPLE_IAP_ROOT_CERTS_BASE64','APPLE_IAP_APP_ID']
        : ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']) required(name);
      if (typeof body.productId !== 'string' || !isStoreProduct(body.productId, body.platform)) return reply({ error: 'INVALID_PRODUCT' }, 400);
      if (body.jobId != null && (typeof body.jobId !== 'string' || !uuid.test(body.jobId))) return reply({ error: 'INVALID_JOB' }, 400);
      const { data, error } = await db.rpc('prepare_store_purchase', {
        p_user_id: user.id, p_platform: body.platform, p_product_id: body.productId, p_job_id: body.jobId ?? null,
      });
      if (error) throw new Error(error.message);
      return reply({ intentId: data });
    }
    if (body.action !== 'verify' || typeof body.productId !== 'string' || !isStoreProduct(body.productId, body.platform)) return reply({ error: 'INVALID_REQUEST' }, 400);
    let verified;
    stage = 'verify';
    if (body.platform === 'ios') {
      if (typeof body.transactionId !== 'string' || !/^\d{1,64}$/.test(body.transactionId)) return reply({ error: 'INVALID_PURCHASE' }, 400);
      verified = await verifyApple(body.transactionId, testOnly);
    } else {
      if (typeof body.purchaseToken !== 'string' || !body.purchaseToken.length || body.purchaseToken.length > 16000) return reply({ error: 'INVALID_PURCHASE' }, 400);
      verified = await verifyGoogle(body.purchaseToken, body.productId, user.id);
    }
    if (verified.productId !== body.productId || !uuid.test(verified.intentId)) return reply({ error: 'INVALID_PURCHASE' }, 400);
    if (testOnly && verified.environment !== 'Sandbox') return reply({ error: 'REAL_PURCHASES_DISABLED' }, 403);
    // Identity, target listing and SKU come from an intent bound into the store receipt.
    // Neither the client nor a replay can redirect a paid transaction to a different listing.
    stage = 'grant';
    const { data, error } = await db.rpc('grant_verified_store_purchase', {
      p_user_id: user.id, p_intent_id: verified.intentId, p_platform: body.platform,
      p_product_id: verified.productId, p_transaction_id: verified.transactionId,
      p_environment: verified.environment, p_purchased_at: verified.purchasedAt,
    });
    if (error) throw new Error(error.message);
    return reply({ granted: true, intentId: verified.intentId, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known = ['STORE_NOT_CONFIGURED', 'STORE_VERIFICATION_FAILED', 'INVALID_PURCHASE', 'TEST_PURCHASE_NOT_ALLOWED',
      'NOT_YOUR_JOB', 'LISTING_EXPIRED', 'LISTING_INACTIVE', 'NO_AVAILABLE_QUANTITY', 'ALREADY_SPONSORED',
      'RATE_LIMITED', 'PURCHASE_MISMATCH', 'PURCHASE_ALREADY_USED', 'PURCHASE_REFUNDED', 'INVALID_SELECTION'];
    const code = known.find(code => message.includes(code)) ?? 'PAYMENT_VERIFICATION_FAILED';
    if (diagnosticUser) {
      try {
        const diagnostic = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
        const safe = (error as { diagnosticCode?: string })?.diagnosticCode;
        await diagnostic.from('store_verification_diagnostics').insert({
          user_id: diagnosticUser, platform: diagnosticPlatform, stage,
          error_code: safe && /^[A-Z0-9_:-]{1,100}$/.test(safe) ? safe : code,
        });
      } catch { /* Diagnostics must not alter purchase handling. */ }
    }
    // Never log receipts, service-account keys or raw upstream error responses.
    return reply({ error: code }, code === 'STORE_NOT_CONFIGURED' || code === 'STORE_VERIFICATION_FAILED' ? 503 : 400);
  }
});
