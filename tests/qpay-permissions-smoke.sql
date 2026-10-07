begin;
create temporary table payment_fixture as
select u.id as user_id,j.id as job_id from public.users u join public.jobs j on j.posted_by_id=u.id where not coalesce(u.is_super_admin,false) limit 1;
grant select on payment_fixture to authenticated;
set local role authenticated;
do $$
declare u uuid; j uuid; n integer;
begin
 select user_id,job_id into u,j from payment_fixture;
 if u is null then raise exception 'No non-admin fixture'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 -- Harmless no-op proves the owner row is accessible; RLS alone is not what
 -- rejects the following paid-field changes. Everything is rolled back.
 update public.users set phone=phone where id=u;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Fixture not accessible'; end if;
 begin
  update public.users set paid_post_credits=coalesce(paid_post_credits,0)+1 where id=u;
  raise exception 'Direct paid credit update allowed';
 exception when insufficient_privilege then if sqlerrm<>'PAID_CREDITS_SERVER_ONLY' then raise; end if; end;
 begin
  update public.users set is_super_admin=true where id=u;
  raise exception 'Privilege escalation allowed';
 exception when insufficient_privilege then if sqlerrm<>'ADMIN_ROLE_SERVER_ONLY' then raise; end if; end;
 begin
  update public.jobs set bump_count=coalesce(bump_count,0)+1 where id=j;
  raise exception 'Direct paid bump allowed';
 exception when insufficient_privilege then if sqlerrm<>'PAID_SERVICES_SERVER_ONLY' then raise; end if; end;
 if has_function_privilege('authenticated','public.grant_test_purchased_post_credit(uuid)','EXECUTE') then raise exception 'Test credit minting enabled'; end if;
end $$;
reset role;
rollback;
