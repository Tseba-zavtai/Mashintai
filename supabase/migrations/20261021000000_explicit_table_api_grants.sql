-- Explicit access for tables introduced by this repository's migrations.
-- Preserve the existing row policies; never enable broad default privileges.
begin;

-- Fail atomically if a prerequisite table is missing. RLS must remain enabled.
alter table public.app_release_notes enable row level security;
alter table public.seasonal_collections enable row level security;
alter table public.seasonal_collection_rules enable row level security;
alter table public.mock_ebarimt_receipts enable row level security;
alter table public.user_contact_phones enable row level security;
alter table public.rental_disputes enable row level security;
alter table public.dan_identities enable row level security;
alter table public.dan_auth_states enable row level security;
alter table public.dan_auth_handoffs enable row level security;
alter table public.listing_search_events enable row level security;
alter table public.qpay_service_orders enable row level security;
alter table public.deleted_account_financial_records enable row level security;
alter table public.account_deletion_files enable row level security;

-- Reset legacy implicit privileges, including privileges inherited from PUBLIC.
revoke all on table
  public.app_release_notes, public.seasonal_collections,
  public.seasonal_collection_rules, public.mock_ebarimt_receipts,
  public.user_contact_phones, public.rental_disputes,
  public.dan_identities, public.dan_auth_states, public.dan_auth_handoffs,
  public.listing_search_events, public.qpay_service_orders,
  public.deleted_account_financial_records, public.account_deletion_files
from public, anon, authenticated;

-- Public configuration: visible/active rows only, as enforced by existing RLS.
grant select on table public.app_release_notes,
  public.seasonal_collections, public.seasonal_collection_rules
to anon, authenticated;

-- Admin UI writes use authenticated sessions; existing super-admin RLS
-- policies, not the grant itself, authorize these operations.
grant insert, update, delete on table public.seasonal_collections,
  public.seasonal_collection_rules to authenticated;

-- Receipts are created by trusted RPCs, not by client writes.
grant select on table public.mock_ebarimt_receipts to authenticated;
-- Contact numbers: all operations are restricted to the owner by existing RLS.
grant select, insert, update, delete on table public.user_contact_phones
to authenticated;
-- Participants can report; only admins can update. No client DELETE policy.
grant select, insert, update on table public.rental_disputes to authenticated;

-- Trusted server operations still require object privileges despite RLS bypass.
grant select, insert, update, delete on table
  public.app_release_notes, public.seasonal_collections,
  public.seasonal_collection_rules, public.mock_ebarimt_receipts,
  public.user_contact_phones, public.rental_disputes,
  public.dan_identities, public.dan_auth_states, public.dan_auth_handoffs,
  public.listing_search_events, public.qpay_service_orders,
  public.deleted_account_financial_records, public.account_deletion_files
to service_role;

-- Used by the trusted receipt-generation path, never directly by clients.
revoke all on sequence public.mock_ebarimt_receipt_sequence
from public, anon, authenticated;
grant usage, select on sequence public.mock_ebarimt_receipt_sequence
to service_role;

commit;
