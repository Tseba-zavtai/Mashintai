-- New reservations use the agreed prices; existing invoices retain their original amounts.
create or replace function public.reserve_qpay_listing_order(p_user_id uuid,p_job_ids uuid[],p_plan_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.qpay_service_orders%rowtype; price integer; ids uuid[]; n integer;
begin
 perform 1 from public.users where id=p_user_id for update;
 if not found then raise exception 'USER_NOT_FOUND'; end if;
 price:=case p_plan_id when 'credit' then 3200 when 'credit2' then 5200 when 'credit3' then 7200
  when 'bump' then 1200 when 'daily' then 4000 when 'weekly' then 20000 when 'monthly' then 60000 end;
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

