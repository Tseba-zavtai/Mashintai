-- Promotion performance counters. These are updated only through the RPC below,
-- which keeps concurrent impression/click updates atomic.
alter table public.jobs
  add column if not exists sponsored_view_count bigint not null default 0,
  add column if not exists sponsored_click_count bigint not null default 0;

alter table public.banners
  add column if not exists view_count bigint not null default 0,
  add column if not exists click_count bigint not null default 0;

create or replace function public.record_promotion_metric(
  p_target_type text,
  p_target_id uuid,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  if p_target_type = 'sponsored_job' and p_event_type = 'impression' then
    update public.jobs
    set sponsored_view_count = coalesce(sponsored_view_count, 0) + 1
    where id = p_target_id
      and coalesce(is_sponsored, false)
      and sponsored_until > now()
      and posted_by_id is distinct from auth.uid();

  elsif p_target_type = 'sponsored_job' and p_event_type = 'click' then
    update public.jobs
    set sponsored_click_count = coalesce(sponsored_click_count, 0) + 1
    where id = p_target_id
      and coalesce(is_sponsored, false)
      and sponsored_until > now()
      and posted_by_id is distinct from auth.uid();

  elsif p_target_type = 'banner' and p_event_type = 'impression' then
    update public.banners
    set view_count = coalesce(view_count, 0) + 1
    where id = p_target_id
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now());

  elsif p_target_type = 'banner' and p_event_type = 'click' then
    update public.banners
    set click_count = coalesce(click_count, 0) + 1
    where id = p_target_id
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now());

  else
    return false;
  end if;

  get diagnostics affected_count = row_count;
  return affected_count > 0;
end;
$$;

revoke all on function public.record_promotion_metric(text, uuid, text) from public;
grant execute on function public.record_promotion_metric(text, uuid, text) to anon, authenticated;