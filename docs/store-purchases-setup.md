# Apple IAP + Google Play Billing — staged integration

Latest override (November 3, owner authorized both TestFlight and Android license testing): `STORE_TEST_MODE_ENABLED=true`, `IAP_ALLOW_TEST_PURCHASES=true`, `STORE_TEST_PLATFORMS=ios,android`; only the resolved owner account ending 6123 is allowlisted. `STORE_PURCHASES_ENABLED=false` and `STORE_REFUNDS_ENABLED=false` remain. Google readiness now succeeds (voided purchases HTTP 200; deliberately invalid purchase token returns 400 invalid rather than permissionDenied). Older blocked/all-disabled snapshots below are historical. Android must use the configured license tester and test payment instrument; the server rejects production receipts but cannot prevent a real store charge made with the wrong store account. TestFlight IAP only on iOS; QPay is a separate real-payment path and must not be used for this sandbox test.

Status (November 3): store migrations and both Edge Functions are deployed; **not device-tested and not ready for production submission**. Real payments, test mode, sandbox receipt acceptance and refund processing remain disabled. Assistant has not built or submitted an app. Bank/tax profiles alone do not enable purchases.

## Scope and behavior

- Owner-requested dual-payment variant: one native package/method screen shows store-localized and fixed QPay prices without pretending they are equal. Method buttons do not repeat amounts. Store opens its mandatory confirmation sheet; QPay proceeds directly to invoice creation/recovery without a second package-selection screen. Selected plan is retained on return. Pending QPay invoice must be resolved/canceled before switching methods. Fixed QPay prices remain unchanged pending owner approval of new amounts.
- `NATIVE_QPAY_ENABLED` in `constants/features.ts` is a static, review-visible switch to remove the QPay option from BOTH native platforms. It is currently `true` by explicit owner request. This is **not policy-compliant approval**: Apple has already rejected this app's QPay digital-ad checkout. Do not describe the variant as compliant or hide QPay during review. Obtain clarification/approval or disable this switch before a compliant release; Google eligibility is separate.
- Existing web QPay code and historical invoices are retained. Insurance remains behind its existing disabled feature flag.
- The stable package/bundle remains `mn.tureestei.app`; the public brand can change without changing product IDs.
- All seven products are repeatable **consumables**, NOT auto-renewing subscriptions. A timed boost is a one-time service.
- Initially native listing-service checkout supports **one listing per purchase**. Bulk selections display an explanation and cannot pay. No silent partial fulfillment or single charge for multiple ads.
- Product prices are fetched from the store; old MNT prices are not used as fake store prices. Pricing must be approved by the owner in both consoles, including commission/taxes and local currency rounding.
- A server-created UUID intent records user, product, store and listing before checkout. StoreKit `appAccountToken` / Google `obfuscatedProfileId` carry that intent; Google also binds `obfuscatedAccountId` to the authenticated user UUID.
- Server verifies Apple JWS with Apple's certificate-chain verifier and App Store Server API; Google uses a service-account JWT and Android Publisher product-purchase API. Client receipt fields alone never grant rights.
- PostgreSQL receipt and benefit writes commit atomically; unique transaction and intent constraints prevent replays. Client roles have no table/RPC permissions.
- App-level listeners survive navigation. On foreground/sign-in, unfinished StoreKit transactions / outstanding Google purchases are rechecked. Finish/consume happens only after grant; interrupted verification is retried, not repurchased.
- Only unconsumed/uncompleted purchases can be recovered from the stores. Already-used consumable credits are NOT restored again; account balances live in the server.

## Store catalog (owner-created November 2)

IDs below match the owner's existing Apple catalog. `Pump` is case-sensitive and means bump;
`sponsor2` means 7 days and `sponsor3` means 30 days (not 2/3 days).
Android uses `mn.tureestei.app.bump` instead of Apple's `mn.tureestei.app.Pump`.
`storeProductId(plan, platform)` selects the correct ID for prices, checkout and recovery.
The purchase migration is installed; its allowlist matches the platform-specific catalog.

| Existing plan | Product ID | Benefit |
|---|---|---|
| credit | `mn.tureestei.app.credit1` | 1 listing credit |
| credit2 | `mn.tureestei.app.credit2` | 2 listing credits |
| credit3 | `mn.tureestei.app.credit3` | 3 listing credits |
| bump | iOS `mn.tureestei.app.Pump`; Android `mn.tureestei.app.bump` | Bump one listing once |
| daily | `mn.tureestei.app.sponsor1` | Sponsor one listing for 1 day |
| weekly | `mn.tureestei.app.sponsor2` | Sponsor one listing for 7 days |
| monthly | `mn.tureestei.app.sponsor3` | Sponsor one listing for 30 days |

Apple: complete Paid Apps Agreement, banking/tax; add consumable products, descriptions, prices, review screenshots. Submit first IAP products together with the updated app version.
Google: complete merchant/payout requirements; add one-time consumable products and purchase options; enable products for test territories; disable multi-quantity checkout for these IDs. Add license testers and install from the testing track.

Owner configured all seven catalog entries and Google service-account access, and reports secrets saved.
These are NOT yet end-to-end verified. Agreed base USD prices: credits 0.99 / 1.99 / 2.99;
bump temporarily 0.99 (revisit ~1,000 MNT goal); sponsor 1/7/30 days 1.99 / 7.99 / 14.99.
Prices are not hard-coded into checkout. QPay prices have NOT been changed.
Android internal version code 9 predates the platform-specific ID fix: a new owner-built binary is required to test Android bump.

## Server configuration — secrets NEVER belong in Expo/public env or source control

Function: `store-purchases`, migration: `20261030000000_store_purchases.sql`.

Required environment values:

- `STORE_PURCHASES_ENABLED`: `false` by default; only set `true` after products and verification credentials are ready.
- `STORE_TEST_MODE_ENABLED`: `true` permits the separate test-only path while `STORE_PURCHASES_ENABLED=false` remains. Requires a nonempty `STORE_TEST_USER_IDS` UUID allowlist and verified `Sandbox` receipts. Production receipts are refused before grant. This does not control the store's charge UI: Android must also use a Google license tester / test payment instrument; iOS must use Sandbox/TestFlight.
- `STORE_TEST_USER_IDS`: comma-separated Supabase auth UUIDs, resolved by an operator from the owner's designated app login. Never authorize based on client-supplied phone/email/user metadata. Empty list denies everyone. Owner nominated app phone ending `6123`; UUID is resolved and configured server-side.
- `APPLE_IAP_PRIVATE_KEY`: Apple's In-App Purchase / App Store Server API .p8 signing key PEM.
- `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`: identifiers for that key.
- `APPLE_IAP_APP_ID`: `6777877910` (numeric App Store app ID, not bundle ID).
- `APPLE_IAP_ROOT_CERTS_BASE64`: JSON array of base64 DER **Apple Root Certificates** from Apple's PKI site; not arbitrary client certificates or the .p8 key.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: service-account credentials with Android Publisher API access and appropriate financial/order permissions for this app in Play Console. Keep private key server-only.
- `IAP_ALLOW_TEST_PURCHASES`: defaults to `false`. Enable only for controlled sandbox / license-test testing, including Apple review. Test grants affect the connected database: prefer an isolated test project/accounts. Test purchase status must not be supplied by the client.

Bank setup is separate from these developer credentials. Apple/Google console access by the owner is still required even when bank support is pending.

Deployment requires separate user authorization. Apply migration before enabling the function, then configure secrets and deploy. Do not reset a linked database.
All errors fail closed. Missing credentials are checked before returning a checkout intent, but correct permissions/credentials must still be validated through real sandbox testing.

## Release gates — not yet completed

1. Apple and Google products, price choices, server credentials and payout requirements.
2. Deploy migration/function with authorization. Default-disabled endpoint must not be advertised as a working checkout.
3. Owner builds a NEW native binary with `expo-iap`. Existing build 58 and Expo Go cannot test this native module. No OTA-only release.
4. Device testing on iOS and Play-installed Android: all seven products, cancellation, pending approval, app kill after payment, network loss before/after grant, failed finish retry, sign-out/account switch, duplicate events, restart recovery, expired/paused/deleted listing during payment.
5. Refund/revocation operations: initial verification rejects Apple revoked / Google canceled purchases. `store-refunds` verifies Apple Notifications V2 and polls Google's Voided Purchases API into a backend-only inbox. A verified full refund revokes only remaining credits attributed to that purchase, exactly once; spent credits, partial/unspecified amounts, reversed refunds and delivered promotions need manual reconciliation. No debt, future deduction or unrelated QPay/free-credit revocation. Verify the operational review queue and store notification setup before monetization.
6. Account deletion vs outstanding purchase and listing deletion after intent creation: the receipt remains unfinished and server rejects delivery to missing owners/listings. Define support/refund handling before release; no fallback grants to a different listing/account.
7. Native compilation / Expo SDK 54 compatibility and store policy review. Library is pinned to `expo-iap@3.4.13`; typechecking is NOT proof of native build success.

Payment ledger stores minimal UUIDs, SKU/intent and transaction IDs without client grants or cascading deletion. Verify financial-retention/privacy policy before production; no raw receipts or private keys are logged/stored in these tables.

## Refund event inbox (deployed, processing disabled)

- Apply `20261102000000_store_refund_inbox.sql` after the purchase migration.
- Then apply `20261102000100_store_refund_entitlements.sql` BEFORE accepting any store purchases. It adds credit-lot tracking and a guarded grant RPC. Historical receipts without lots are manual-review only.
- `STORE_REFUNDS_ENABLED` defaults off. Apple endpoint: `/functions/v1/store-refunds?source=apple`; select Notifications V2 in App Store Connect. Production and sandbox need explicit configuration; sandbox is accepted only with `IAP_ALLOW_TEST_PURCHASES=true`.
- Google endpoint: `/functions/v1/store-refunds?source=google`, POST with private `x-refunds-secret` matching `STORE_REFUNDS_CRON_SECRET`. Schedule server-side at least daily (prefer hourly); never put this secret in the app. It polls a 29-day overlapping window with pagination. An outage beyond this window requires manual reconciliation.
- Only verified metadata is stored, not raw signed payloads or purchase tokens. Unmatched Google events use `Unknown` environment for operator review, never guessed production.
- Paid-credit decreases consume store lots first, FIFO, under the existing account row lock; any remaining decrease belongs to other paid sources. This is conservative attribution: consumed store credits are not automatically reclaimed from unrelated balances. Credit-lot removal by a refund does not consume another lot.
- Full refunds automatically remove only the associated unused tracked credits. Apple requires signed `revocationPercentage=100000`; unspecified/partial refunds remain manual, avoiding over-revocation. Google's poll excludes quantity-based partial refunds and these products disable multi-quantity checkout.
- Refund-before-grant blocks a later receipt grant. Duplicate events never double-debit. `REFUND_REVERSED` never blindly re-grants spent credits. Promotion refunds do not shorten another payment's sponsored time.
- Owner policy: unused packs may be refunded; voluntarily refunding partly/fully used packs is declined, except delivery errors/duplicate charges/mandatory store or legal decisions. Store-issued refunds still override this preference. No consumption information is sent to Apple without a separate consent flow; `CONSUMPTION_REQUEST` automation is not enabled.
- Operator must monitor `store_refund_events where status='needs_review'` and resolve cases with an audit note after reconciliation. Automated alerts/admin UI and real store notification tests remain release gates; this is not a fully hands-off refund system.

## Local checks

`npx tsc --noEmit`

`node --test tests/store-purchases.cjs tests/store-purchases-db.cjs tests/qpay-flows.cjs`

## Authorized deployment handoff

Target project: `wrekrjaitokrqydkwgtg` (existing linked project). User authorized staged live deployment and sandbox preparation only, NOT real-payment enablement or app builds.

Initial November 2 CLI access returned HTTP 403; owner then signed in successfully. The four new store migrations (including an inactive polling schedule) are now installed and recorded, without changing unrelated historical migration gaps. Both functions are deployed. Test account UUID is configured server-side; real payments, test mode, sandbox receipt acceptance and refund processing remain FALSE.

November 3 live readiness: Apple SANDBOX authentication succeeds (4040010 for a deliberately nonexistent transaction); production still returns 401. Test-only Apple verification now selects sandbox directly, retaining signature/environment/account checks. This is credential readiness, not a completed purchase test. Google OAuth succeeds and the service-account identity matches the Play Console account exactly, but both voided-purchases and purchase verification probes return 401 permissionDenied despite the owner's screenshot showing the required app permissions checked. Do not rotate keys or grant broad roles based on this alone. All payment/test/refund gates remain false. Apple transport uses native Edge fetch + JOSE ES256, retaining Apple's SignedDataVerifier for JWS certificate verification.

`store-refunds?source=readiness` is private-header authenticated and returns only status codes/booleans, never keys/tokens. Run `supabase/deploy/check-store-readiness.sql`, then read only the returned request ID from `net._http_response`. Operator secret is in Edge Secrets and Vault; no secret local files. Hourly `store-refunds-hourly` job is INACTIVE until the credentials and refund tests pass.

Remaining operational sequence (do NOT reapply installed migrations):

1. Resolve Google API permissionDenied (support ticket `9-0573000042263` submitted). Apple production authentication also remains unverified; sandbox authentication succeeds.
2. Preserve installed migrations and existing balances. Do not blindly apply unrelated pending migrations, repair history, or reset the database.
3. Both functions are installed. Preserve `STORE_PURCHASES_ENABLED=false`; do not repeat the one-time bootstrap. Verify secret NAMEs and digests only, never disclose values.
4. Resolve the designated test app account to its auth UUID read-only. Set the UUID allowlist and test-only flag; enable sandbox receipts only for the controlled test. Empty/unknown account must remain closed.
5. Configure private Google polling secret + hourly server-side schedule; configure Apple V2 notification URL. Never put cron secret in SQL plaintext/logs/app code; use Vault or equivalent server-side storage. Verify Apple TEST event and inspect refund queue monitoring.
6. Verify disabled/unauthorized/non-allowlisted calls fail without side effects. Then owner performs all-seven-SKU sandbox purchases and interruption/refund tests. New native binary required for the platform ID change; assistant does not build.
7. Keep production gate false until owner separately authorizes a real-payment release after tests and policy review. QPay remains review-visible, not policy-approved by this deployment.

Owner console actions are listed in `docs/store-owner-checklist.md`. Read-only operational report: `supabase/deploy/store-operations-status.sql`; monitor `needs_review` cases manually until an approved alert destination/admin workflow exists. Never mark a case resolved merely to clear a warning. The one-time secret bootstrap now refuses existing Vault configuration before changing the Edge secret.

`deno check --config supabase/functions/store-purchases/deno.json supabase/functions/store-purchases/index.ts`

PGlite tests execute the actual new migration in a temporary in-memory PostgreSQL instance, with synthetic users/listings. No production data is touched. They cover duplicate receipts, tampered ownership/SKU, transactional rollback and denied client grants. They do not emulate store cryptography, native UI or concurrent physical devices.

## References

- https://developer.apple.com/app-store/review/guidelines/#business
- https://github.com/apple/app-store-server-library-node
- https://www.apple.com/certificateauthority/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
- https://developer.android.com/google/play/billing/security
- https://github.com/hyochan/expo-iap
