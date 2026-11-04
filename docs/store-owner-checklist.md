# Owner console actions and controlled device test

No real-payment release is authorized. Do not enable production payments or submit a build automatically.

## Required owner-only actions

1. Google support ticket `9-0573000042263`: forward the technical response for diagnosis. Do not attach private JSON, p8 keys, access tokens or customer receipts. Existing app financial/order permissions are already checked; no broad Admin role is needed.
2. Google Play Console license testing: add the Google account actually used by the Play Store on the test phone. This is NOT necessarily the app login phone. Add that account to the internal-testing tester list too, opt in, then install the new build from Google Play. A sideloaded preview APK is not the release test path.
3. Apple: use TestFlight for the owner-built IAP-enabled binary (or a configured sandbox account on a development build). Confirm the purchase sheet explicitly indicates a test/sandbox transaction; do not approve a real charge.
4. Apple App Store Connect: complete display name, description and review screenshot for each of the seven IAPs. Screenshots must show the actual new purchase UI, not a fabricated screen. Include all seven with the first IAP-enabled app submission. Do not submit before device QA.
5. Apple App Information: configure App Store Server Notifications V2 sandbox URL after the operator enables controlled notification testing:
   `https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/store-refunds?source=apple`
   Production uses the same URL but must wait for production approval/readiness. Request and verify Apple's TEST notification. Currently refund processing is disabled, so it intentionally returns 503.
6. QPay remains owner-requested and visible, not approved for native digital advertising services. Obtain explicit policy guidance or authorize a compliant alternative before store release. Do not hide it from reviewers.

## Operator prerequisites before telling owner to buy

- Resolve API permissions, validate relevant environment and all SKU mappings.
- Keep `STORE_PURCHASES_ENABLED=false`.
- Verify allowlist contains only the nominated app account UUID, resolved from app phone ending 6123.
- Enable test-only and sandbox acceptance only when the license tester/TestFlight setup is confirmed. These server flags cannot stop Google from charging an improperly configured store account.
- Activate refund processing/polling only for the controlled test after notification setup and API authorization are verified. Do not activate the scheduled job blindly.

## Owner builds (assistant must not build)

New iOS and Android native builds are required. Build 58 and Android internal version 9 do not represent the latest integration. Keep bundle/package `mn.tureestei.app`; do not change store IDs.

## Test all seven products

| Product | Expected effect |
|---|---|
| credit1 | +1 paid listing credit |
| credit2 | +2 paid listing credits |
| credit3 | +3 paid listing credits |
| Apple Pump / Android bump | bump one eligible listing once |
| sponsor1 | sponsor one listing for 1 day |
| sponsor2 | sponsor one listing for 7 days |
| sponsor3 | sponsor one listing for 30 days |

For each: store-localized price is shown, cancellation grants nothing, successful verification grants once, app restart does not grant twice. Test loss of network after store approval and recovery after relaunch; never repurchase to recover. Test sign-out/account switching and reject delivery to another account. Test expired/paused/deleted listings, pending purchases and duplicate callbacks. Do not test with a real customer account.

Test refunds: unused pack removes only its tracked remaining credits once; partially spent pack does not take free/QPay credits or create debt; delivered promotions and ambiguous/partial/reversed events enter manual review. Store/law refund decisions override voluntary no-refund preferences.

## Review notes template (edit to match tested build)

This app uses consumable In-App Purchases for listing credits (1, 2 or 3), a one-time listing bump, and sponsored listing services (1, 7 or 30 days). It does not sell subscriptions. Purchases are verified server-side and bound to the signed-in app account. Provide a dedicated reviewer login and accurate steps to the payment screen. The current owner-only test allowlist will block reviewers; resolve review access deliberately before submission. Never claim reviewer access is enabled until actually checked. Describe QPay honestly and do not claim Apple has approved it.

## Completion criteria

All-seven-SKU device tests, refund/recovery tests, store notification tests, review metadata, reviewer access, policy resolution and explicit production authorization are required. Unit tests and active bank profiles are not a substitute.
