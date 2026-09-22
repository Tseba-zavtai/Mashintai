-- New users receive two free listing credits. Since paid and free credits share
-- the existing balance, the monthly allowance is added rather than replacing it.

alter table public.users
  alter column available_post_credits set default 2;

alter table public.users
  add column if not exists post_credit_last_granted_month date;

alter table public.users
  alter column post_credit_last_granted_month set default date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date;

-- Existing balances remain unchanged. They will receive the allowance next month.
update public.users
set post_credit_last_granted_month = date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date
where post_credit_last_granted_month is null;

-- Repair only recently completed DAN registrations affected by the old zero-credit default.
-- This does not touch any balance above zero.
update public.users
set available_post_credits = 2
where coalesce(available_post_credits, 0) = 0
  and dan_onboarding_completed_at >= now() - interval '3 days';

create or replace function public.grant_monthly_post_credits_if_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', timezone('Asia/Ulaanbaatar', now()))::date;
  updated_credits integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.users
  set available_post_credits = coalesce(available_post_credits, 0) + 2,
      post_credit_last_granted_month = current_month
  where id = auth.uid()
    and post_credit_last_granted_month < current_month
  returning available_post_credits into updated_credits;

  if updated_credits is null then
    select coalesce(available_post_credits, 0)
      into updated_credits
    from public.users
    where id = auth.uid();
  end if;

  return coalesce(updated_credits, 0);
end;
$$;

revoke all on function public.grant_monthly_post_credits_if_due() from public;
grant execute on function public.grant_monthly_post_credits_if_due() to authenticated;