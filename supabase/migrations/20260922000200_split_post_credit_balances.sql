-- Free monthly listing credits and paid listing credits have different rules:
-- free credits reset to two at the start of a new Ulaanbaatar calendar month,
-- while paid credits never expire. Keep the legacy total column in sync so
-- older installed builds continue to behave safely during rollout.
begin;

alter table public.users
  add column if not exists post_credit_last_granted_month date;

alter table public.users
  add column if not exists free_post_credits integer;

alter table public.users
  add column if not exists paid_post_credits integer;

-- One completed credit use has a one-time token. The token lets the app return
-- a credit only when its own job creation fails; it cannot be reused to mint
-- arbitrary credits.
alter table public.users
  add column if not exists last_post_credit_consumption_id uuid;

alter table public.users
  add column if not exists last_post_credit_consumed_from text;

alter table public.users
  add column if not exists last_post_credit_restored_at timestamptz;

alter table public.users
  alter column free_post_credits set default 2;

alter table public.users
  alter column paid_post_credits set default 0;

alter table public.users
  alter column post_credit_last_granted_month
  set default date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date;

-- Preserve every existing balance. Up to two credits become this month's
-- allowance; any remainder is preserved as paid credit rather than discarded.
update public.users
set free_post_credits = least(greatest(coalesce(available_post_credits, 0), 0), 2),
    paid_post_credits = greatest(coalesce(available_post_credits, 0) - 2, 0)
where free_post_credits is null
   or paid_post_credits is null;

update public.users
set free_post_credits = coalesce(free_post_credits, 0),
    paid_post_credits = coalesce(paid_post_credits, 0);

alter table public.users
  alter column free_post_credits set not null;

alter table public.users
  alter column paid_post_credits set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_free_post_credits_nonnegative'
  ) then
    alter table public.users
      add constraint users_free_post_credits_nonnegative check (free_post_credits >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_paid_post_credits_nonnegative'
  ) then
    alter table public.users
      add constraint users_paid_post_credits_nonnegative check (paid_post_credits >= 0);
  end if;
end;
$$;

update public.users
set available_post_credits = free_post_credits + paid_post_credits
where available_post_credits is distinct from free_post_credits + paid_post_credits;

update public.users
set post_credit_last_granted_month = date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date
where post_credit_last_granted_month is null;

-- A mock payment receipt can grant a test credit only once. This column is
-- test-only and will be superseded by a real server-verified QPay receipt.
alter table public.mock_ebarimt_receipts
  add column if not exists post_credit_granted_at timestamptz;

create or replace function public.refresh_post_credit_balance()
returns table (
  free_credits integer,
  paid_credits integer,
  total_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_month date := date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date;
  v_free integer;
  v_paid integer;
  v_legacy_total integer;
  v_last_granted_month date;
  v_difference integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select
    coalesce(u.free_post_credits, 0),
    coalesce(u.paid_post_credits, 0),
    coalesce(u.available_post_credits, 0),
    u.post_credit_last_granted_month
  into v_free, v_paid, v_legacy_total, v_last_granted_month
  from public.users u
  where u.id = auth.uid()
  for update;

  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  -- Older installed builds only change available_post_credits. Reconcile that
  -- value here so a mixed-version rollout neither creates nor loses a right.
  if v_legacy_total < v_free + v_paid then
    v_difference := (v_free + v_paid) - v_legacy_total;
    if v_difference <= v_free then
      v_free := v_free - v_difference;
    else
      v_paid := greatest(v_paid - (v_difference - v_free), 0);
      v_free := 0;
    end if;
  elsif v_legacy_total > v_free + v_paid then
    v_paid := v_paid + (v_legacy_total - v_free - v_paid);
  end if;

  if coalesce(v_last_granted_month, date '1900-01-01') < v_current_month then
    v_free := 2;
    v_last_granted_month := v_current_month;
  end if;

  update public.users
  set free_post_credits = v_free,
      paid_post_credits = v_paid,
      available_post_credits = v_free + v_paid,
      post_credit_last_granted_month = v_last_granted_month
  where id = auth.uid();

  return query select v_free, v_paid, v_free + v_paid;
end;
$$;

-- Preserve the existing RPC name for people who still have an older build.
create or replace function public.grant_monthly_post_credits_if_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  perform public.refresh_post_credit_balance();

  select coalesce(u.available_post_credits, 0)
  into v_total
  from public.users u
  where u.id = auth.uid();

  return coalesce(v_total, 0);
end;
$$;

create or replace function public.consume_post_credit()
returns table (
  consumption_id uuid,
  consumed_from text,
  free_credits integer,
  paid_credits integer,
  total_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free integer;
  v_paid integer;
  v_source text;
  v_consumption_id uuid := gen_random_uuid();
begin
  perform public.refresh_post_credit_balance();

  select coalesce(u.free_post_credits, 0), coalesce(u.paid_post_credits, 0)
  into v_free, v_paid
  from public.users u
  where u.id = auth.uid()
  for update;

  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  if v_free > 0 then
    v_free := v_free - 1;
    v_source := 'free';
  elsif v_paid > 0 then
    v_paid := v_paid - 1;
    v_source := 'paid';
  else
    raise exception 'POST_CREDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  update public.users
  set free_post_credits = v_free,
      paid_post_credits = v_paid,
      available_post_credits = v_free + v_paid,
      last_post_credit_consumption_id = v_consumption_id,
      last_post_credit_consumed_from = v_source,
      last_post_credit_restored_at = null
  where id = auth.uid();

  return query select v_consumption_id, v_source, v_free, v_paid, v_free + v_paid;
end;
$$;

-- A credit can be restored only once and only using the matching token created
-- by consume_post_credit(). This prevents a client from repeatedly minting
-- credits by calling a public restore RPC.
drop function if exists public.restore_post_credit(text);

create or replace function public.restore_post_credit(p_consumption_id uuid)
returns table (
  free_credits integer,
  paid_credits integer,
  total_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free integer;
  v_paid integer;
  v_source text;
  v_last_consumption_id uuid;
  v_restored_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select
    coalesce(u.free_post_credits, 0),
    coalesce(u.paid_post_credits, 0),
    u.last_post_credit_consumed_from,
    u.last_post_credit_consumption_id,
    u.last_post_credit_restored_at
  into v_free, v_paid, v_source, v_last_consumption_id, v_restored_at
  from public.users u
  where u.id = auth.uid()
  for update;

  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  if p_consumption_id is null
     or p_consumption_id is distinct from v_last_consumption_id
     or v_restored_at is not null
     or v_source not in ('free', 'paid') then
    raise exception 'POST_CREDIT_RESTORE_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if v_source = 'free' then
    v_free := v_free + 1;
  else
    v_paid := v_paid + 1;
  end if;

  update public.users
  set free_post_credits = v_free,
      paid_post_credits = v_paid,
      available_post_credits = v_free + v_paid,
      last_post_credit_restored_at = now()
  where id = auth.uid();

  return query select v_free, v_paid, v_free + v_paid;
end;
$$;
-- Test-only grant: a mock receipt belongs to the signed-in user and can be
-- consumed only once. Replace this with QPay server verification before launch.
create or replace function public.grant_test_purchased_post_credit(p_payment_id uuid)
returns table (
  free_credits integer,
  paid_credits integer,
  total_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free integer;
  v_paid integer;
  v_granted_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform public.refresh_post_credit_balance();

  select receipt.post_credit_granted_at
  into v_granted_at
  from public.mock_ebarimt_receipts receipt
  where receipt.payment_id = p_payment_id
    and receipt.user_id = auth.uid()
    and receipt.service_type = 'post_credit'
  for update;

  if not found then
    raise exception 'TEST_CREDIT_RECEIPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(u.free_post_credits, 0), coalesce(u.paid_post_credits, 0)
  into v_free, v_paid
  from public.users u
  where u.id = auth.uid()
  for update;

  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  -- Retrying the same completed test payment returns the existing balance;
  -- it never grants a second credit.
  if v_granted_at is not null then
    return query select v_free, v_paid, v_free + v_paid;
    return;
  end if;

  update public.mock_ebarimt_receipts
  set post_credit_granted_at = now()
  where payment_id = p_payment_id;

  v_paid := v_paid + 1;

  update public.users
  set paid_post_credits = v_paid,
      available_post_credits = v_free + v_paid
  where id = auth.uid();

  return query select v_free, v_paid, v_free + v_paid;
end;
$$;
revoke all on function public.refresh_post_credit_balance() from public;
revoke all on function public.grant_monthly_post_credits_if_due() from public;
revoke all on function public.consume_post_credit() from public;
revoke all on function public.restore_post_credit(uuid) from public;
revoke all on function public.grant_test_purchased_post_credit(uuid) from public;

grant execute on function public.refresh_post_credit_balance() to authenticated;
grant execute on function public.grant_monthly_post_credits_if_due() to authenticated;
grant execute on function public.consume_post_credit() to authenticated;
grant execute on function public.restore_post_credit(uuid) to authenticated;
grant execute on function public.grant_test_purchased_post_credit(uuid) to authenticated;

commit;