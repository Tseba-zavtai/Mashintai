begin;
-- Old test receipt grants must not be usable to mint paid credits after launch.
revoke execute on function public.grant_test_purchased_post_credit(uuid) from authenticated, anon, public;

create or replace function public.guard_paid_service_fields()
returns trigger language plpgsql set search_path=public as $$
begin
 -- Trusted security-definer credit RPCs and service-role payment finalization
 -- still work. Direct mobile REST updates must not manufacture paid benefits.
 if current_user in ('authenticated','anon') and not public.is_super_admin() then
  if tg_table_name='users' then
   if (tg_op='INSERT' and coalesce(new.is_super_admin,false)) or
      (tg_op='UPDATE' and new.is_super_admin is distinct from old.is_super_admin) then
    raise exception 'ADMIN_ROLE_SERVER_ONLY' using errcode='42501';
   end if;
   if tg_op='UPDATE' and (new.paid_post_credits is distinct from old.paid_post_credits
     or new.free_post_credits is distinct from old.free_post_credits
     or new.available_post_credits is distinct from old.available_post_credits
     or new.post_credit_last_granted_month is distinct from old.post_credit_last_granted_month
     or new.last_post_credit_consumption_id is distinct from old.last_post_credit_consumption_id
     or new.last_post_credit_consumed_from is distinct from old.last_post_credit_consumed_from
     or new.last_post_credit_restored_at is distinct from old.last_post_credit_restored_at) then
    raise exception 'PAID_CREDITS_SERVER_ONLY' using errcode='42501';
   end if;
   if tg_op='INSERT' and (coalesce(new.paid_post_credits,0)<>0 or coalesce(new.free_post_credits,0)>2 or coalesce(new.available_post_credits,0)>2) then
    raise exception 'PAID_CREDITS_SERVER_ONLY' using errcode='42501';
   end if;
  else
   if tg_op='INSERT' and (coalesce(new.is_sponsored,false) or new.sponsored_until is not null or new.bumped_at is not null or coalesce(new.bump_count,0)<>0) then
    raise exception 'PAID_SERVICES_SERVER_ONLY' using errcode='42501';
   end if;
   if tg_op='UPDATE' and (new.is_sponsored is distinct from old.is_sponsored
     or new.sponsored_until is distinct from old.sponsored_until
     or new.bumped_at is distinct from old.bumped_at
     or new.bump_count is distinct from old.bump_count) then
    raise exception 'PAID_SERVICES_SERVER_ONLY' using errcode='42501';
   end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_paid_user_fields before insert or update on public.users for each row execute function public.guard_paid_service_fields();
create trigger guard_paid_job_fields before insert or update on public.jobs for each row execute function public.guard_paid_service_fields();
commit;
