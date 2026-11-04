begin;

-- Backend-only intent + ledger. No client may manufacture a successful store purchase.
-- User IDs intentionally have no cascading FK: retain the minimal payment ledger after account deletion.
create table public.store_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null check (platform in ('ios','android')),
  product_id text not null check (product_id in (
    'mn.tureestei.app.credit1','mn.tureestei.app.credit2','mn.tureestei.app.credit3',
    'mn.tureestei.app.Pump','mn.tureestei.app.bump','mn.tureestei.app.sponsor1','mn.tureestei.app.sponsor2','mn.tureestei.app.sponsor3')),
  job_id uuid,
  created_at timestamptz not null default now()
);
create index store_purchase_intents_user_time on public.store_purchase_intents(user_id,created_at);
alter table public.store_purchase_intents enable row level security;
revoke all on public.store_purchase_intents from public,anon,authenticated;
grant select,insert on public.store_purchase_intents to service_role;

create table public.store_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references public.store_purchase_intents(id),
  platform text not null check (platform in ('ios','android')),
  transaction_id text not null,
  environment text not null check (environment in ('Production','Sandbox')),
  purchased_at timestamptz not null,
  granted_at timestamptz not null default now(),
  unique(platform,environment,transaction_id)
);
alter table public.store_purchase_receipts enable row level security;
revoke all on public.store_purchase_receipts from public,anon,authenticated;
grant select,insert on public.store_purchase_receipts to service_role;

create or replace function public.prepare_store_purchase(
  p_user_id uuid,p_platform text,p_product_id text,p_job_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare intent_id uuid; j public.jobs%rowtype;
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  if p_platform not in ('ios','android') or p_platform is null then raise exception 'INVALID_SELECTION'; end if;
  if p_product_id not in ('mn.tureestei.app.credit1','mn.tureestei.app.credit2','mn.tureestei.app.credit3',
    'mn.tureestei.app.Pump','mn.tureestei.app.bump','mn.tureestei.app.sponsor1','mn.tureestei.app.sponsor2','mn.tureestei.app.sponsor3')
    or p_product_id is null then raise exception 'INVALID_SELECTION'; end if;
  if (p_platform='ios' and p_product_id='mn.tureestei.app.bump')
    or (p_platform='android' and p_product_id='mn.tureestei.app.Pump') then raise exception 'INVALID_SELECTION'; end if;
  if p_product_id like 'mn.tureestei.app.credit%' then
    if p_job_id is not null then raise exception 'INVALID_SELECTION'; end if;
  else
    select * into j from public.jobs where id=p_job_id for update;
    if not found or j.posted_by_id is distinct from p_user_id or j.deleted_at is not null then raise exception 'NOT_YOUR_JOB'; end if;
    if j.listing_expires_at<=now() then raise exception 'LISTING_EXPIRED'; end if;
    if not coalesce(j.is_active,false) then raise exception 'LISTING_INACTIVE'; end if;
    if coalesce(j.available_quantity,0)<=0 then raise exception 'NO_AVAILABLE_QUANTITY'; end if;
    if p_product_id not in ('mn.tureestei.app.Pump','mn.tureestei.app.bump') and j.sponsored_until>now() then raise exception 'ALREADY_SPONSORED'; end if;
    if exists(select 1 from public.qpay_service_orders where user_id=p_user_id
      and status in ('CREATING','PENDING') and (job_id=p_job_id or p_job_id=any(job_ids))) then raise exception 'INVALID_SELECTION'; end if;
  end if;
  if (select count(*) from public.store_purchase_intents where user_id=p_user_id and created_at>now()-interval '1 minute')>=5
    then raise exception 'RATE_LIMITED'; end if;
  insert into public.store_purchase_intents(user_id,platform,product_id,job_id)
    values(p_user_id,p_platform,p_product_id,p_job_id) returning id into intent_id;
  return intent_id;
end $$;
revoke all on function public.prepare_store_purchase(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_store_purchase(uuid,text,text,uuid) to service_role;

create or replace function public.grant_verified_store_purchase(
  p_user_id uuid,p_intent_id uuid,p_platform text,p_product_id text,p_transaction_id text,
  p_environment text,p_purchased_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.store_purchase_intents%rowtype; receipt public.store_purchase_receipts%rowtype;
  credits integer; duration integer;
begin
  -- Same account-first lock order as existing credit/payment functions.
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  select * into i from public.store_purchase_intents where id=p_intent_id for update;
  if not found or i.user_id is distinct from p_user_id or i.platform is distinct from p_platform
    or i.product_id is distinct from p_product_id or nullif(p_transaction_id,'') is null
    or p_environment not in ('Production','Sandbox') or p_environment is null or p_purchased_at is null
    or p_purchased_at<i.created_at-interval '5 minutes' then raise exception 'PURCHASE_MISMATCH'; end if;
  select * into receipt from public.store_purchase_receipts where intent_id=i.id;
  if found then
    if receipt.platform is distinct from p_platform or receipt.transaction_id is distinct from p_transaction_id
      or receipt.environment is distinct from p_environment then raise exception 'PURCHASE_ALREADY_USED'; end if;
    return jsonb_build_object('alreadyGranted',true,'planId',i.product_id);
  end if;
  -- Unique store transaction + unique intent, in the SAME transaction as the entitlement write.
  insert into public.store_purchase_receipts(intent_id,platform,transaction_id,environment,purchased_at)
    values(i.id,p_platform,p_transaction_id,p_environment,p_purchased_at);
  credits:=case i.product_id when 'mn.tureestei.app.credit1' then 1 when 'mn.tureestei.app.credit2' then 2
    when 'mn.tureestei.app.credit3' then 3 else 0 end;
  if credits>0 then
    update public.users set paid_post_credits=coalesce(paid_post_credits,0)+credits,
      available_post_credits=coalesce(free_post_credits,0)+coalesce(paid_post_credits,0)+credits where id=i.user_id;
  else
    perform 1 from public.jobs where id=i.job_id and posted_by_id=i.user_id and deleted_at is null for update;
    if not found then raise exception 'NOT_YOUR_JOB'; end if;
    -- A delayed payment can renew an expired listing, but never changes inventory or pause state.
    update public.jobs set published_at=now(),listing_expires_at=greatest(coalesce(listing_expires_at,now()),now()+interval '30 days'),
      updated_at=now() where id=i.job_id;
    if i.product_id in ('mn.tureestei.app.Pump','mn.tureestei.app.bump') then
      update public.jobs set bumped_at=now(),last_bumped_at=now(),bump_count=coalesce(bump_count,0)+1 where id=i.job_id;
    else
      duration:=case i.product_id when 'mn.tureestei.app.sponsor1' then 1 when 'mn.tureestei.app.sponsor2' then 7
        when 'mn.tureestei.app.sponsor3' then 30 end;
      if duration is null then raise exception 'PURCHASE_MISMATCH'; end if;
      update public.jobs set is_sponsored=true,
        sponsored_until=greatest(coalesce(sponsored_until,now()),now())+make_interval(days=>duration) where id=i.job_id;
    end if;
  end if;
  return jsonb_build_object('alreadyGranted',false,'planId',i.product_id);
end $$;
revoke all on function public.grant_verified_store_purchase(uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.grant_verified_store_purchase(uuid,uuid,text,text,text,text,timestamptz) to service_role;
commit;
