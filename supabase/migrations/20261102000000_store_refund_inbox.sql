begin;
-- Verified store events only. No client access and no automatic balance deduction.
-- Unmatched events are retained: notifications can precede client receipt delivery.
create table public.store_refund_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios','android')),
  event_id text not null,
  transaction_id text not null,
  environment text not null check (environment in ('Production','Sandbox','Unknown')),
  event_type text not null check (event_type in ('REFUND','REVOKE','REFUND_REVERSED','VOIDED')),
  occurred_at timestamptz not null,
  full_refund boolean not null default false,
  received_at timestamptz not null default now(),
  status text not null default 'needs_review' check (status in ('needs_review','resolved')),
  resolved_at timestamptz,
  resolution_note text,
  unique(platform,event_id)
);
create index store_refund_events_pending on public.store_refund_events(status,received_at);
create index store_refund_events_transaction on public.store_refund_events(platform,environment,transaction_id);
alter table public.store_refund_events enable row level security;
revoke all on public.store_refund_events from public,anon,authenticated;
grant select,insert,update on public.store_refund_events to service_role;
commit;
