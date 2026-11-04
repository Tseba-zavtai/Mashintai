begin;
-- Attribute paid-credit spending to store lots, FIFO. Non-store balances are never revoked.
create table public.store_credit_lots (
  receipt_id uuid primary key references public.store_purchase_receipts(id),
  user_id uuid not null,
  granted integer not null check(granted>0),
  remaining integer not null check(remaining>=0 and remaining<=granted),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index store_credit_lots_user on public.store_credit_lots(user_id,created_at,receipt_id);
alter table public.store_credit_lots enable row level security;
revoke all on public.store_credit_lots from public,anon,authenticated;
grant select,insert,update on public.store_credit_lots to service_role;

create function public.track_store_credit_spend() returns trigger
language plpgsql security definer set search_path=public as $$
declare amount integer; lot record; take integer;
begin
  if current_setting('app.store_refund_adjustment',true)='yes' then return new; end if;
  amount:=greatest(coalesce(old.paid_post_credits,0)-coalesce(new.paid_post_credits,0),0);
  for lot in select * from public.store_credit_lots where user_id=new.id and remaining>0 and revoked_at is null
    order by created_at,receipt_id for update loop
    exit when amount=0;
    take:=least(amount,lot.remaining);
    update public.store_credit_lots set remaining=remaining-take where receipt_id=lot.receipt_id;
    amount:=amount-take;
  end loop;
  return new;
end $$;
revoke all on function public.track_store_credit_spend() from public,anon,authenticated;
create trigger store_credit_spend after update of paid_post_credits on public.users
  for each row execute function public.track_store_credit_spend();

-- Keep the already-tested atomic grant implementation private behind the refund guard.
alter function public.grant_verified_store_purchase(uuid,uuid,text,text,text,text,timestamptz)
  rename to grant_verified_store_purchase_internal;
revoke all on function public.grant_verified_store_purchase_internal(uuid,uuid,text,text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
create function public.grant_verified_store_purchase(
  p_user_id uuid,p_intent_id uuid,p_platform text,p_product_id text,p_transaction_id text,
  p_environment text,p_purchased_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; credits integer; receipt_id uuid;
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  -- Refunds may arrive before client delivery. Never grant a transaction known refunded.
  -- Reversed/partial refunds require operator reconciliation, not an automatic replay grant.
  if exists(select 1 from public.store_refund_events where platform=p_platform and transaction_id=p_transaction_id
    and environment in (p_environment,'Unknown') and event_type in ('REFUND','REVOKE','VOIDED')) then
    raise exception 'PURCHASE_REFUNDED';
  end if;
  result:=public.grant_verified_store_purchase_internal(p_user_id,p_intent_id,p_platform,p_product_id,p_transaction_id,p_environment,p_purchased_at);
  credits:=case p_product_id when 'mn.tureestei.app.credit1' then 1 when 'mn.tureestei.app.credit2' then 2
    when 'mn.tureestei.app.credit3' then 3 else 0 end;
  if credits>0 and not (result->>'alreadyGranted')::boolean then
    select id into receipt_id from public.store_purchase_receipts where intent_id=p_intent_id;
    insert into public.store_credit_lots(receipt_id,user_id,granted,remaining) values(receipt_id,p_user_id,credits,credits);
  end if;
  return result;
end $$;
revoke all on function public.grant_verified_store_purchase(uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.grant_verified_store_purchase(uuid,uuid,text,text,text,text,timestamptz) to service_role;

create function public.reconcile_store_refund(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.store_refund_events%rowtype; r public.store_purchase_receipts%rowtype;
  i public.store_purchase_intents%rowtype; lot public.store_credit_lots%rowtype;
  paid integer; free integer; removed integer:=0; uid uuid;
begin
  -- Account-first lock order, shared with grant/spend. Do not acquire an event lock first.
  select si.user_id into uid from public.store_refund_events se
    join public.store_purchase_receipts sr on sr.platform=se.platform and sr.transaction_id=se.transaction_id
      and (sr.environment=se.environment or se.environment='Unknown')
    join public.store_purchase_intents si on si.id=sr.intent_id where se.id=p_event_id;
  if uid is not null then
    select coalesce(paid_post_credits,0),coalesce(free_post_credits,0) into paid,free from public.users where id=uid for update;
  end if;
  select * into e from public.store_refund_events where id=p_event_id for update;
  if not found then raise exception 'UNKNOWN_REFUND'; end if;
  if e.status='resolved' then return jsonb_build_object('alreadyResolved',true); end if;
  if e.event_type='REFUND_REVERSED' then
    update public.store_refund_events set resolution_note='Refund reversed: manual entitlement reconciliation required.' where id=e.id;
    return jsonb_build_object('needsReview',true);
  end if;
  if not e.full_refund then
    update public.store_refund_events set resolution_note='Partial or unspecified refund amount: manual review; no automatic deduction.' where id=e.id;
    return jsonb_build_object('needsReview',true);
  end if;
  select * into r from public.store_purchase_receipts where platform=e.platform and transaction_id=e.transaction_id
    and (environment=e.environment or e.environment='Unknown');
  if not found or paid is null then
    update public.store_refund_events set resolution_note='Receipt or account missing: no balance changed.' where id=e.id;
    return jsonb_build_object('needsReview',true);
  end if;
  select * into i from public.store_purchase_intents where id=r.intent_id;
  select * into lot from public.store_credit_lots where receipt_id=r.id for update;
  if not found then
    -- Exposure/bump cannot be undone, nor may we shorten unrelated QPay promotions.
    update public.store_refund_events set resolution_note='Delivered promotion or untracked historical credits: manual review; no unrelated benefits changed.' where id=e.id;
    return jsonb_build_object('needsReview',true);
  end if;
  if lot.revoked_at is not null then
    update public.store_refund_events set status='resolved',resolved_at=now(),resolution_note='Already revoked by another verified refund event.' where id=e.id;
    return jsonb_build_object('alreadyResolved',true);
  end if;
  removed:=least(lot.remaining,greatest(paid,0));
  perform set_config('app.store_refund_adjustment','yes',true);
  update public.users set paid_post_credits=paid-removed,available_post_credits=free+paid-removed where id=uid;
  perform set_config('app.store_refund_adjustment','no',true);
  update public.store_credit_lots set remaining=0,revoked_at=now() where receipt_id=r.id;
  update public.store_refund_events set
    status=case when removed=lot.granted then 'resolved' else 'needs_review' end,
    resolved_at=case when removed=lot.granted then now() else null end,
    resolution_note=format('Revoked %s unused credits of %s. Spent/unavailable credits require manual review; no debt or future deduction.',removed,lot.granted)
    where id=e.id;
  return jsonb_build_object('removedCredits',removed,'needsReview',removed<lot.granted);
end $$;
revoke all on function public.reconcile_store_refund(uuid) from public,anon,authenticated;
grant execute on function public.reconcile_store_refund(uuid) to service_role;
commit;
