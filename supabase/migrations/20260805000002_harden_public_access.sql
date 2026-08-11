-- Security hardening for the existing production schema.
-- This keeps public rental listings working while removing public access to
-- OTPs and broad write permissions.

-- A view must enforce the querying user's RLS policies, not the view owner's.
alter view public.active_jobs_v set (security_invoker = true);

-- Fix existing public-schema functions flagged for a mutable search_path.
-- Unqualified table references continue to resolve to public, but callers
-- can no longer influence resolution.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end;
$$;

-- Only super admins may manage banners. Public users may still read banners
-- that are active and within their configured date range.
drop policy if exists banners_write_authenticated on public.banners;
create policy banners_write_super_admin
  on public.banners
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists banners_select_super_admin on public.banners;
create policy banners_select_super_admin
  on public.banners
  for select
  to authenticated
  using (public.is_super_admin());

-- Feedback is private operational data. Submission remains available to an
-- authenticated user; reading it is restricted to super admins.
drop policy if exists "Enable read access for all feedback" on public.feedback;
drop policy if exists feedback_select_super_admin on public.feedback;
create policy feedback_select_super_admin
  on public.feedback
  for select
  to authenticated
  using (public.is_super_admin());

-- The current app has no secure OTP recovery endpoint. Public OTP reads or
-- writes must not remain enabled until that server-side flow is implemented.
drop policy if exists "Allow public select for otps" on public.password_reset_otps;
drop policy if exists "Allow public insert for otps" on public.password_reset_otps;

-- Public users can see active listings. Owners retain access to their own
-- inactive listings, while the existing admin policy retains full access.
drop policy if exists jobs_select_public on public.jobs;
drop policy if exists jobs_select_active_or_owner on public.jobs;
create policy jobs_select_active_or_owner
  on public.jobs
  for select
  to anon, authenticated
  using (
    coalesce(is_active, true) = true
    or posted_by_id = auth.uid()
  );

-- Remove legacy broad user-table writes. The existing own-profile policies
-- stay in place; an explicit super-admin policy preserves admin operations.
drop policy if exists "Allow Insert" on public.users;
drop policy if exists "Allow Update" on public.users;
drop policy if exists users_update_super_admin on public.users;
create policy users_update_super_admin
  on public.users
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Deliberately not changed here: public user SELECT access is still used by
-- profile/review screens. Replace it next with a narrow public-profile view
-- that excludes phone, admin flags, credits and push tokens.