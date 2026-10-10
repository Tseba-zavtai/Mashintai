begin;
alter table public.system_announcements add column if not exists view_count bigint not null default 0;
create or replace function public.record_announcement_view(p_target_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.system_announcements set view_count=view_count+1
 where id=p_target_id and is_active=true
  and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now());
 return found;
end $$;
revoke all on function public.record_announcement_view(uuid) from public;
grant execute on function public.record_announcement_view(uuid) to anon,authenticated;
create policy "Admin read announcement metrics" on public.system_announcements for select to authenticated using(public.is_super_admin());
commit;
