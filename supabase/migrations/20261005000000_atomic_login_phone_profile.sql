-- Auth credentials are updated by trusted Edge Functions. This transaction
-- keeps the profile and default contact in sync without altering existing ads.
create or replace function public.save_login_phone_profile(
  p_user_id uuid, p_phone text, p_complete_signup boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.users%rowtype;
begin
  if p_phone is null or p_phone !~ '^\+976[0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;
  select * into strict profile from public.users where id = p_user_id for update;
  if p_complete_signup then
    if profile.terms_accepted_at is null then raise exception 'terms_acceptance_required'; end if;
    if profile.dan_onboarding_completed_at is not null then raise exception 'onboarding_already_completed'; end if;
    if not exists (select 1 from public.dan_identities where user_id = p_user_id) then
      raise exception 'dan_identity_required';
    end if;
  end if;

  update public.users
  set phone = p_phone,
      dan_onboarding_completed_at = case when p_complete_signup then now() else dan_onboarding_completed_at end
  where id = p_user_id;

  update public.user_contact_phones set is_default = false where user_id = p_user_id and is_default;
  insert into public.user_contact_phones (user_id, phone, label, is_default)
  values (p_user_id, p_phone, 'Үндсэн', true)
  on conflict (user_id, phone) do update set is_default = true;
end;
$$;

revoke all on function public.save_login_phone_profile(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.save_login_phone_profile(uuid, text, boolean) to service_role;
