# QPay service payments

Implemented scope: listing credit (3,000 MNT), bump (1,000 MNT), sponsored
1/7/30 days (4,500/21,000/45,000 MNT). Rental and insurance unchanged.

The owner explicitly requested QPay enabled for public launch after being
informed of App Store / Play digital-service billing review risks. This is not
a guarantee of store approval. No platform payment integration is implemented.

## Configuration

Supabase project: wrekrjaitokrqydkwgtg. Edge Function Secrets:
- QPAY_USERNAME: client name from QPay email (owner enters privately)
- QPAY_PASSWORD: password from QPay email (owner enters privately)
- QPAY_INVOICE_CODE: TUREESLY_APP_INVOICE (configured)

Credentials must never be entered into Expo public variables, app source,
committed .env files, screenshots or chat.

Endpoint qpay-service and all three QPay migrations are deployed/applied.
Legacy create-qpay-invoice and qpay-callback are retired and do not process
payments. New invoices carry a unique order ID and secret callback URL.
Callback body amounts/statuses are never trusted: the provider's authenticated
payment/check response must contain exactly one PAID MNT payment for the exact
stored amount. A transaction locks the order and grants the benefit once.

Mobile status checks read the database, not QPay; no periodic provider polling.
Pending invoice QR/deeplinks are reused for 24h. Unknown create outcomes remain
CREATING rather than silently making a second payable invoice. Support must
reconcile such orders with QPay before marking failed or issuing a replacement.
Do not delete paid orders or retry grants manually. No automatic refunds or
real eBarimt issuance are implemented, and no mock eBarimt is shown.

## Verification

- node --test tests/qpay-flows.cjs: handler tested with deterministic doubles
- node tests/qpay-live-smoke.cjs: read-only production rejection checks
- tests/qpay-db-smoke.sql: transactional rights/double-grant checks, rolled back
- tests/qpay-permissions-smoke.sql: direct paid-field edits/admin escalation rejected, rolled back
- TypeScript, lint, Android/iOS export

Still mandatory before public launch: owner enters credentials and tests a real
invoice, actual bank-app deeplink, payment callback, exactly-once benefit, and
reopening the app. Real credentials/end-to-end transaction were not available
during implementation. Bank processing, merchant account and settlement are
not verified by mock tests or export checks.

References:
https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods
https://support.google.com/googleplay/android-developer/answer/9858738
