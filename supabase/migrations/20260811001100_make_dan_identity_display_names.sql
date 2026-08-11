-- A DAN-verified account uses an immutable public name derived from its legal
-- name. The registry number and full legal name remain private in
-- dan_identities and are never returned to the client.
create or replace function public.format_dan_display_name(verified_name text)
returns text
language sql
immutable
set search_path = public
as $$
  with name_parts as (
    select regexp_split_to_array(nullif(trim(verified_name), ''), '\\s+') as parts
  )
  select case
    when parts is null then null
    when cardinality(parts) = 1 then parts[1]
    else upper(left(parts[1], 1)) || '. ' || parts[cardinality(parts)]
  end
  from name_parts;
$$;

-- Give already-linked accounts their DAN-derived public display name.
update public.users profile
set name = coalesce(public.format_dan_display_name(identity.verified_name), profile.name)
from public.dan_identities identity
where identity.user_id = profile.id;

-- A verified legal display name cannot later be replaced through a direct
-- client update. Profile photo and contact phone remain independently editable.
create or replace function public.prevent_dan_verified_name_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.dan_verified_at is not null
     and new.name is distinct from old.name then
    raise exception 'DAN-verified display name cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_dan_verified_name_change on public.users;
create trigger prevent_dan_verified_name_change
before update on public.users
for each row execute function public.prevent_dan_verified_name_change();

-- Keep the public display name in sync whenever a DAN identity is linked.
create or replace function public.sync_user_dan_verified_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    dan_verified_at = coalesce(new.verified_at, now()),
    name = coalesce(public.format_dan_display_name(new.verified_name), name)
  where id = new.user_id
    and (
      dan_verified_at is null
      or dan_verified_at < coalesce(new.verified_at, now())
    );

  return new;
end;
$$;
