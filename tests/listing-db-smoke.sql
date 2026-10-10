begin;
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
 perform public.manage_own_listings(array[a,b],'delete');
 if (select count(*) from public.jobs where id in(a,b) and deleted_at is not null and not is_active)<>2 then raise exception 'ARCHIVE_FAILED'; end if;
 if not exists(select 1 from public.qpay_service_orders where job_ids=array[a,b] or job_ids=array[b,a]) then raise exception 'PAYMENT_HISTORY_LOST'; end if;
end $$;
rollback;
