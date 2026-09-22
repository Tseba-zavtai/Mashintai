-- Rename only the display label. The subcategory row (and therefore its ID)
-- remains the same, so existing jobs and seasonal collection rules stay linked.
begin;

update public.subcategories s
set name = 'Өрөмдлөг, нураалтын ажил'
from public.categories c
where s.category_id = c.id
  and c.name = 'Хүнд машин механизм'
  and s.name = 'Ухах, өрөмдөх, нураах';

-- Keep the legacy text field aligned for existing listings. `subcategory_id`
-- is preserved; the extra null-ID clause also covers any older legacy row.
with target_subcategory as (
  select s.id
  from public.subcategories s
  join public.categories c on c.id = s.category_id
  where c.name = 'Хүнд машин механизм'
    and s.name = 'Өрөмдлөг, нураалтын ажил'
)
update public.jobs j
set subcategory = 'Өрөмдлөг, нураалтын ажил'
where j.subcategory = 'Ухах, өрөмдөх, нураах'
  and (
    j.subcategory_id::text in (select id::text from target_subcategory)
    or (
      j.subcategory_id is null
      and j.category = 'Хүнд машин механизм'
    )
  );

commit;