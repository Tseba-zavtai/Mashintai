-- Run this once in projects where app_release_notes was created before the
-- timestamp trigger was added. Future migrations already include this trigger.

create or replace function public.set_app_release_notes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_release_notes_set_updated_at on public.app_release_notes;
create trigger app_release_notes_set_updated_at
before update on public.app_release_notes
for each row execute function public.set_app_release_notes_updated_at();