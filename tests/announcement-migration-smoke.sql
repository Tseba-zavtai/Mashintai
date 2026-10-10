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
do $$
declare a uuid:=gen_random_uuid();
begin
 insert into public.system_announcements(id,title,message,is_active) values(a,'rollback fixture','test',true);
 if not public.record_announcement_view(a) then raise exception 'VIEW_NOT_RECORDED'; end if;
 if (select view_count from public.system_announcements where id=a)<>1 then raise exception 'WRONG_COUNT'; end if;
 update public.system_announcements set is_active=false where id=a;
 if public.record_announcement_view(a) then raise exception 'INACTIVE_COUNTED'; end if;
 update public.system_announcements set is_active=true,start_at=now()+interval '1 day' where id=a;
 if public.record_announcement_view(a) then raise exception 'FUTURE_COUNTED'; end if;
 update public.system_announcements set start_at=null,end_at=now()-interval '1 day' where id=a;
 if public.record_announcement_view(a) then raise exception 'EXPIRED_COUNTED'; end if;
 if (select view_count from public.system_announcements where id=a)<>1 then raise exception 'COUNT_CHANGED'; end if;
end $$;
rollback;
