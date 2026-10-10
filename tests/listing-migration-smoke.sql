begin;

alter table public.jobs add column published_at timestamptz;
alter table public.jobs add column listing_expires_at timestamptz;
alter table public.jobs add column deleted_at timestamptz;
update public.jobs set published_at=created_at,
 listing_expires_at=greatest(created_at+interval '30 days',coalesce(sponsored_until,created_at+interval '30 days'));
alter table public.jobs alter column published_at set default now();
alter table public.jobs alter column published_at set not null;
alter table public.jobs alter column listing_expires_at set default (now()+interval '30 days');
alter table public.jobs alter column listing_expires_at set not null;

-- Preserve the existing view column order for installed clients.
create or replace view public.active_jobs_v as
select id,title,description,salary,location,latitude,longitude,category,urgency,
 is_sponsored,posted_by_id,posted_by_name,posted_by_phone,posted_by_photo,applicants,
 created_at,updated_at,address,post_type,is_active,sponsored_until,subcategory,
 subcategory_id,image_urls,image_url,category_id,item_rating_avg,item_review_count,
 rental_count,bumped_at,bump_count,quantity,available_quantity,price,last_bumped_at,
 1 as bump_priority,published_at,listing_expires_at
from public.jobs where listing_expires_at>now() and deleted_at is null;

create or replace function public.guard_listing_lifecycle() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   new.published_at:=now(); new.listing_expires_at:=now()+interval '30 days'; new.deleted_at:=null;
  elsif new.published_at is distinct from old.published_at
    or new.listing_expires_at is distinct from old.listing_expires_at
    or new.created_at is distinct from old.created_at or new.deleted_at is distinct from old.deleted_at then
   raise exception 'LISTING_LIFETIME_SERVER_ONLY';
  elsif not coalesce(old.is_active,false) and coalesce(new.is_active,false) then
   if old.listing_expires_at<=now() then raise exception 'POST_CREDIT_REQUIRED'; end if;
   if coalesce(new.available_quantity,0)<=0 then raise exception 'NO_AVAILABLE_QUANTITY'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_listing_lifecycle before insert or update on public.jobs
 for each row execute function public.guard_listing_lifecycle();

create or replace function public.manage_own_listings(p_ids uuid[],p_action text)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer; expired_count integer; free_count integer; paid_count integer; take_free integer;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 if p_action not in ('activate','deactivate','delete') or cardinality(p_ids) not between 1 and 100
   or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'INVALID_SELECTION'; end if;
 -- All money-changing workflows lock account, then listings in stable order.
 perform public.refresh_post_credit_balance();
 select coalesce(free_post_credits,0),coalesce(paid_post_credits,0) into free_count,paid_count
 from public.users where id=auth.uid() for update;
 perform 1 from public.jobs where id=any(p_ids) order by id for update;
 select count(*) into n from public.jobs where id=any(p_ids) and posted_by_id=auth.uid() and deleted_at is null;
 if n<>cardinality(p_ids) then raise exception 'NOT_YOUR_JOB'; end if;
 if p_action='activate' then
  if exists(select 1 from public.jobs where id=any(p_ids) and coalesce(available_quantity,0)<=0) then raise exception 'NO_AVAILABLE_QUANTITY'; end if;
  select count(*) into expired_count from public.jobs where id=any(p_ids) and listing_expires_at<=now();
  if free_count+paid_count<expired_count then raise exception 'POST_CREDIT_UNAVAILABLE'; end if;
  take_free:=least(free_count,expired_count);
  update public.users set free_post_credits=free_count-take_free,
   paid_post_credits=paid_count-(expired_count-take_free),
   available_post_credits=free_count+paid_count-expired_count where id=auth.uid();
  update public.jobs set is_active=true,
   published_at=case when listing_expires_at<=now() then now() else published_at end,
   listing_expires_at=case when listing_expires_at<=now() then now()+interval '30 days' else listing_expires_at end,
   updated_at=now() where id=any(p_ids);
 elsif p_action='deactivate' then
  update public.jobs set is_active=false,updated_at=now() where id=any(p_ids);
 else
  if exists(select 1 from public.qpay_service_orders o where (o.job_id=any(p_ids) or o.job_ids && p_ids) and o.status in ('CREATING','PENDING')) then raise exception 'PENDING_PAYMENT'; end if;
  -- Retain rental/payment history; never cascade a live renter's records.
  if exists(select 1 from public.rental_requests r where r.job_id=any(p_ids)
     and lower(r.status::text) not in ('cancelled','canceled','rejected','expired','completed','returned')) then raise exception 'ACTIVE_RENTAL'; end if;
  -- Hide listings without cascading away completed rental/payment history.
  update public.jobs set deleted_at=now(),is_active=false,updated_at=now() where id=any(p_ids);
 end if;
 return n;
end $$;
revoke all on function public.manage_own_listings(uuid[],text) from public,anon;
grant execute on function public.manage_own_listings(uuid[],text) to authenticated;


alter table public.qpay_service_orders drop constraint qpay_service_orders_job_id_fkey;
alter table public.qpay_service_orders add constraint qpay_service_orders_job_id_fkey foreign key(job_id) references public.jobs(id) on delete set null;
alter table public.qpay_service_orders drop constraint qpay_service_orders_plan_id_check;
alter table public.qpay_service_orders add constraint qpay_service_orders_plan_id_check
 check(plan_id in ('credit','credit2','credit3','bump','daily','weekly','monthly'));
alter table public.qpay_service_orders add column job_ids uuid[] not null default '{}';
update public.qpay_service_orders set job_ids=array[job_id] where job_id is not null;

create or replace function public.reserve_qpay_listing_order(p_user_id uuid,p_job_ids uuid[],p_plan_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.qpay_service_orders%rowtype; price integer; ids uuid[]; n integer;
begin
 perform 1 from public.users where id=p_user_id for update;
 if not found then raise exception 'USER_NOT_FOUND'; end if;
 price:=case p_plan_id when 'credit' then 3000 when 'credit2' then 5000 when 'credit3' then 7000
  when 'bump' then 1000 when 'daily' then 4500 when 'weekly' then 21000 when 'monthly' then 45000 end;
 if price is null then raise exception 'INVALID_PLAN'; end if;
 if p_plan_id like 'credit%' then ids:='{}';
 else
  if cardinality(p_job_ids) not between 1 and 100 or p_job_ids is null then raise exception 'INVALID_SELECTION'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_job_ids) id;
  if cardinality(ids)<>cardinality(p_job_ids) then raise exception 'INVALID_SELECTION'; end if;
  perform 1 from public.jobs where id=any(ids) order by id for update;
  select count(*) into n from public.jobs where id=any(ids) and posted_by_id=p_user_id and deleted_at is null;
  if n<>cardinality(ids) then raise exception 'NOT_YOUR_JOB'; end if;
  if exists(select 1 from public.jobs where id=any(ids) and listing_expires_at<=now()) then raise exception 'LISTING_EXPIRED'; end if;
  if exists(select 1 from public.jobs where id=any(ids) and not coalesce(is_active,false)) then raise exception 'LISTING_INACTIVE'; end if;
  if exists(select 1 from public.jobs where id=any(ids) and coalesce(available_quantity,0)<=0) then raise exception 'NO_AVAILABLE_QUANTITY'; end if;
  -- Don't overwrite already purchased Sponsored time in a bulk selection.
  if p_plan_id<>'bump' and exists(select 1 from public.jobs where id=any(ids) and sponsored_until>now()) then raise exception 'ALREADY_SPONSORED'; end if;
  price:=price*cardinality(ids);
 end if;
 select * into o from public.qpay_service_orders where user_id=p_user_id and plan_id=p_plan_id and job_ids=ids
  and status in ('CREATING','PENDING') and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if found then return to_jsonb(o)||jsonb_build_object('reserved',false); end if;
 if exists(select 1 from public.qpay_service_orders where user_id=p_user_id and status in ('CREATING','PENDING')
  and job_ids && ids) then raise exception 'PENDING_PAYMENT'; end if;
 if (select count(*) from public.qpay_service_orders where user_id=p_user_id and created_at>now()-interval '1 minute')>=5 then raise exception 'RATE_LIMITED'; end if;
 insert into public.qpay_service_orders(user_id,job_id,job_ids,plan_id,amount)
 values(p_user_id,case when cardinality(ids)=1 then ids[1] else null end,ids,p_plan_id,price) returning * into o;
 return to_jsonb(o)||jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_qpay_listing_order(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.reserve_qpay_listing_order(uuid,uuid[],text) to service_role;

create or replace function public.reserve_qpay_service_order(p_user_id uuid,p_job_id uuid,p_plan_id text)
returns jsonb language sql security definer set search_path=public as $$
 select public.reserve_qpay_listing_order(p_user_id,case when p_job_id is null then '{}'::uuid[] else array[p_job_id] end,p_plan_id);
$$;

create or replace function public.finalize_qpay_service_order(p_order_id uuid,p_payment_id text,p_paid_amount numeric)
returns boolean language plpgsql security definer set search_path=public as $$
declare o public.qpay_service_orders%rowtype; duration integer; credits integer; n integer;
begin
 -- Account lock comes first, matching reserve/manage to prevent deadlocks.
 select * into o from public.qpay_service_orders where id=p_order_id;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 perform 1 from public.users where id=o.user_id for update;
 select * into o from public.qpay_service_orders where id=p_order_id for update;
 if o.status='PAID' then return true; end if;
 if o.invoice_id is null or p_paid_amount is null or p_paid_amount<>o.amount or nullif(p_payment_id,'') is null then raise exception 'PAYMENT_MISMATCH'; end if;
 if o.plan_id like 'credit%' then
  credits:=case o.plan_id when 'credit2' then 2 when 'credit3' then 3 else 1 end;
  update public.users set paid_post_credits=coalesce(paid_post_credits,0)+credits,
   available_post_credits=coalesce(free_post_credits,0)+coalesce(paid_post_credits,0)+credits where id=o.user_id;
 else
  perform 1 from public.jobs where id=any(o.job_ids) order by id for update;
  select count(*) into n from public.jobs where id=any(o.job_ids) and posted_by_id=o.user_id;
  if n<>cardinality(o.job_ids) or n=0 then raise exception 'JOB_NOT_FOUND'; end if;
  -- Eligibility was checked at invoice creation. Payment after expiry still
  -- renews all selected listings atomically; do not alter paused/inventory state.
  update public.jobs set published_at=now(),listing_expires_at=now()+interval '30 days',updated_at=now()
   where id=any(o.job_ids);
  if o.plan_id='bump' then
   update public.jobs set bumped_at=now(),last_bumped_at=now(),bump_count=coalesce(bump_count,0)+1 where id=any(o.job_ids);
  else
   duration:=case o.plan_id when 'daily' then 1 when 'weekly' then 7 when 'monthly' then 30 end;
   update public.jobs set is_sponsored=true,sponsored_until=now()+make_interval(days=>duration) where id=any(o.job_ids);
  end if;
 end if;
 update public.qpay_service_orders set status='PAID',payment_id=p_payment_id,paid_at=now() where id=o.id;
 return true;
end $$;
-- Protect bulk invoices too, including requests through the direct REST API.
create or replace function public.guard_listing_delete() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.qpay_service_orders where status in ('CREATING','PENDING')
  and (job_id=old.id or old.id=any(job_ids))) then raise exception 'PENDING_PAYMENT'; end if;
 if exists(select 1 from public.rental_requests where job_id=old.id
  and lower(status::text) not in ('cancelled','canceled','rejected','expired','completed','returned')) then raise exception 'ACTIVE_RENTAL'; end if;
 return old;
end $$;
create trigger guard_listing_delete before delete on public.jobs for each row execute function public.guard_listing_delete();

do $$
declare u uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); o jsonb; old_created timestamptz; balance integer;
begin
 select posted_by_id into u from public.jobs where posted_by_id is not null limit 1;
 if u is null then raise exception 'NO_FIXTURE'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.jobs(id,title,description,salary,location,category,posted_by_id,posted_by_name,posted_by_phone,is_active,available_quantity)
 select fixture,'rollback lifecycle fixture',description,salary,location,category,u,posted_by_name,posted_by_phone,true,1
 from (select * from public.jobs where posted_by_id=u limit 1) source cross join unnest(array[a,b]) fixture;
 update public.jobs set sponsored_until=null,is_sponsored=false where id in(a,b);
 select created_at into old_created from public.jobs where id=a;
 o:=public.reserve_qpay_listing_order(u,array[a,b],'bump');
 if (o->>'amount')::integer<>2000 then raise exception 'WRONG_BULK_PRICE'; end if;
 update public.qpay_service_orders set invoice_id='rollback-'||(o->>'id'),status='PENDING' where id=(o->>'id')::uuid;
 update public.jobs set listing_expires_at=now()-interval '1 second' where id in(a,b);
 perform public.finalize_qpay_service_order((o->>'id')::uuid,'rollback-pay-'||(o->>'id'),2000);
 perform public.finalize_qpay_service_order((o->>'id')::uuid,'rollback-pay-'||(o->>'id'),2000);
 if (select count(*) from public.jobs where id in(a,b) and listing_expires_at=now()+interval '30 days' and bump_count=1)<>2 then raise exception 'BULK_RENEWAL_FAILED'; end if;
 if (select created_at from public.jobs where id=a)<>old_created then raise exception 'HISTORY_CHANGED'; end if;
 o:=public.reserve_qpay_listing_order(u,'{}','credit3');
 update public.qpay_service_orders set invoice_id='rollback-'||(o->>'id'),status='PENDING' where id=(o->>'id')::uuid;
 select coalesce(paid_post_credits,0) into balance from public.users where id=u;
 perform public.finalize_qpay_service_order((o->>'id')::uuid,'rollback-pay-'||(o->>'id'),7000);
 perform public.finalize_qpay_service_order((o->>'id')::uuid,'rollback-pay-'||(o->>'id'),7000);
 if (select paid_post_credits from public.users where id=u)<>balance+3 then raise exception 'PACKAGE_GRANT_FAILED'; end if;
 update public.jobs set listing_expires_at=now()-interval '1 second' where id=a;
 begin
  perform public.reserve_qpay_listing_order(u,array[a],'bump'); raise exception 'EXPIRED_ALLOWED';
 exception when others then if sqlerrm<>'LISTING_EXPIRED' then raise; end if; end;
 update public.jobs set listing_expires_at=now()+interval '1 day',available_quantity=0 where id=a;
 begin
  perform public.reserve_qpay_listing_order(u,array[a],'bump'); raise exception 'ZERO_INVENTORY_ALLOWED';
 exception when others then if sqlerrm<>'NO_AVAILABLE_QUANTITY' then raise; end if; end;
 update public.jobs set available_quantity=1,is_active=false where id in(a,b);
 update public.jobs set listing_expires_at=now()-interval '1 second' where id=a;
 perform public.refresh_post_credit_balance();
 update public.users set free_post_credits=0,paid_post_credits=0,available_post_credits=0 where id=u;
 begin
  perform public.manage_own_listings(array[a,b],'activate'); raise exception 'NO_CREDIT_ALLOWED';
 exception when others then if sqlerrm<>'POST_CREDIT_UNAVAILABLE' then raise; end if; end;
 if exists(select 1 from public.jobs where id in(a,b) and is_active) then raise exception 'PARTIAL_ACTIVATION'; end if;
 update public.users set paid_post_credits=1,available_post_credits=1 where id=u;
 perform public.manage_own_listings(array[a,b],'activate');
 if (select paid_post_credits from public.users where id=u)<>0 then raise exception 'WRONG_CREDIT_CONSUMPTION'; end if;
 if (select count(*) from public.jobs where id in(a,b) and is_active)<>2 then raise exception 'ACTIVATION_FAILED'; end if;
 perform public.manage_own_listings(array[a,b],'deactivate');
 perform public.manage_own_listings(array[a,b],'activate');
 if (select paid_post_credits from public.users where id=u)<>0 then raise exception 'RESUME_CHARGED'; end if;
end $$;
rollback;
