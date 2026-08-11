-- DAN OAuth-Ð¸Ð¹Ð½ Ð½ÑƒÑƒÑ† Ð±Ð¾Ð»Ð¾Ð½ Ð¸Ñ€Ð³ÑÐ½Ð¸Ð¹ ÑÐ¼Ð·ÑÐ³ Ð¼ÑÐ´ÑÑÐ»Ð»Ð¸Ð¹Ð³ public.users Ñ…Ò¯ÑÐ½ÑÐ³Ñ‚ÑÐ´
-- Ñ…Ð°Ð´Ð³Ð°Ð»Ð°Ñ…Ð³Ò¯Ð¹. Ð­Ð½Ñ Ñ…Ò¯ÑÐ½ÑÐ³Ñ‚Ò¯Ò¯Ð´ÑÐ´ Ð·Ó©Ð²Ñ…Ó©Ð½ Edge Function (service role) Ñ…Ð°Ð½Ð´Ð°Ð½Ð°.

-- DAN нь утасны дугаар буцаадаггүй тул profile.phone заавал байх албагүй.
-- Одоогийн хэрэглэгчдийн дугаар болон profile мэдээлэл өөрчлөгдөхгүй.
alter table public.users alter column phone drop not null;
create table if not exists public.dan_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identity_hash text not null unique,
  verified_name text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dan_auth_states (
  state_hash text primary key,
  mode text not null check (mode in ('sign_in', 'sign_up', 'link')),
  link_user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dan_auth_states_link_mode_check check (
    (mode in ('sign_in', 'sign_up') and link_user_id is null)
    or (mode = 'link' and link_user_id is not null)
  )
);

create table if not exists public.dan_auth_handoffs (
  handoff_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dan_auth_states_expires_at_idx
  on public.dan_auth_states (expires_at);
create index if not exists dan_auth_handoffs_expires_at_idx
  on public.dan_auth_handoffs (expires_at);

alter table public.dan_identities enable row level security;
alter table public.dan_auth_states enable row level security;
alter table public.dan_auth_handoffs enable row level security;

-- Client Ñ‚Ð°Ð» Ð±Ð¾Ð»Ð¾Ð½ authenticated Ñ…ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð´ÑÐ´ ÑÐ´Ð³ÑÑÑ€ Ñ…Ò¯ÑÐ½ÑÐ³Ñ‚ÑÑÑ ÑÐ¼Ð°Ñ€ Ñ‡ policy
-- Ð¾Ð»Ð³Ð¾Ñ…Ð³Ò¯Ð¹. Service role Ð½ÑŒ RLS-Ð³ Ð°Ð»Ð³Ð°ÑÑ‡ Ð·Ó©Ð²Ñ…Ó©Ð½ server function-ÑƒÑƒÐ´Ð°Ð°Ñ€ Ð°ÑˆÐ¸Ð³Ð»Ð°Ð½Ð°.

create or replace function public.set_dan_identities_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dan_identities_updated_at on public.dan_identities;
create trigger set_dan_identities_updated_at
before update on public.dan_identities
for each row execute function public.set_dan_identities_updated_at();
