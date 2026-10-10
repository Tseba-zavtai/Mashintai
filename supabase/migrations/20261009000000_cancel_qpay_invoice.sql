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
commit;
