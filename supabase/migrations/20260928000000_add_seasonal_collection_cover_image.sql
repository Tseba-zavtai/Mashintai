-- Optional artwork for a seasonal collection's card background.
-- Existing collections remain unchanged and continue using their icon fallback.
alter table public.seasonal_collections
  add column if not exists cover_image_url text;
