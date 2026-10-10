begin;

alter table public.qpay_service_orders drop constraint qpay_service_orders_status_check;
alter table public.qpay_service_orders add constraint qpay_service_orders_status_check
 check(status in ('CREATING','PENDING','PAID','FAILED','CANCELLED'));
alter table public.qpay_service_orders add column cancelled_at timestamptz;
create function public.cancel_qpay_service_order(p_order_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.qpay_service_orders%rowtype;
begin
 perform 1 from public.users where id=p_user_id for update;
 select * into o from public.qpay_service_orders where id=p_order_id and user_id=p_user_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if o.status='PAID' then return jsonb_build_object('paid',true,'cancelled',false); end if;
 if o.status='CANCELLED' then return jsonb_build_object('paid',false,'cancelled',true); end if;
 if o.status<>'PENDING' or o.invoice_id is null then raise exception 'CANCEL_NOT_READY'; end if;
 -- Service-role calls only after the provider confirmed invoice cancellation.
 update public.qpay_service_orders set status='CANCELLED',cancelled_at=now() where id=o.id;
 return jsonb_build_object('paid',false,'cancelled',true);
end $$;
revoke all on function public.cancel_qpay_service_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_qpay_service_order(uuid,uuid) to service_role;
-- Keep the existing payment finalizer: a verified late payment can still grant
-- benefits after cancellation. Never discard a valid payment callback.
do $$
declare u uuid; o uuid; before_paid integer; result jsonb;
begin
 if has_function_privilege('authenticated','public.cancel_qpay_service_order(uuid,uuid)','EXECUTE') then raise exception 'CLIENT_CAN_CONFIRM_CANCELLATION'; end if;
 select id into u from public.users limit 1;
 insert into public.qpay_service_orders(user_id,plan_id,amount,invoice_id,status)
 values(u,'credit',3000,'cancel-smoke-'||gen_random_uuid(),'PENDING') returning id into o;
 result:=public.cancel_qpay_service_order(o,u);
 if not (result->>'cancelled')::boolean then raise exception 'CANCEL_FAILED'; end if;
 result:=public.cancel_qpay_service_order(o,u);
 if not (result->>'cancelled')::boolean then raise exception 'CANCEL_NOT_IDEMPOTENT'; end if;
 select coalesce(paid_post_credits,0) into before_paid from public.users where id=u;
 perform public.finalize_qpay_service_order(o,'cancel-late-'||o,3000);
 perform public.finalize_qpay_service_order(o,'cancel-late-'||o,3000);
 if (select paid_post_credits from public.users where id=u)<>before_paid+1 then raise exception 'LATE_PAYMENT_LOST_OR_DUPLICATED'; end if;
 result:=public.cancel_qpay_service_order(o,u);
 if not (result->>'paid')::boolean or (result->>'cancelled')::boolean then raise exception 'PAID_CANCELLED'; end if;
end $$;
rollback;
