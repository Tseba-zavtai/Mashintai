import { Environment, SignedDataVerifier } from 'npm:@apple/app-store-server-library@2.0.0';
import { SignJWT, importPKCS8 } from 'npm:jose@5.9.6';

export const BUNDLE_ID = 'mn.tureestei.app';
export const PRODUCT_PLANS: Record<string, string> = {
  'mn.tureestei.app.credit1': 'credit', 'mn.tureestei.app.credit2': 'credit2',
  'mn.tureestei.app.credit3': 'credit3', 'mn.tureestei.app.Pump': 'bump',
  'mn.tureestei.app.sponsor1': 'daily', 'mn.tureestei.app.sponsor2': 'weekly',
  'mn.tureestei.app.sponsor3': 'monthly',
};
export function isStoreProduct(productId: string, platform: string): boolean {
  if (platform === 'android' && productId === 'mn.tureestei.app.bump') return true;
  return Object.hasOwn(PRODUCT_PLANS, productId) && !(platform === 'android' && productId === 'mn.tureestei.app.Pump');
}
export type VerifiedPurchase = {
  intentId: string; productId: string; transactionId: string;
  environment: 'Production' | 'Sandbox'; purchasedAt: string;
};
export function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('STORE_NOT_CONFIGURED');
  return value;
}
const allowTest = () => Deno.env.get('IAP_ALLOW_TEST_PURCHASES') === 'true';

// Use native Edge fetch/WebCrypto for API transport, Apple's library for JWS chain verification.
// Apple's Node API client depends on node-fetch/jsonwebtoken, which may fail in the Edge runtime.
async function appleTransactionInfo(transactionId: string, environment: Environment): Promise<{signedTransactionInfo?:string}> {
  const key=await importPKCS8(required('APPLE_IAP_PRIVATE_KEY').replace(/\\n/g,'\n'),'ES256');
  const token=await new SignJWT({bid:BUNDLE_ID}).setProtectedHeader({alg:'ES256',kid:required('APPLE_IAP_KEY_ID'),typ:'JWT'})
    .setIssuer(required('APPLE_IAP_ISSUER_ID')).setAudience('appstoreconnect-v1').setIssuedAt().setExpirationTime('5m').sign(key);
  const host=environment===Environment.SANDBOX ? 'https://api.storekit-sandbox.itunes.apple.com' : 'https://api.storekit.itunes.apple.com';
  const response=await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw Object.assign(new Error('APPLE_API_FAILED'),{httpStatusCode:response.status,apiError:data?.errorCode});
  return data;
}

// Kept pure so hostile/pending/foreign transactions can be tested without store credentials.
export function validateApple(data: Record<string, any>, transactionId: string, environment: string): VerifiedPurchase {
  if (data.bundleId !== BUNDLE_ID || data.transactionId !== transactionId || !Object.hasOwn(PRODUCT_PLANS, data.productId)
    || data.type !== 'Consumable' || data.quantity !== 1 || data.revocationDate != null
    || data.inAppOwnershipType !== 'PURCHASED' || data.environment !== environment
    || typeof data.appAccountToken !== 'string' || !Number.isFinite(data.purchaseDate)) throw new Error('INVALID_PURCHASE');
  if (environment !== 'Production' && !allowTest()) throw new Error('TEST_PURCHASE_NOT_ALLOWED');
  return { intentId: data.appAccountToken.toLowerCase(), productId: data.productId, transactionId,
    environment: environment as VerifiedPurchase['environment'], purchasedAt: new Date(data.purchaseDate).toISOString() };
}
export function validateGoogle(data: Record<string, any>, productId: string, userId: string): VerifiedPurchase {
  if (!isStoreProduct(productId, 'android') || data.purchaseState !== 0 || (data.quantity ?? 1) !== 1
    || data.obfuscatedExternalAccountId !== userId || typeof data.obfuscatedExternalProfileId !== 'string'
    || (data.productId && data.productId !== productId) || !data.orderId
    || !/^\d+$/.test(String(data.purchaseTimeMillis))) throw new Error('INVALID_PURCHASE');
  if (data.purchaseType != null && data.purchaseType !== 0) throw new Error('INVALID_PURCHASE');
  const environment = data.purchaseType === 0 ? 'Sandbox' : 'Production';
  if (environment === 'Sandbox' && !allowTest()) throw new Error('TEST_PURCHASE_NOT_ALLOWED');
  return { intentId: data.obfuscatedExternalProfileId, productId, transactionId: data.orderId,
    environment, purchasedAt: new Date(Number(data.purchaseTimeMillis)).toISOString() };
}

export async function verifyApple(transactionId: string, sandboxOnly = false): Promise<VerifiedPurchase> {
  if (sandboxOnly && !allowTest()) throw new Error('TEST_PURCHASE_NOT_ALLOWED');
  const roots: string[] = JSON.parse(required('APPLE_IAP_ROOT_CERTS_BASE64'));
  if (!Array.isArray(roots) || roots.length === 0) throw new Error('STORE_NOT_CONFIGURED');
  const { Buffer } = await import('node:buffer');
  const certs = roots.map(cert => Buffer.from(cert, 'base64'));
  const appId = Number(required('APPLE_IAP_APP_ID'));
  if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error('STORE_NOT_CONFIGURED');
  // The server chooses the environment, never trusts a client-supplied sandbox flag.
  const environments = sandboxOnly ? [Environment.SANDBOX] : [Environment.PRODUCTION, ...(allowTest() ? [Environment.SANDBOX] : [])];
  for (const env of environments) {
    let response;
    try { response = await appleTransactionInfo(transactionId,env); }
    catch (error) {
      // Only a genuine production TransactionIdNotFound may fall back to sandbox.
      if (env === Environment.PRODUCTION && allowTest() && (error as any)?.apiError === 4040010) continue;
      throw new Error('STORE_VERIFICATION_FAILED');
    }
    if (!response.signedTransactionInfo) throw new Error('INVALID_PURCHASE');
    const verifier = new SignedDataVerifier(certs, true, env, BUNDLE_ID, appId);
    let decoded;
    try { decoded = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo); }
    catch (error) {
      const status = (error as { status?: number })?.status;
      // Only categorical runtime details; never persist signed data or arbitrary error messages.
      const cause = (error as { cause?: { name?: string; code?: string; message?: string } })?.cause;
      const runtimeCode = String(cause?.code ?? '').replace(/[^A-Z0-9_]/g, '').slice(0, 35);
      const runtimeName = cause?.name === 'TypeError' ? 'TYPE' : cause?.name === 'NotSupportedError' ? 'UNSUPPORTED' : 'OTHER';
      const unsupported = /not implemented|not supported/i.test(cause?.message ?? '') ? '_UNIMPLEMENTED' : '';
      throw Object.assign(new Error('STORE_VERIFICATION_FAILED'), {
        diagnosticCode: 'APPLE_JWS_' + (Number.isInteger(status) ? status : 'UNKNOWN') + '_' + runtimeName + unsupported + (runtimeCode ? '_' + runtimeCode : ''),
      });
    }
    return validateApple(decoded as Record<string, any>, transactionId, env);
  }
  throw new Error('INVALID_PURCHASE');
}

export async function googleAccessToken(): Promise<string> {
  const account = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
  if (!account.client_email || !account.private_key) throw new Error('STORE_NOT_CONFIGURED');
  const privateKey = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const auth = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(15000) });
  if (!auth.ok) throw new Error('STORE_VERIFICATION_FAILED');
  const { access_token } = await auth.json();
  if (typeof access_token !== 'string') throw new Error('STORE_VERIFICATION_FAILED');
  return access_token;
}

// Operator-only readiness probe: authenticate without charging or granting any purchase.
export async function checkStoreCredentials(): Promise<Record<string, boolean | number | string>> {
  const roots: string[] = JSON.parse(required('APPLE_IAP_ROOT_CERTS_BASE64'));
  if (!Array.isArray(roots) || !roots.length) throw new Error('STORE_NOT_CONFIGURED');
  const { Buffer } = await import('node:buffer');
  const appId = Number(required('APPLE_IAP_APP_ID'));
  if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error('STORE_NOT_CONFIGURED');
  new SignedDataVerifier(roots.map(root => Buffer.from(root,'base64')), true, Environment.PRODUCTION, BUNDLE_ID, appId);
  let appleAuthenticated = false;
  let appleStatus=0, appleApiError=0, appleLocalError='', appleLocalCode='';
  try { await appleTransactionInfo('1000000000000000',Environment.PRODUCTION); appleAuthenticated = true; }
  catch (error) {
    const e=error as { apiError?: number; httpStatusCode?: number; name?:string; code?:string };
    appleStatus=e.httpStatusCode ?? 0; appleApiError=e.apiError ?? 0;
    appleLocalError=String(e.name ?? '').slice(0,60); appleLocalCode=String(e.code ?? '').slice(0,80);
    if (e.apiError === 4040010) appleAuthenticated = true;
  }
  const token = await googleAccessToken();
  const account = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
  const googleAccountMatches = account.client_email === 'tureesly-play-billing@project-ac36ed12-59c5-44ae-b03.iam.gserviceaccount.com';
  let appleSandboxAuthenticated = false, appleSandboxStatus = 0;
  try { await appleTransactionInfo('1000000000000000',Environment.SANDBOX); appleSandboxAuthenticated=true; }
  catch(error) {
    const e=error as {apiError?:number;httpStatusCode?:number};
    appleSandboxStatus=e.httpStatusCode ?? 0;
    appleSandboxAuthenticated=e.apiError===4040010;
  }
  const google = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${BUNDLE_ID}/purchases/voidedpurchases?maxResults=1`, {
    headers: { Authorization:`Bearer ${token}` }, signal:AbortSignal.timeout(15000),
  });
  let googleReason='';
  if(!google.ok) {
    const body=await google.json().catch(()=>null);
    googleReason=String(body?.error?.status ?? body?.error?.errors?.[0]?.reason ?? 'UNKNOWN').slice(0,80);
  }
  // A deliberately nonexistent token checks the purchase endpoint without buying anything.
  const purchaseProbe=await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${BUNDLE_ID}/purchases/products/mn.tureestei.app.credit1/tokens/readiness-invalid-token`, {
    headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),
  });
  const purchaseBody=await purchaseProbe.json().catch(()=>null);
  const googlePurchaseReason=String(purchaseBody?.error?.status ?? purchaseBody?.error?.errors?.[0]?.reason ?? '').slice(0,80);
  return { appleAuthenticated, appleStatus, appleApiError, appleLocalError, appleLocalCode, appleSandboxAuthenticated, appleSandboxStatus, googleAccountMatches, googleAuthenticated:google.ok, googleStatus:google.status, googleReason, googlePurchaseStatus:purchaseProbe.status, googlePurchaseReason, appleRootsConfigured:true };
}

export async function verifyGoogle(token: string, productId: string, userId: string): Promise<VerifiedPurchase> {
  const access_token = await googleAccessToken();
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${BUNDLE_ID}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('STORE_VERIFICATION_FAILED');
  return validateGoogle(await response.json(), productId, userId);
}
