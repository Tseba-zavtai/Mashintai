begin;
create table if not exists public.qpay_service_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id),
 job_id uuid references public.jobs(id),
 plan_id text not null check(plan_id in ('credit','bump','daily','weekly','monthly')),
 amount numeric not null check(amount > 0),
 invoice_id text unique,
 payment_id text unique,
 callback_secret uuid not null default gen_random_uuid(),
 qr_image text,
 bank_urls jsonb not null default '[]',
 status text not null default 'CREATING' check (status in ('CREATING','PENDING','PAID','FAILED')),
 checked_at timestamptz,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
alter table public.qpay_service_orders enable row level security;
create policy "Read own QPay orders" on public.qpay_service_orders for select to authenticated using(user_id = auth.uid());
-- Only the authenticated Edge Function returns the user's order status/QR.
-- Callback secrets must not be exposed by a SELECT * from the mobile client.
revoke all on public.qpay_service_orders from anon, authenticated;
grant all on public.qpay_service_orders to service_role;
revoke insert, update, delete on public.qpay_service_orders from anon, authenticated;

create or replace function public.finalize_qpay_service_order(p_order_id uuid, p_payment_id text, p_paid_amount numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare o public.qpay_service_orders%rowtype; days integer;
begin
 select * into o from public.qpay_service_orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if o.status='PAID' then return true; end if;
 if o.invoice_id is null or p_paid_amount is null or p_paid_amount <> o.amount or nullif(p_payment_id,'') is null then raise exception 'PAYMENT_MISMATCH'; end if;
 if o.plan_id='credit' then
  update public.users set paid_post_credits=coalesce(paid_post_credits,0)+1,
   available_post_credits=coalesce(free_post_credits,0)+coalesce(paid_post_credits,0)+1 where id=o.user_id;
 elsif o.plan_id='bump' then
  update public.jobs set bumped_at=now(), bump_count=coalesce(bump_count,0)+1, updated_at=now() where id=o.job_id and posted_by_id=o.user_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
 else
  days := case o.plan_id when 'daily' then 1 when 'weekly' then 7 when 'monthly' then 30 end;
  update public.jobs set is_sponsored=true, sponsored_until=greatest(coalesce(sponsored_until,now()),now())+make_interval(days=>days)
   where id=o.job_id and posted_by_id=o.user_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
 end if;
 update public.qpay_service_orders set status='PAID',payment_id=p_payment_id,paid_at=now() where id=o.id;
 return true;
end $$;
revoke all on function public.finalize_qpay_service_order(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.finalize_qpay_service_order(uuid,text,numeric) to service_role;

create or replace function public.reserve_qpay_service_order(p_user_id uuid,p_job_id uuid,p_plan_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.qpay_service_orders%rowtype; price integer;
begin
 -- Serializes double taps and requests from multiple devices for one account.
 perform 1 from public.users where id=p_user_id for update;
 if not found then raise exception 'USER_NOT_FOUND'; end if;
 price := case p_plan_id when 'credit' then 3000 when 'bump' then 1000 when 'daily' then 4500 when 'weekly' then 21000 when 'monthly' then 45000 end;
 if price is null then raise exception 'INVALID_PLAN'; end if;
 if p_plan_id <> 'credit' then
  perform 1 from public.jobs where id=p_job_id and posted_by_id=p_user_id;
  if not found then raise exception 'NOT_YOUR_JOB'; end if;
 else p_job_id := null;
 end if;
 select * into o from public.qpay_service_orders where user_id=p_user_id and plan_id=p_plan_id and job_id is not distinct from p_job_id
  and status in ('CREATING','PENDING') and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if found then return to_jsonb(o)||jsonb_build_object('reserved',false); end if;
 if (select count(*) from public.qpay_service_orders where user_id=p_user_id and created_at>now()-interval '1 minute')>=5 then raise exception 'RATE_LIMITED'; end if;
 insert into public.qpay_service_orders(user_id,job_id,plan_id,amount) values(p_user_id,p_job_id,p_plan_id,price) returning * into o;
 return to_jsonb(o)||jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_qpay_service_order(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_qpay_service_order(uuid,uuid,text) to service_role;

create or replace function public.claim_qpay_payment_check(p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.qpay_service_orders set checked_at=now() where id=p_order_id and status<>'PAID'
  and (checked_at is null or checked_at<now()-interval '10 seconds');
 return found;
end $$;
revoke all on function public.claim_qpay_payment_check(uuid) from public,anon,authenticated;
grant execute on function public.claim_qpay_payment_check(uuid) to service_role;
commit;
