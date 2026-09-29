-- Public marketing images; uploads are restricted to existing super admins.
begin;
alter table public.seasonal_collections add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seasonal-images', 'seasonal-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists seasonal_images_read on storage.objects;
create policy seasonal_images_read on storage.objects for select to anon, authenticated
using (bucket_id = 'seasonal-images');

drop policy if exists seasonal_images_admin_insert on storage.objects;
create policy seasonal_images_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'seasonal-images' and public.is_super_admin());

drop policy if exists seasonal_images_admin_update on storage.objects;
create policy seasonal_images_admin_update on storage.objects for update to authenticated
using (bucket_id = 'seasonal-images' and public.is_super_admin())
with check (bucket_id = 'seasonal-images' and public.is_super_admin());

drop policy if exists seasonal_images_admin_delete on storage.objects;
create policy seasonal_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'seasonal-images' and public.is_super_admin());
commit;
