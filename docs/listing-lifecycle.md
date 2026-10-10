# Listing packages and lifecycle

- Credits: 1 / 2 / 3 for MNT 3,000 / 5,000 / 7,000. Monthly free allowance unchanged.
- `created_at` is historical. `published_at` controls displayed age and normal ranking; `listing_expires_at` controls the 30-day publication window.
- Unexpired paused listings resume free. Expired listings consume one credit each. Bulk activation is transactional and fails entirely if credits or inventory are insufficient.
- Pump and Sponsored reserve only active, unexpired, available owner listings. Sponsored rejects already-sponsored selections to avoid replacing paid remaining time.
- One bulk invoice uses server-priced total. Successful payment renews all targets for 30 days from confirmation. Sponsored starts a separate 1/7/30-day period. Pump is a one-time timestamp move, never a timed pin.
- Eligibility is checked when reserving; a payment made after listing expiry still renews the reserved targets. Pause/inventory state is not overridden on payment. A listing rented out while payment is pending remains hidden until available again.
- Pending invoices protect target deletion. Paid invoice history remains after deletion. Active rental requests block deletion.
- Existing single-listing API is retained as a wrapper. Existing pending orders are backfilled with their target arrays.

Verification: `tests/listing-migration-smoke.sql` installs the migration inside a rolled-back transaction, tests packages, duplicate confirmation, bulk renewal, preserved history, expiry/inventory rejection, insufficient-credit atomicity and free pause/resume. It leaves no fixtures or schema changes behind.

Abandoned pending invoices can be cancelled by their owner. The Edge Function checks payment, calls QPay DELETE /v2/invoice/{invoice_id}, then records CANCELLED only after provider success. Paid invoices grant services rather than cancelling. Local QR state is removed only after server confirmation. Verified late callbacks can still finalize once, so an in-flight payment is never discarded. CREATING invoices without a known provider ID require reconciliation and cannot be silently cancelled. Provider failures preserve the pending invoice.
