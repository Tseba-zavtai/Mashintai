begin;
-- One authenticated searcher per listing per UTC day. No raw queries retained.
create table if not exists public.listing_search_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  searched_on date not null default ((now() at time zone 'UTC')::date),
  primary key (user_id, job_id, searched_on)
);
create index if not exists listing_search_events_day_idx on public.listing_search_events(searched_on);
alter table public.listing_search_events enable row level security;
revoke all on public.listing_search_events from anon, authenticated;

create or replace function public.record_listing_search(listing_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if cardinality(listing_ids) > 100 then raise exception 'Too many listings'; end if;
  insert into public.listing_search_events(user_id, job_id)
  select auth.uid(), j.id from public.jobs j
  where j.id = any(listing_ids) and j.is_active = true
    and j.posted_by_id <> auth.uid()
  on conflict do nothing;
  delete from public.listing_search_events
  where searched_on < (now() at time zone 'UTC')::date - 30;
end;
$$;
revoke all on function public.record_listing_search(uuid[]) from public, anon;
grant execute on function public.record_listing_search(uuid[]) to authenticated;

create or replace function public.listing_search_demand()
returns table(job_id uuid, search_count bigint)
language sql stable security definer set search_path = '' as $$
  select e.job_id, count(*) from public.listing_search_events e
  join public.jobs j on j.id = e.job_id
  where j.is_active = true
    and e.searched_on >= (now() at time zone 'UTC')::date - 29
  group by e.job_id;
$$;
revoke all on function public.listing_search_demand() from public;
grant execute on function public.listing_search_demand() to anon, authenticated;
commit;
