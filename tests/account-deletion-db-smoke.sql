begin;
set local role postgres;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); o uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(a,'delete-test-'||a||'@test.invalid'),(b,'delete-test-'||b||'@test.invalid');
 insert into public.users(id,name) values(a,'Synthetic deletion test'),(b,'Synthetic control') on conflict(id) do update set name=excluded.name;
 insert into public.dan_identities(user_id,identity_hash,verified_name) values(a,'synthetic-'||a,'Synthetic name');
 insert into public.jobs(id,title,description,category,posted_by_name,posted_by_phone,posted_by_id) values(j,'Synthetic','Synthetic','Synthetic','Synthetic','00000000',a);
 if (select posted_by_id from public.jobs where id=j) is distinct from a then raise exception 'Owner changed'; end if;
 insert into public.rental_requests(id,job_id,requester_id,owner_id,quantity,status) values(r,j,b,a,1,'pending');
 begin
  perform public.delete_account_atomic(a);
  raise exception 'Expected active rental rejection';
 exception when others then if sqlerrm <> 'ACTIVE_RENTAL' then raise; end if; end;
 if not exists(select 1 from auth.users where id=a) or not exists(select 1 from public.dan_identities where user_id=a) then raise exception 'Partial deletion'; end if;
 update public.rental_requests set status='completed' where id=r;
 insert into public.qpay_service_orders(id,user_id,plan_id,amount,status) values(o,a,'credit',3000,'PENDING');
 begin perform public.delete_account_atomic(a); raise exception 'Expected pending payment rejection';
 exception when others then if sqlerrm <> 'PENDING_PAYMENT' then raise; end if; end;
 update public.qpay_service_orders set status='PAID' where id=o;
 insert into public.rental_disputes(rental_request_id,reporter_id,reported_user_id,reason,description,status) values(r,a,b,'conduct','Synthetic test dispute','open');
 begin perform public.delete_account_atomic(a); raise exception 'Expected dispute rejection';
 exception when others then if sqlerrm <> 'OPEN_DISPUTE' then raise; end if; end;
 update public.rental_disputes set status='resolved' where rental_request_id=r;
 insert into public.payments(id,user_id,rental_request_id,amount,status) values(p,a,r,100,'paid');
 insert into public.mock_ebarimt_receipts(payment_id,user_id,receipt_no,service_type,service_name,amount,vat_amount,total_amount,status) values(p,a,'synthetic-'||p,'post_credit','Synthetic',100,0,100,'mock_issued');
 perform public.delete_account_atomic(a);
 if exists(select 1 from auth.users where id=a) or exists(select 1 from public.users where id=a) or exists(select 1 from public.dan_identities where user_id=a) or exists(select 1 from public.jobs where id=j) or exists(select 1 from public.payments where id=p) then raise exception 'Deletion incomplete auth=% profile=% dan=% job=% pay=%',exists(select 1 from auth.users where id=a),exists(select 1 from public.users where id=a),exists(select 1 from public.dan_identities where user_id=a),exists(select 1 from public.jobs where id=j),exists(select 1 from public.payments where id=p); end if;
 if not exists(select 1 from public.deleted_account_financial_records where source='payments' and amount=100) then raise exception 'Financial summary missing'; end if;
 if not exists(select 1 from auth.users where id=b) then raise exception 'Other account removed'; end if;
 perform public.delete_account_atomic(a); -- retry is harmless
 if has_function_privilege('authenticated','public.delete_account_atomic(uuid)','execute') then raise exception 'RPC exposed'; end if;
 if has_table_privilege('authenticated','public.account_deletion_files','select') then raise exception 'Queue exposed'; end if;
 insert into public.account_deletion_files(bucket_id,object_name) values('synthetic','synthetic-test-'||a);
 if not exists(select 1 from public.claim_account_deletion_files() where object_name='synthetic-test-'||a) then raise exception 'Cleanup claim failed'; end if;
 if exists(select 1 from public.claim_account_deletion_files() where object_name='synthetic-test-'||a) then raise exception 'Cleanup lease failed'; end if;
end $$;
rollback;
