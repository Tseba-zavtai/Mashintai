-- Minimal operator-only diagnostics. Never store receipts, keys or purchase tokens.
create table public.store_verification_diagnostics (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 user_id uuid,
 platform text,
 stage text not null,
 error_code text not null
);
alter table public.store_verification_diagnostics enable row level security;
revoke all on public.store_verification_diagnostics from public,anon,authenticated;
grant select,insert on public.store_verification_diagnostics to service_role;
