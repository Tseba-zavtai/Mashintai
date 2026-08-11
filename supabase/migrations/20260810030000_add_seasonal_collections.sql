-- Temporary, curator-controlled discovery collections for the Home screen.
-- A seasonal collection never changes a listing's real category/subcategory.

create table if not exists public.seasonal_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  subtitle text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists seasonal_collections_active_order_idx
  on public.seasonal_collections (is_visible, starts_at, ends_at, sort_order);

-- Each rule includes either an entire main category or one exact subcategory.
-- Adding a subcategory automatically records its parent category as well.
create table if not exists public.seasonal_collection_rules (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.seasonal_collections(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (category_id is not null or subcategory_id is not null)
);

create unique index if not exists seasonal_collection_rules_category_unique_idx
  on public.seasonal_collection_rules (collection_id, category_id)
  where subcategory_id is null;

create unique index if not exists seasonal_collection_rules_subcategory_unique_idx
  on public.seasonal_collection_rules (collection_id, subcategory_id)
  where subcategory_id is not null;

create index if not exists seasonal_collection_rules_collection_idx
  on public.seasonal_collection_rules (collection_id);

create or replace function public.validate_seasonal_collection_rule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_category_id uuid;
begin
  if new.subcategory_id is not null then
    select category_id
      into v_parent_category_id
      from public.subcategories
     where id = new.subcategory_id;

    if v_parent_category_id is null then
      raise exception 'Selected subcategory was not found.' using errcode = '23503';
    end if;

    if new.category_id is null then
      new.category_id := v_parent_category_id;
    elsif new.category_id <> v_parent_category_id then
      raise exception 'Selected subcategory does not belong to the selected category.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_seasonal_collection_rule on public.seasonal_collection_rules;
create trigger validate_seasonal_collection_rule
before insert or update on public.seasonal_collection_rules
for each row execute function public.validate_seasonal_collection_rule();

create or replace function public.set_seasonal_collections_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_seasonal_collections_updated_at on public.seasonal_collections;
create trigger set_seasonal_collections_updated_at
before update on public.seasonal_collections
for each row execute function public.set_seasonal_collections_updated_at();

alter table public.seasonal_collections enable row level security;
alter table public.seasonal_collection_rules enable row level security;

drop policy if exists seasonal_collections_select_active on public.seasonal_collections;
create policy seasonal_collections_select_active
  on public.seasonal_collections
  for select to anon, authenticated
  using (
    is_visible = true
    and starts_at <= now()
    and ends_at >= now()
  );

drop policy if exists seasonal_collection_rules_select_active_collection on public.seasonal_collection_rules;
create policy seasonal_collection_rules_select_active_collection
  on public.seasonal_collection_rules
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.seasonal_collections collection
      where collection.id = seasonal_collection_rules.collection_id
        and collection.is_visible = true
        and collection.starts_at <= now()
        and collection.ends_at >= now()
    )
  );

-- Configuration is intentionally dashboard-only for now. The app has read-only
-- access, so a user cannot put their own listing into a collection.
