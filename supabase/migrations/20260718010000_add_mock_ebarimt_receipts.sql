-- Test-only Ebarimt flow for Tureesly's own paid services.
-- This migration does not communicate with ebarimt.mn and does not create an
-- official tax receipt. It creates a persistent mock receipt for QA only.

alter table public.payments
  add column if not exists service_type text,
  add column if not exists service_name text,
  add column if not exists reference_id text;

create table if not exists public.mock_ebarimt_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  user_id uuid not null,
  receipt_no text not null unique,
  service_type text not null check (service_type in ('post_credit', 'bump', 'sponsored')),
  service_name text not null,
  amount numeric not null check (amount > 0),
  vat_rate numeric not null default 0 check (vat_rate = 0),
  vat_amount numeric not null default 0 check (vat_amount = 0),
  total_amount numeric not null check (total_amount > 0),
  status text not null default 'mock_issued' check (status = 'mock_issued'),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists mock_ebarimt_receipts_user_issued_idx
  on public.mock_ebarimt_receipts (user_id, issued_at desc);

create sequence if not exists public.mock_ebarimt_receipt_sequence;

alter table public.mock_ebarimt_receipts enable row level security;

drop policy if exists mock_ebarimt_receipts_select_own on public.mock_ebarimt_receipts;
create policy mock_ebarimt_receipts_select_own
  on public.mock_ebarimt_receipts
  for select
  to authenticated
  using (user_id = auth.uid());

-- The mock "payment confirmation" and receipt are written atomically. When real
-- QPay/Ebarimt credentials arrive, this RPC is replaced by a server-side QPay
-- verification followed by the real POSAPI 3.0 request.
create or replace function public.record_mock_service_payment_and_receipt(
  p_service_type text,
  p_service_name text,
  p_amount numeric,
  p_reference_id text default null
)
returns table (
  payment_id uuid,
  receipt_id uuid,
  receipt_no text,
  service_name text,
  amount numeric,
  vat_rate numeric,
  vat_amount numeric,
  total_amount numeric,
  issued_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_payment public.payments%rowtype;
  v_receipt public.mock_ebarimt_receipts%rowtype;
  v_receipt_no text;
  v_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'Нэвтэрсэн хэрэглэгч олдсонгүй';
  end if;

  if p_service_type not in ('post_credit', 'bump', 'sponsored') then
    raise exception 'Үйлчилгээний төрөл буруу байна';
  end if;

  if nullif(trim(coalesce(p_service_name, '')), '') is null then
    raise exception 'Үйлчилгээний нэр хоосон байна';
  end if;

  v_amount := round(coalesce(p_amount, 0));
  if v_amount <= 0 then
    raise exception 'Төлбөрийн дүн буруу байна';
  end if;

  insert into public.payments (
    user_id,
    amount,
    payment_method,
    status,
    paid_at,
    service_type,
    service_name,
    reference_id
  )
  values (
    auth.uid(),
    v_amount,
    'qpay',
    'success',
    now(),
    p_service_type,
    trim(p_service_name),
    nullif(trim(coalesce(p_reference_id, '')), '')
  )
  returning * into v_payment;

  v_receipt_no := 'MOCK-' || to_char(now() at time zone 'Asia/Ulaanbaatar', 'YYYYMMDD') || '-' ||
    lpad(nextval('public.mock_ebarimt_receipt_sequence')::text, 7, '0');

  insert into public.mock_ebarimt_receipts (
    payment_id,
    user_id,
    receipt_no,
    service_type,
    service_name,
    amount,
    vat_rate,
    vat_amount,
    total_amount,
    status,
    issued_at
  )
  values (
    v_payment.id,
    auth.uid(),
    v_receipt_no,
    p_service_type,
    trim(p_service_name),
    v_amount,
    0,
    0,
    v_amount,
    'mock_issued',
    now()
  )
  returning * into v_receipt;

  return query
  select
    v_payment.id,
    v_receipt.id,
    v_receipt.receipt_no,
    v_receipt.service_name,
    v_receipt.amount,
    v_receipt.vat_rate,
    v_receipt.vat_amount,
    v_receipt.total_amount,
    v_receipt.issued_at;
end;
$$;

revoke all on function public.record_mock_service_payment_and_receipt(text, text, numeric, text) from public;
grant execute on function public.record_mock_service_payment_and_receipt(text, text, numeric, text) to authenticated;
