begin;
do $$
declare u uuid; j uuid; o uuid; before_paid integer; before_bump integer; before_until timestamptz; after_until timestamptz;
begin
 if has_function_privilege('authenticated','public.finalize_qpay_service_order(uuid,text,numeric)','EXECUTE') then raise exception 'client can finalize payments'; end if;
 if has_table_privilege('authenticated','public.qpay_service_orders','SELECT') then raise exception 'callback secrets exposed'; end if;
 select posted_by_id,id into u,j from public.jobs where posted_by_id is not null limit 1;
 if u is null then raise exception 'No fixture available'; end if;
 select coalesce(paid_post_credits,0) into before_paid from public.users where id=u;
 insert into public.qpay_service_orders(user_id,plan_id,amount,invoice_id,status) values(u,'credit',3000,'smoke-'||gen_random_uuid(),'PENDING') returning id into o;
 begin
  perform public.finalize_qpay_service_order(o,'smoke-bad',1);
  raise exception 'wrong amount accepted';
 exception when others then if sqlerrm <> 'PAYMENT_MISMATCH' then raise; end if; end;
 perform public.finalize_qpay_service_order(o,'smoke-'||o,3000);
 perform public.finalize_qpay_service_order(o,'smoke-'||o,3000);
 if (select coalesce(paid_post_credits,0) from public.users where id=u) <> before_paid+1 then raise exception 'duplicate credit grant'; end if;
 select coalesce(bump_count,0) into before_bump from public.jobs where id=j;
 insert into public.qpay_service_orders(user_id,job_id,job_ids,plan_id,amount,invoice_id,status) values(u,j,array[j],'bump',1000,'smoke-'||gen_random_uuid(),'PENDING') returning id into o;
 perform public.finalize_qpay_service_order(o,'smoke-'||o,1000);
 perform public.finalize_qpay_service_order(o,'smoke-'||o,1000);
 if (select coalesce(bump_count,0) from public.jobs where id=j) <> before_bump+1 then raise exception 'duplicate bump grant'; end if;
 before_until:=now();
 insert into public.qpay_service_orders(user_id,job_id,job_ids,plan_id,amount,invoice_id,status) values(u,j,array[j],'weekly',21000,'smoke-'||gen_random_uuid(),'PENDING') returning id into o;
 perform public.finalize_qpay_service_order(o,'smoke-'||o,21000);
 perform public.finalize_qpay_service_order(o,'smoke-'||o,21000);
 select sponsored_until into after_until from public.jobs where id=j;
 if after_until <> before_until+interval '7 days' then raise exception 'duplicate sponsor grant'; end if;
end $$;
rollback;
