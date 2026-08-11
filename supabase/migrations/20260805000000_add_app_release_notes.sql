-- Public, read-only release notes for the Profile > Version screen.
-- Add/edit rows from the Supabase dashboard whenever a new version ships.
create table if not exists public.app_release_notes (
  id uuid primary key default gen_random_uuid(),
  version text,
  title text not null,
  description text not null,
  status text not null default 'released'
    check (status in ('released', 'in_progress', 'planned')),
  released_at date,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_release_notes_visible_order_idx
  on public.app_release_notes (is_visible, sort_order desc, released_at desc);

alter table public.app_release_notes enable row level security;

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

drop policy if exists "Public can read visible release notes" on public.app_release_notes;
create policy "Public can read visible release notes"
  on public.app_release_notes
  for select
  using (is_visible = true);

-- Example rows (edit the date/text first, then run in SQL Editor when ready):
-- insert into public.app_release_notes (version, title, description, status, released_at, sort_order)
-- values
--   ('1.0.0', 'Анхны хувилбар', 'Зар оруулах, хайх, түрээсийн хүсэлт болон үнэлгээний үндсэн боломжууд.', 'released', '2026-08-05', 100),
--   (null, 'Шинэ боломжууд дээр ажиллаж байна', 'Дараагийн шинэчлэлийн боломжуудыг бэлтгэж байна.', 'in_progress', null, 90),
--   (null, 'Удахгүй', 'Тун удахгүй нэмэгдэх боломжууд.', 'planned', null, 80);
