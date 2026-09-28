-- Tureesly Map-only Store demo seed
--
-- Creates 50 active, image-free demo listings so iOS/Android renders its own
-- native map pins. The records are live in the production app until removed,
-- so capture Store screenshots promptly and use the cleanup query afterwards.
-- No auth accounts, existing listings, tables, or schemas are changed.

begin;

do $$
declare
  v_owner_id uuid;
  v_existing_count integer;
  v_inserted_count integer;
begin
  -- Uses one of the eight demo accounts already created for testing.
  select id
    into v_owner_id
  from auth.users
  where email = any (array[
    'u97686646123@example.com', 'u97689839918@example.com',
    'u97680422725@example.com', 'u97691944496@example.com',
    'u97691718572@example.com', 'u97699266624@example.com',
    'u97691166624@example.com', 'u97688144496@example.com'
  ])
  order by array_position(array[
    'u97699266624@example.com', 'u97686646123@example.com',
    'u97689839918@example.com', 'u97680422725@example.com',
    'u97691944496@example.com', 'u97691718572@example.com',
    'u97691166624@example.com', 'u97688144496@example.com'
  ], email)
  limit 1;

  if v_owner_id is null then
    raise exception 'No demo owner was found. Nothing was inserted; restore one of the eight demo accounts first.';
  end if;

  select count(*)
    into v_existing_count
  from public.jobs
  where description like '%[Tureesly Map Demo 2026-09-23]';

  if v_existing_count > 0 then
    raise exception 'Found % existing map-demo listings. Use the cleanup query first rather than duplicating them.', v_existing_count;
  end if;

  -- Fixed seed produces a repeatable, natural spread across six central
  -- Ulaanbaatar neighborhoods. The app renders its own native map markers.
  perform setseed(0.5724);

  with templates (template_id, category_name, subcategory_name, title) as (
    values
      (1, 'Тээврийн хэрэгсэл', 'Микроавтобус, ван', 'Toyota Alphard 7 суудалтай'),
      (2, 'Технологи, төхөөрөмж', 'Камер, дрон', 'Sony A7 IV камер'),
      (3, 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Асар, майхан, сүүдрэвч', '6×12 арга хэмжээний асар'),
      (4, 'Спорт, хобби, тоглоом', 'Гадаа талбайн спорт', 'Сагсан бөмбөгийн цагираг'),
      (5, 'Багаж, тоног төхөөрөмж', 'Барилгын багаж хэрэгсэл', 'Барилгын өрөм, тасдагч')
  ),
  locations as (
    select
      position,
      case
        when position <= 11 then 47.9182 + (random() - 0.5) * 0.014
        when position <= 20 then 47.9260 + (random() - 0.5) * 0.010
        when position <= 29 then 47.9070 + (random() - 0.5) * 0.012
        when position <= 38 then 47.9230 + (random() - 0.5) * 0.011
        when position <= 45 then 47.9350 + (random() - 0.5) * 0.010
        else                    47.9140 + (random() - 0.5) * 0.009
      end as latitude,
      case
        when position <= 11 then 106.9145 + (random() - 0.5) * 0.014
        when position <= 20 then 106.9310 + (random() - 0.5) * 0.010
        when position <= 29 then 106.9100 + (random() - 0.5) * 0.012
        when position <= 38 then 106.8990 + (random() - 0.5) * 0.011
        when position <= 45 then 106.9220 + (random() - 0.5) * 0.010
        else                    106.9380 + (random() - 0.5) * 0.009
      end as longitude,
      case
        when position <= 11 then 'Сүхбаатар дүүрэг, төвийн бүс'
        when position <= 20 then 'Баянзүрх дүүрэг, төвийн бүс'
        when position <= 29 then 'Хан-Уул дүүрэг, төвийн бүс'
        when position <= 38 then 'Баянгол дүүрэг, төвийн бүс'
        when position <= 45 then 'Чингэлтэй дүүрэг, төвийн бүс'
        else 'Баянзүрх дүүрэг, зүүн бүс'
      end as address
    from generate_series(1, 50) as generated(position)
  )
  insert into public.jobs (
    posted_by_id, title, description,
    category, subcategory, post_type, category_id, subcategory_id,
    address, latitude, longitude,
    posted_by_name, posted_by_phone,
    is_sponsored, sponsored_until,
    item_rating_avg, item_review_count, rental_count, bumped_at, bump_count,
    quantity, available_quantity, price, is_active,
    price_type, fuel_type, rental_duration
  )
  select
    v_owner_id,
    template.title || ' — ' || lpad(location.position::text, 2, '0'),
    'Store screenshot-д ашиглах түр demo байршлын зар. [Tureesly Map Demo 2026-09-23]',
    category_row.name,
    subcategory_row.name,
    'job',
    category_row.id::text,
    subcategory_row.id,
    location.address,
    location.latitude,
    location.longitude,
    'Tureesly Demo',
    '+976 0000 0000',
    false,
    null,
    null,
    0,
    0,
    null,
    0,
    1,
    1,
    50000 + (template.template_id * 10000),
    true,
    'daily',
    null,
    null
  from locations location
  join templates template
    on template.template_id = ((location.position - 1) % 5) + 1
  join public.categories category_row
    on category_row.name = template.category_name
  join public.subcategories subcategory_row
    on subcategory_row.category_id = category_row.id
   and subcategory_row.name = template.subcategory_name;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> 50 then
    raise exception 'Expected 50 map-demo listings, inserted % instead. Check the current category catalog; the transaction will roll back.', v_inserted_count;
  end if;

  raise notice 'Inserted % active map-demo listings.', v_inserted_count;
end $$;

commit;

-- Must return 50 before refreshing the app and taking the map screenshot.
select count(*) as active_map_demo_listings
from public.jobs
where is_active = true
  and description like '%[Tureesly Map Demo 2026-09-23]';

-- CLEANUP — run after the Store screenshots are saved:
-- delete from public.jobs
-- where description like '%[Tureesly Map Demo 2026-09-23]';
