create or replace function public.select_default_contact_phone(p_phone_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required'; end if;
  -- Same owner-row lock as login-phone updates: default selection cannot race.
  perform 1 from public.users where id = actor for update;
  if not exists (select 1 from public.user_contact_phones where id = p_phone_id and user_id = actor) then
    raise exception 'contact_phone_not_found';
  end if;
  update public.user_contact_phones set is_default = false where user_id = actor and is_default;
  update public.user_contact_phones set is_default = true where id = p_phone_id and user_id = actor;
end;
$$;
revoke all on function public.select_default_contact_phone(uuid) from public, anon;
grant execute on function public.select_default_contact_phone(uuid) to authenticated;
