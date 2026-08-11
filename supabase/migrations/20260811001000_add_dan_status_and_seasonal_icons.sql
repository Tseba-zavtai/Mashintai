-- A public, non-sensitive marker for a successfully linked DAN identity.
-- It intentionally stores no registration number, address, or identity details.
alter table public.users
  add column if not exists dan_verified_at timestamptz;

-- Backfill accounts that were linked before this marker existed.
update public.users profile
set dan_verified_at = coalesce(identity.verified_at, now())
from public.dan_identities identity
where identity.user_id = profile.id
  and profile.dan_verified_at is null;

create or replace function public.sync_user_dan_verified_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set dan_verified_at = coalesce(new.verified_at, now())
  where id = new.user_id
    and (
      dan_verified_at is null
      or dan_verified_at < coalesce(new.verified_at, now())
    );

  return new;
end;
$$;

drop trigger if exists sync_user_dan_verified_at on public.dan_identities;
create trigger sync_user_dan_verified_at
after insert or update of verified_at on public.dan_identities
for each row execute function public.sync_user_dan_verified_at();

-- The app needs only one safe public signal for a listing owner. This function
-- never returns a registry number, legal name, home address, or DAN token.
create or replace function public.get_dan_verification_statuses(p_user_ids uuid[])
returns table (id uuid, is_dan_verified boolean)
language sql
stable
security definer
set search_path = public
as $dan_status$
  select profile.id, (profile.dan_verified_at is not null)
  from public.users profile
  where profile.id = any(coalesce(p_user_ids, array[]::uuid[]));
$dan_status$;

revoke all on function public.get_dan_verification_statuses(uuid[]) from public;
grant execute on function public.get_dan_verification_statuses(uuid[]) to authenticated;

-- The Seasonal icon is selected by the super admin, not hard-coded in the app.
alter table public.seasonal_collections
  add column if not exists icon_key text not null default 'sparkles';

alter table public.seasonal_collections
  drop constraint if exists seasonal_collections_icon_key_check;

alter table public.seasonal_collections
  add constraint seasonal_collections_icon_key_check
  check (icon_key in (
    'sparkles',
    'snowflake',
    'sun',
    'cloud_sun',
    'cloud_rain',
    'cloud_lightning',
    'party',
    'flag'
  ));
