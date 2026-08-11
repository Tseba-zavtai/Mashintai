-- Private, user-managed contact numbers. A number is exposed only when its
-- owner selects it for a listing or a rental request.
create table if not exists public.user_contact_phones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^\+976[0-9]{8}$'),
  label text not null default 'Холбоо барих' check (char_length(label) between 1 and 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);

create unique index if not exists user_contact_phones_one_default_per_user
  on public.user_contact_phones (user_id)
  where is_default;

alter table public.user_contact_phones enable row level security;

drop policy if exists user_contact_phones_select_own on public.user_contact_phones;
create policy user_contact_phones_select_own
on public.user_contact_phones for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_contact_phones_insert_own on public.user_contact_phones;
create policy user_contact_phones_insert_own
on public.user_contact_phones for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_contact_phones_update_own on public.user_contact_phones;
create policy user_contact_phones_update_own
on public.user_contact_phones for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_contact_phones_delete_own on public.user_contact_phones;
create policy user_contact_phones_delete_own
on public.user_contact_phones for delete
to authenticated
using (user_id = auth.uid());

-- Existing account phone numbers are preserved and become the first saved
-- contact number. This does not change a legacy account's login identity.
insert into public.user_contact_phones (user_id, phone, label, is_default)
select id, phone, 'Үндсэн', true
from public.users
where phone ~ '^\+976[0-9]{8}$'
on conflict (user_id, phone) do nothing;
