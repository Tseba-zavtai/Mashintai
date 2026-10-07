-- No user records are changed; even the test transaction is rolled back.
begin;
do $$
begin
  if has_function_privilege('anon', 'public.save_login_phone_profile(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'anonymous role must not change login profiles';
  end if;
  if has_function_privilege('authenticated', 'public.save_login_phone_profile(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'app clients must not change login profiles directly';
  end if;
  if not has_function_privilege('service_role', 'public.save_login_phone_profile(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'edge function role requires execute permission';
  end if;
  if has_function_privilege('anon', 'public.select_default_contact_phone(uuid)', 'EXECUTE') then
    raise exception 'anonymous role must not select contacts';
  end if;
  if not has_function_privilege('authenticated', 'public.select_default_contact_phone(uuid)', 'EXECUTE') then
    raise exception 'authenticated owner requires contact selection';
  end if;
  begin
    perform public.select_default_contact_phone(gen_random_uuid());
    raise exception 'missing owner identity was accepted';
  exception when others then
    if sqlerrm <> 'authentication_required' then raise; end if;
  end;
  begin
    perform public.save_login_phone_profile(gen_random_uuid(), '123', false);
    raise exception 'invalid number was accepted';
  exception when others then
    if sqlerrm <> 'invalid_phone' then raise; end if;
  end;
end;
$$;
rollback;
