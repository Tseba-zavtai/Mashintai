# Automatic account deletion

`delete-user` verifies the caller with Auth `getUser`. Self-deletion is allowed;
deleting another user requires a server-side super-admin check. Super-admin
targets are protected until their role is transferred.

`delete_account_atomic` is service-role-only. It locks the profile and affected
jobs/rentals/orders, refuses ongoing rentals, pending invoices/payments and open
disputes, then removes the profile, listings, related terminal rental/review
history, feedback, financial relationships, Auth sessions, DAN links and contacts
in a single transaction. Unexpected failures roll back the whole operation.
The confirmation explicitly warns that related rental history will be removed.

Only unlinked financial summaries (source, amount, status, service type and
dates) remain in an RLS-protected service-only table. No user/account IDs, phone,
name, identity hash, invoice identifiers, QR content or provider payloads are
copied. This is not a legal determination of accounting retention obligations;
those must be reviewed separately before making a retention-period promise.

Owned Storage objects are queued within the transaction. The API tries cleanup
immediately; a pg_cron/pg_net job wakes `account-deletion-cleanup` every ten
minutes. The wake-up is public but accepts no target or file path, returns no
data, and can only consume service-only preauthorized queue entries under
five-minute leases. Failed removals stay queued for retry. Never delete
`storage.objects` rows directly.

The legacy rental-account trigger used lowercase `delete` although PostgreSQL
TG_OP is uppercase, silently cancelling physical listing deletion. The migration
corrects that comparison and verifies no account/listing rows remain before
committing.

Checks: `node --test tests/account-deletion.cjs tests/auth-flows.cjs` and
`supabase db query --linked --file tests/account-deletion-db-smoke.sql`.
The SQL smoke test uses synthetic users and always rolls back on success.
It covers active-rental, pending-payment and open-dispute rollback, terminal
history with payment/receipt rows, Auth/DAN removal, other-account preservation,
idempotence, restricted RPC access and cleanup leases. It does not prove the
real device UI or Storage network-failure recovery end to end.

Server changes work with the existing build's delete button. The improved
confirmation/error text needs a new client build. No real user was deleted
during verification.
