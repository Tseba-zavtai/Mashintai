-- A pending rental request is only actionable for 48 hours.  Keeping the
-- terminal state as `cancelled` maintains compatibility with the existing
-- status constraint, while `expired_at` preserves why it was closed.

alter table public.rental_requests
  add column if not exists expires_at timestamptz,
  add column if not exists expired_at timestamptz;

update public.rental_requests
set expires_at = coalesce(created_at, now()) + interval '48 hours'
where status = 'pending'
  and expires_at is null;

-- Apply the rule to existing historical pending requests immediately.
update public.rental_requests
set status = 'cancelled',
    expired_at = coalesce(expired_at, now())
where status = 'pending'
  and expires_at <= now();

create index if not exists rental_requests_pending_expiry_idx
  on public.rental_requests (expires_at)
  where status = 'pending';

create or replace function public.set_pending_rental_request_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pending' and new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '48 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists set_pending_rental_request_expiry on public.rental_requests;
create trigger set_pending_rental_request_expiry
before insert on public.rental_requests
for each row execute function public.set_pending_rental_request_expiry();

-- This RPC is called whenever the requests screen refreshes.  It is also safe
-- to call from a scheduled job later, because it only changes stale pending
-- rows into a terminal state.
create or replace function public.expire_stale_rental_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer;
begin
  update public.rental_requests
  set status = 'cancelled',
      expired_at = coalesce(expired_at, now())
  where status = 'pending'
    and coalesce(expires_at, created_at + interval '48 hours') <= now();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

revoke all on function public.expire_stale_rental_requests() from public;
grant execute on function public.expire_stale_rental_requests() to authenticated;

-- The mobile UI is convenience only.  These checks stop an old app, a direct
-- API call, or a race with the listing being deactivated from approving an
-- invalid request.
create or replace function public.enforce_actionable_rental_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz;
begin
  if tg_op = 'insert' then
    if not exists (
      select 1
      from public.jobs j
      where j.id = new.job_id
        and coalesce(j.is_active, false) = true
    ) then
      raise exception 'Энэ зар идэвхгүй болсон тул түрээслэх хүсэлт илгээх боломжгүй байна.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Rejecting/cancelling is always allowed, including for a stale request.
  if old.status = 'pending' and new.status not in ('rejected', 'cancelled') then
    v_expires_at := coalesce(old.expires_at, old.created_at + interval '48 hours');
    if v_expires_at <= now() then
      raise exception 'Энэ хүсэлтийн 48 цагийн хугацаа дууссан тул зөвшөөрөх боломжгүй байна.'
        using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.jobs j
      where j.id = old.job_id
        and coalesce(j.is_active, false) = true
    ) then
      raise exception 'Энэ зар идэвхгүй болсон тул хүсэлтийг үргэлжлүүлэх боломжгүй байна.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_actionable_rental_request on public.rental_requests;
create trigger enforce_actionable_rental_request
before insert or update on public.rental_requests
for each row execute function public.enforce_actionable_rental_request();
