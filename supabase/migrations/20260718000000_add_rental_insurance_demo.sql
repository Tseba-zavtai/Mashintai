-- Optional rental-insurance demo state. One rental request can have only one payer.
alter table public.rental_requests
  add column if not exists insurance_status text not null default 'not_requested',
  add column if not exists insurance_payer_id uuid,
  add column if not exists insurance_payer_role text,
  add column if not exists insurance_premium numeric,
  add column if not exists insurance_rate_percent numeric,
  add column if not exists insurance_paid_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_insurance_status_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_insurance_status_check
      check (insurance_status in (
        'not_requested',
        'requester_declined',
        'owner_declined',
        'payment_pending_requester',
        'payment_pending_owner',
        'insured_requester',
        'insured_owner'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_insurance_payer_role_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_insurance_payer_role_check
      check (insurance_payer_role is null or insurance_payer_role in ('requester', 'owner'));
  end if;
end;
$$;

create index if not exists rental_requests_insurance_payer_id_idx
  on public.rental_requests (insurance_payer_id)
  where insurance_payer_id is not null;

-- Selects and locks the request before creating a demo payment. This prevents the
-- renter and owner from opening/finishing two insurance payments for one request.
create or replace function public.prepare_rental_insurance_demo_payment(
  p_request_id uuid,
  p_premium numeric,
  p_rate_percent numeric default 1
)
returns table (
  request_id uuid,
  insurance_status text,
  payer_role text,
  premium numeric
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request public.rental_requests%rowtype;
  v_role text;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй';
  end if;

  if p_premium is null or p_premium <= 0 then
    raise exception 'Даатгалын дүн буруу байна';
  end if;

  select * into v_request
  from public.rental_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Түрээсийн хүсэлт олдсонгүй';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Зөвхөн хүлээгдэж буй хүсэлтэд даатгал нэмж болно';
  end if;

  if auth.uid() = v_request.requester_id then
    v_role := 'requester';
    v_next_status := 'payment_pending_requester';
  elsif auth.uid() = v_request.owner_id then
    v_role := 'owner';
    v_next_status := 'payment_pending_owner';
  else
    raise exception 'Энэ хүсэлтэд даатгалын төлбөр үүсгэх эрхгүй';
  end if;

  if v_request.insurance_status in (
    'payment_pending_requester',
    'payment_pending_owner',
    'insured_requester',
    'insured_owner'
  ) then
    raise exception 'Энэ хүсэлтэд даатгалын төлбөр аль хэдийн үүссэн эсвэл төлөгдсөн байна';
  end if;

  update public.rental_requests
  set insurance_status = v_next_status,
      insurance_payer_id = auth.uid(),
      insurance_payer_role = v_role,
      insurance_premium = round(p_premium),
      insurance_rate_percent = p_rate_percent,
      insurance_paid_at = null
  where id = v_request.id;

  return query
  select v_request.id, v_next_status, v_role, round(p_premium);
end;
$$;

-- Records an explicit decision not to buy optional insurance. The decision is
-- stored so the owner can be offered insurance only when the renter declined it.
create or replace function public.decline_rental_insurance(
  p_request_id uuid,
  p_premium numeric,
  p_rate_percent numeric default 1
)
returns table (
  request_id uuid,
  insurance_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request public.rental_requests%rowtype;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй';
  end if;

  select * into v_request
  from public.rental_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Түрээсийн хүсэлт олдсонгүй';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Зөвхөн хүлээгдэж буй хүсэлтэд даатгалын сонголт хийх боломжтой';
  end if;

  if auth.uid() = v_request.requester_id then
    v_next_status := 'requester_declined';
  elsif auth.uid() = v_request.owner_id then
    v_next_status := 'owner_declined';
  else
    raise exception 'Энэ хүсэлтэд даатгалын сонголт хийх эрхгүй';
  end if;

  if v_request.insurance_status in (
    'payment_pending_requester',
    'payment_pending_owner',
    'insured_requester',
    'insured_owner'
  ) then
    raise exception 'Энэ хүсэлтийн даатгалын төлбөр аль хэдийн эхэлсэн эсвэл төлөгдсөн байна';
  end if;

  update public.rental_requests
  set insurance_status = v_next_status,
      insurance_payer_id = null,
      insurance_payer_role = null,
      insurance_premium = case when p_premium > 0 then round(p_premium) else insurance_premium end,
      insurance_rate_percent = p_rate_percent,
      insurance_paid_at = null
  where id = v_request.id;

  return query select v_request.id, v_next_status;
end;
$$;

-- This is deliberately a DEMO-only completion endpoint. A real QPay callback
-- must replace it before an insurer or a real policy is shown to users.
create or replace function public.complete_rental_insurance_demo_payment(
  p_request_id uuid
)
returns table (
  request_id uuid,
  insurance_status text,
  payer_role text,
  owner_id uuid,
  requester_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request public.rental_requests%rowtype;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй';
  end if;

  select * into v_request
  from public.rental_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Түрээсийн хүсэлт олдсонгүй';
  end if;

  if v_request.insurance_payer_id is distinct from auth.uid() then
    raise exception 'Энэ даатгалын төлбөрийг баталгаажуулах эрхгүй';
  end if;

  if v_request.insurance_status = 'payment_pending_requester' then
    v_next_status := 'insured_requester';
  elsif v_request.insurance_status = 'payment_pending_owner' then
    v_next_status := 'insured_owner';
  else
    raise exception 'Энэ даатгалын төлбөр төлөх хүлээгдэж буй төлөвт байхгүй байна';
  end if;

  update public.rental_requests
  set insurance_status = v_next_status,
      insurance_paid_at = now()
  where id = v_request.id;

  if v_next_status = 'insured_requester' then
    insert into public.notifications (user_id, title, content, is_read, type, reference_id)
    values (
      v_request.owner_id,
      'Даатгалтай түрээсийн хүсэлт',
      'Түрээслэгч даатгалын demo төлбөрөө баталгаажууллаа. Хүсэлтийг шалгана уу.',
      false,
      'rental_request',
      v_request.id
    );
  end if;

  return query
  select v_request.id, v_next_status, v_request.insurance_payer_role, v_request.owner_id, v_request.requester_id;
end;
$$;

revoke all on function public.prepare_rental_insurance_demo_payment(uuid, numeric, numeric) from public;
revoke all on function public.decline_rental_insurance(uuid, numeric, numeric) from public;
revoke all on function public.complete_rental_insurance_demo_payment(uuid) from public;
grant execute on function public.prepare_rental_insurance_demo_payment(uuid, numeric, numeric) to authenticated;
grant execute on function public.decline_rental_insurance(uuid, numeric, numeric) to authenticated;
grant execute on function public.complete_rental_insurance_demo_payment(uuid) to authenticated;
