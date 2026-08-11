-- Seasonal collections remain read-only for normal users.
-- Only the existing super-admin role may configure their title, dates and rules
-- from the in-app admin panel.

drop policy if exists seasonal_collections_select_admin on public.seasonal_collections;
create policy seasonal_collections_select_admin
  on public.seasonal_collections
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists seasonal_collections_insert_admin on public.seasonal_collections;
create policy seasonal_collections_insert_admin
  on public.seasonal_collections
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists seasonal_collections_update_admin on public.seasonal_collections;
create policy seasonal_collections_update_admin
  on public.seasonal_collections
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists seasonal_collections_delete_admin on public.seasonal_collections;
create policy seasonal_collections_delete_admin
  on public.seasonal_collections
  for delete to authenticated
  using (public.is_super_admin());

drop policy if exists seasonal_collection_rules_select_admin on public.seasonal_collection_rules;
create policy seasonal_collection_rules_select_admin
  on public.seasonal_collection_rules
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists seasonal_collection_rules_insert_admin on public.seasonal_collection_rules;
create policy seasonal_collection_rules_insert_admin
  on public.seasonal_collection_rules
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists seasonal_collection_rules_update_admin on public.seasonal_collection_rules;
create policy seasonal_collection_rules_update_admin
  on public.seasonal_collection_rules
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists seasonal_collection_rules_delete_admin on public.seasonal_collection_rules;
create policy seasonal_collection_rules_delete_admin
  on public.seasonal_collection_rules
  for delete to authenticated
  using (public.is_super_admin());
