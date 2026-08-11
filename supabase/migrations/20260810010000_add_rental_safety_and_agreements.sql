-- Rental safety V1: recorded agreement, dispute intake, and time-limited suspensions.
-- This migration deliberately does NOT collect or hold a deposit. A deposit amount is
-- recorded only as an agreed term until a compliant payment/escrow product is introduced.

alter table public.users
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null;

alter table public.rental_requests
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists agreement_snapshot jsonb,
  add column if not exists owner_agreed_at timestamptz,
  add column if not exists requester_agreed_at timestamptz,
  add column if not exists agreement_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_requests_deposit_amount_nonnegative'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_deposit_amount_nonnegative
      check (deposit_amount >= 0);
  end if;
end;
$$;

-- The app uses this check both from the database and from RPC functions. It is
-- security-definer because users may not read every profile row under future RLS rules.
create or replace function public.is_account_currently_suspended(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = p_user_id
      and suspended_until is not null
      and suspended_until > now()
  );
$$;

revoke all on function public.is_account_currently_suspended(uuid) from public;
grant execute on function public.is_account_currently_suspended(uuid) to authenticated;

create or replace function public.require_active_rental_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  -- Service-role jobs have no end-user JWT. They are intentionally not blocked here.
  if v_actor_id is null or not public.is_account_currently_suspended(v_actor_id) then
    if tg_op = 'delete' then
      return old;
    end if;
    return new;
  end if;

  -- A suspended renter may still record that the item was returned. This reduces
  -- risk to the owner instead of trapping an active rental in an unusable state.
  if tg_table_name = 'rental_requests'
     and tg_op = 'update'
     and v_actor_id = old.requester_id
     and old.status = 'in_rent'
     and new.status = 'paid' then
    return new;
  end if;

  raise exception 'Таны account түр түгжигдсэн тул энэ үйлдлийг хийх боломжгүй байна.'
    using errcode = '42501';
end;
$$;

drop trigger if exists require_active_rental_request_account on public.rental_requests;
create trigger require_active_rental_request_account
before insert or update or delete on public.rental_requests
for each row execute function public.require_active_rental_account();

drop trigger if exists require_active_job_account on public.jobs;
create trigger require_active_job_account
before insert or update or delete on public.jobs
for each row execute function public.require_active_rental_account();

-- The owner creates an immutable terms snapshot when approving a request. The
-- renter must accept it before the existing handover flow may start.
create or replace function public.approve_rental_with_agreement(
  p_request_id uuid,
  p_deposit_amount numeric
)
returns public.rental_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.rental_requests%rowtype;
  v_job record;
  v_deposit numeric(12, 2) := round(coalesce(p_deposit_amount, 0), 2);
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй' using errcode = '42501';
  end if;
  if public.is_account_currently_suspended(auth.uid()) then
    raise exception 'Таны account түр түгжигдсэн тул энэ үйлдлийг хийх боломжгүй байна.' using errcode = '42501';
  end if;
  if v_deposit < 0 then
    raise exception 'Барьцааны дүн сөрөг байж болохгүй' using errcode = '22023';
  end if;

  select * into v_request
  from public.rental_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Түрээсийн хүсэлт олдсонгүй' using errcode = 'P0002';
  end if;
  if v_request.owner_id <> auth.uid() then
    raise exception 'Энэ хүсэлтийг зөвшөөрөх эрхгүй байна' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Зөвхөн хүлээгдэж буй хүсэлтийг зөвшөөрнө' using errcode = 'P0001';
  end if;
  if public.is_account_currently_suspended(v_request.requester_id) then
    raise exception 'Түрээслэгчийн account түр түгжигдсэн байна' using errcode = '42501';
  end if;

  select id, title, category, subcategory
  into v_job
  from public.jobs
  where id = v_request.job_id;

  update public.rental_requests
  set status = 'approved',
      deposit_amount = v_deposit,
      agreement_snapshot = jsonb_build_object(
        'version', 1,
        'created_at', now(),
        'job_id', v_request.job_id,
        'title', coalesce(v_job.title, v_job.subcategory, v_job.category, 'Түрээсийн бараа'),
        'quantity', coalesce(v_request.quantity, 1),
        'rent_days', coalesce(v_request.rent_days, 0),
        'rental_total', coalesce(v_request.total_price, 0),
        'deposit_amount', v_deposit
      ),
      owner_agreed_at = now(),
      requester_agreed_at = null,
      agreement_completed_at = null
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.accept_rental_agreement(p_request_id uuid)
returns public.rental_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.rental_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй' using errcode = '42501';
  end if;
  if public.is_account_currently_suspended(auth.uid()) then
    raise exception 'Таны account түр түгжигдсэн тул энэ үйлдлийг хийх боломжгүй байна.' using errcode = '42501';
  end if;

  select * into v_request
  from public.rental_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Түрээсийн хүсэлт олдсонгүй' using errcode = 'P0002';
  end if;
  if v_request.requester_id <> auth.uid() then
    raise exception 'Энэ нөхцөлийг зөвшөөрөх эрхгүй байна' using errcode = '42501';
  end if;
  if v_request.status <> 'approved' or v_request.owner_agreed_at is null or v_request.agreement_snapshot is null then
    raise exception 'Эзний баталгаажуулсан нөхцөл олдсонгүй' using errcode = 'P0001';
  end if;
  if public.is_account_currently_suspended(v_request.owner_id) then
    raise exception 'Эзэмшигчийн account түр түгжигдсэн байна' using errcode = '42501';
  end if;

  update public.rental_requests
  set requester_agreed_at = coalesce(requester_agreed_at, now())
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

-- New agreement requests must have renter consent before they enter handover.
-- Older, pre-migration requests have no owner_agreed_at and stay compatible.
create or replace function public.enforce_rental_agreement_handover()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'update'
     and old.status is distinct from new.status
     and new.status = 'handover_requested'
     and new.owner_agreed_at is not null
     and new.requester_agreed_at is null then
    raise exception 'Түрээслэгч эхлээд барьцаа, гэрээний нөхцөлийг зөвшөөрнө үү.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rental_agreement_handover on public.rental_requests;
create trigger enforce_rental_agreement_handover
before update on public.rental_requests
for each row execute function public.enforce_rental_agreement_handover();

create table if not exists public.rental_disputes (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null references public.rental_requests(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reported_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('not_returned', 'damaged', 'payment', 'conduct', 'other')),
  description text not null check (char_length(trim(description)) between 10 and 3000),
  evidence_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_urls) = 'array'),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create unique index if not exists rental_disputes_one_open_reporter_idx
  on public.rental_disputes (rental_request_id, reporter_id)
  where status in ('open', 'under_review');
create index if not exists rental_disputes_reported_user_idx on public.rental_disputes (reported_user_id, created_at desc);
create index if not exists rental_disputes_status_created_idx on public.rental_disputes (status, created_at desc);

alter table public.rental_disputes enable row level security;

drop policy if exists rental_disputes_select_reporter_or_admin on public.rental_disputes;
create policy rental_disputes_select_reporter_or_admin
  on public.rental_disputes
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_super_admin());

drop policy if exists rental_disputes_insert_participant on public.rental_disputes;
create policy rental_disputes_insert_participant
  on public.rental_disputes
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.rental_requests rr
      where rr.id = rental_request_id
        and (rr.requester_id = auth.uid() or rr.owner_id = auth.uid())
        and reported_user_id = case when rr.requester_id = auth.uid() then rr.owner_id else rr.requester_id end
        and rr.status not in ('pending', 'rejected', 'cancelled')
    )
  );

drop policy if exists rental_disputes_update_super_admin on public.rental_disputes;
create policy rental_disputes_update_super_admin
  on public.rental_disputes
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.set_rental_disputes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
    new.resolved_at = now();
    new.resolved_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_rental_disputes_updated_at on public.rental_disputes;
create trigger set_rental_disputes_updated_at
before update on public.rental_disputes
for each row execute function public.set_rental_disputes_updated_at();

revoke all on function public.approve_rental_with_agreement(uuid, numeric) from public;
revoke all on function public.accept_rental_agreement(uuid) from public;
grant execute on function public.approve_rental_with_agreement(uuid, numeric) to authenticated;
grant execute on function public.accept_rental_agreement(uuid) to authenticated;
