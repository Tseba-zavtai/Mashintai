-- Rebuilds the rental catalog without losing existing listings.
-- Category IDs stay in place; legacy subcategory references are migrated before
-- obsolete choices are removed. Fuel type is intentionally not a subcategory.

begin;

create temporary table _category_targets (
  old_name text primary key,
  new_name text not null,
  icon text not null,
  sort_order integer not null
) on commit drop;

insert into _category_targets (old_name, new_name, icon, sort_order) values
  ('Үл хөдлөх', 'Үл хөдлөх', '🏢', 1),
  ('Тээврийн хэрэгсэл', 'Тээврийн хэрэгсэл', '🚗', 2),
  ('Хувцас, хэрэглэл', 'Хувцас, хэрэглэл', '👗', 3),
  ('Технологи & Төхөөрөмж', 'Технологи, төхөөрөмж', '💻', 4),
  ('Цахилгаан бараа', 'Цахилгаан бараа', '🔌', 5),
  ('Оффис, бизнесийн хэрэглээ', 'Оффис, бизнесийн хэрэглээ', '💼', 6),
  ('Багаж хэрэгсэл', 'Багаж, тоног төхөөрөмж', '🔨', 7),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Олон нийтийн арга хэмжээний хэрэгсэл', '🎪', 8),
  ('Ахуйн болон өдөр тутмын', 'Хүүхэд, асаргааны хэрэгсэл', '🏠', 9),
  ('Аялал зугаалгын хэрэгсэл', 'Аялал, зугаалгын хэрэгсэл', '⛺', 10),
  ('Спорт, Хобби', 'Спорт, хобби, тоглоом', '⚽', 11),
  ('Сурталчилгааны самбар', 'Сурталчилгааны самбар, талбай', '📢', 12),
  ('Танин мэдэхүй', 'Ном, урлаг, хобби', '📚', 13),
  ('Хүнд машин механизм', 'Хүнд машин механизм', '🚜', 14);

do $$
begin
  if (select count(*) from public.categories c join _category_targets t on t.old_name = c.name) <> 14 then
    raise exception 'Expected rental categories were not found. Catalog update was not applied.';
  end if;
end;
$$;

update public.categories c
set name = t.new_name,
    icon = t.icon,
    sort_order = t.sort_order
from _category_targets t
where c.name = t.old_name;

create temporary table _target_subcategories (
  category_name text not null,
  name text not null,
  sort_order integer not null,
  primary key (category_name, name)
) on commit drop;

insert into _target_subcategories (category_name, name, sort_order) values
  ('Үл хөдлөх', 'Орон сууц', 1),
  ('Үл хөдлөх', 'Service apartment', 2),
  ('Үл хөдлөх', 'Хаус, зуслангийн байшин', 3),
  ('Үл хөдлөх', 'Хашаа байшин, гэр', 4),
  ('Үл хөдлөх', 'Guest house, аяллын байр', 5),
  ('Үл хөдлөх', 'Нийтийн байр, дотуур байр', 6),
  ('Үл хөдлөх', 'Оффис, ажлын байр', 7),
  ('Үл хөдлөх', 'Худалдаа, үйлчилгээний талбай', 8),
  ('Үл хөдлөх', 'Агуулах, үйлдвэрийн байр', 9),
  ('Үл хөдлөх', 'Хурлын өрөө, анги танхим', 10),
  ('Үл хөдлөх', 'Эвент, үзэсгэлэнгийн танхим', 11),
  ('Үл хөдлөх', 'Спорт, бэлтгэлийн заал', 12),
  ('Үл хөдлөх', 'Газар, талбай', 13),
  ('Тээврийн хэрэгсэл', 'Суудлын машин', 1),
  ('Тээврийн хэрэгсэл', 'SUV, жийп, pickup', 2),
  ('Тээврийн хэрэгсэл', 'Микроавтобус, ван', 3),
  ('Тээврийн хэрэгсэл', 'Автобус', 4),
  ('Тээврийн хэрэгсэл', 'Ачааны машин', 5),
  ('Тээврийн хэрэгсэл', 'Мотоцикл, мопед', 6),
  ('Тээврийн хэрэгсэл', 'Унадаг дугуй', 7),
  ('Тээврийн хэрэгсэл', 'Цахилгаан дугуй', 8),
  ('Тээврийн хэрэгсэл', 'Скутер', 9),
  ('Тээврийн хэрэгсэл', 'Чиргүүл, caravan', 10),
  ('Хувцас, хэрэглэл', 'Хуримын, гоёлын даашинз, костюм', 1),
  ('Хувцас, хэрэглэл', 'Үндэсний хувцас', 2),
  ('Хувцас, хэрэглэл', 'Тайзны, дүрийн, баярын хувцас', 3),
  ('Хувцас, хэрэглэл', 'Гоёл, аксессуар', 4),
  ('Технологи, төхөөрөмж', 'Гар утас, таблет', 1),
  ('Технологи, төхөөрөмж', 'Зөөврийн компьютер, компьютер', 2),
  ('Технологи, төхөөрөмж', 'Камер, дрон', 3),
  ('Технологи, төхөөрөмж', 'Видео тоглоом, VR', 4),
  ('Технологи, төхөөрөмж', 'Аудио, хөгжим, караоке', 5),
  ('Технологи, төхөөрөмж', 'Ухаалаг цаг, дагалдах хэрэгсэл', 6),
  ('Технологи, төхөөрөмж', 'Зурагт, проектор', 7),
  ('Технологи, төхөөрөмж', 'Сүлжээ, холбооны төхөөрөмж', 8),
  ('Цахилгаан бараа', 'Халаагуур, сэнс', 1),
  ('Цахилгаан бараа', 'Агааржуулагч', 2),
  ('Цахилгаан бараа', 'Хөргөгч, хөлдөөгч', 3),
  ('Цахилгаан бараа', 'Гал тогооны цахилгаан хэрэгсэл', 4),
  ('Цахилгаан бараа', 'Тоос сорогч, цэвэрлэгээний төхөөрөмж', 5),
  ('Цахилгаан бараа', 'Угаалгын, оёдлын төхөөрөмж', 6),
  ('Оффис, бизнесийн хэрэглээ', 'Хэвлэгч, хувилагч, сканнер', 1),
  ('Оффис, бизнесийн хэрэглээ', 'POS төхөөрөмж', 2),
  ('Оффис, бизнесийн хэрэглээ', 'Онлайн хурлын төхөөрөмж', 3),
  ('Оффис, бизнесийн хэрэглээ', 'Зөөврийн дэлгэц, самбар', 4),
  ('Оффис, бизнесийн хэрэглээ', 'Wi-Fi router, switch', 5),
  ('Оффис, бизнесийн хэрэглээ', 'Оффисын тавилга', 6),
  ('Багаж, тоног төхөөрөмж', 'Барилгын багаж хэрэгсэл', 1),
  ('Багаж, тоног төхөөрөмж', 'Авто засварын багаж', 2),
  ('Багаж, тоног төхөөрөмж', 'Гэр ахуйн засварын багаж', 3),
  ('Багаж, тоног төхөөрөмж', 'Ресторан, кофе шопын тоноглол', 4),
  ('Багаж, тоног төхөөрөмж', 'Цэвэрлэгээ, үйлчилгээний төхөөрөмж', 5),
  ('Багаж, тоног төхөөрөмж', 'Бусад багаж хэрэгсэл', 6),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Асар, майхан, сүүдрэвч', 1),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Тайз, дэлгэц', 2),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Гэрэл, дуу, микрофон', 3),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Ширээ, сандал, бүтээлэг', 4),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Photo booth', 5),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Тайзны чимэглэл, backdrop', 6),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Хүүхдийн тоглоом, эвентийн хэрэгсэл', 7),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Хүүхдийн тэрэг', 1),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Хүүхдийн машины суудал', 2),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Нярайн ор, хэрэгсэл', 3),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Өвчтөний ор', 4),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Тэргэнцэр, асаргааны хэрэгсэл', 5),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Аяга таваг, сервиз', 6),
  ('Аялал, зугаалгын хэрэгсэл', 'Майхан, сүүдрэвч', 1),
  ('Аялал, зугаалгын хэрэгсэл', 'Аяллын ширээ, сандал', 2),
  ('Аялал, зугаалгын хэрэгсэл', 'Унтлагын уут, дэвсгэр', 3),
  ('Аялал, зугаалгын хэрэгсэл', 'Цүнх, чемодан', 4),
  ('Аялал, зугаалгын хэрэгсэл', 'Аяллын хоолны хэрэгсэл', 5),
  ('Аялал, зугаалгын хэрэгсэл', 'Cool box, мөсний хайрцаг', 6),
  ('Аялал, зугаалгын хэрэгсэл', 'GPS, радио холбоо', 7),
  ('Аялал, зугаалгын хэрэгсэл', 'Гэрэл, power bank, нарны зай', 8),
  ('Аялал, зугаалгын хэрэгсэл', 'Хийн баллон, аяллын плитка', 9),
  ('Аялал, зугаалгын хэрэгсэл', 'Ачаа box, уут', 10),
  ('Спорт, хобби, тоглоом', 'Загасчлалын хэрэгсэл', 1),
  ('Спорт, хобби, тоглоом', 'Өвлийн спорт', 2),
  ('Спорт, хобби, тоглоом', 'Усны спорт', 3),
  ('Спорт, хобби, тоглоом', 'Гадаа талбайн спорт', 4),
  ('Спорт, хобби, тоглоом', 'Заалны спорт', 5),
  ('Спорт, хобби, тоглоом', 'Фитнес төхөөрөмж', 6),
  ('Спорт, хобби, тоглоом', 'Party, хөлөгт тоглоом', 7),
  ('Спорт, хобби, тоглоом', 'Удирдлагатай машин, тоглоом', 8),
  ('Спорт, хобби, тоглоом', 'Gaming хэрэгсэл', 9),
  ('Сурталчилгааны самбар, талбай', 'Зам дагуух сурталчилгааны самбар', 1),
  ('Сурталчилгааны самбар, талбай', 'Автобусны буудлын самбар', 2),
  ('Сурталчилгааны самбар, талбай', 'Гадна LED, digital дэлгэц', 3),
  ('Сурталчилгааны самбар, талбай', 'Барилга, фасадны самбар', 4),
  ('Сурталчилгааны самбар, талбай', 'Дотор сурталчилгааны самбар', 5),
  ('Сурталчилгааны самбар, талбай', 'Автобусны сурталчилгаа', 6),
  ('Сурталчилгааны самбар, талбай', 'Хөдөлгөөнт сурталчилгааны самбар', 7),
  ('Ном, урлаг, хобби', 'Ном, сурах бичиг', 1),
  ('Ном, урлаг, хобби', 'Хөгжмийн зэмсэг', 2),
  ('Ном, урлаг, хобби', 'Урлаг, гар урлалын хэрэгсэл', 3),
  ('Хүнд машин механизм', 'Хөдөө аж ахуйн техник', 1),
  ('Хүнд машин механизм', 'Ухах, шорооны ажил', 2),
  ('Хүнд машин механизм', 'Өргөх, зөөх', 3),
  ('Хүнд машин механизм', 'Зам, бетон, индүүдлэг', 4),
  ('Хүнд машин механизм', 'Ухах, өрөмдөх, нураах', 5),
  ('Хүнд машин механизм', 'Чирэх, түрэх', 6);

insert into public.subcategories (category_id, name, icon, sort_order)
select c.id, t.name, c.icon, t.sort_order
from _target_subcategories t
join public.categories c on c.name = t.category_name
where not exists (
  select 1 from public.subcategories s where s.category_id = c.id and s.name = t.name
);

update public.subcategories s
set icon = c.icon,
    sort_order = t.sort_order
from _target_subcategories t
join public.categories c on c.name = t.category_name
where s.category_id = c.id
  and s.name = t.name;

create temporary table _subcategory_mappings (
  old_category_name text not null,
  old_subcategory_name text not null,
  new_category_name text not null,
  new_subcategory_name text not null,
  primary key (old_category_name, old_subcategory_name)
) on commit drop;

insert into _subcategory_mappings values
  ('Үл хөдлөх', '1 Өрөө', 'Үл хөдлөх', 'Орон сууц'),
  ('Үл хөдлөх', '2 өрөө', 'Үл хөдлөх', 'Орон сууц'),
  ('Үл хөдлөх', '3 өрөө', 'Үл хөдлөх', 'Орон сууц'),
  ('Үл хөдлөх', '4+ өрөө', 'Үл хөдлөх', 'Орон сууц'),
  ('Үл хөдлөх', 'Хажуу өрөө', 'Үл хөдлөх', 'Орон сууц'),
  ('Үл хөдлөх', 'Гэйст хоус', 'Үл хөдлөх', 'Guest house, аяллын байр'),
  ('Үл хөдлөх', 'Оффис', 'Үл хөдлөх', 'Оффис, ажлын байр'),
  ('Үл хөдлөх', 'Агуулах, обььект', 'Үл хөдлөх', 'Агуулах, үйлдвэрийн байр'),
  ('Үл хөдлөх', 'Зуслан, Хаус, АОС, Амралтын газар', 'Үл хөдлөх', 'Хаус, зуслангийн байшин'),
  ('Үл хөдлөх', 'Хашаа байшин гэр', 'Үл хөдлөх', 'Хашаа байшин, гэр'),
  ('Тээврийн хэрэгсэл', 'SUV', 'Тээврийн хэрэгсэл', 'SUV, жийп, pickup'),
  ('Тээврийн хэрэгсэл', 'Pickup', 'Тээврийн хэрэгсэл', 'SUV, жийп, pickup'),
  ('Тээврийн хэрэгсэл', 'Микро', 'Тээврийн хэрэгсэл', 'Микроавтобус, ван'),
  ('Тээврийн хэрэгсэл', 'Мотоцикл', 'Тээврийн хэрэгсэл', 'Мотоцикл, мопед'),
  ('Тээврийн хэрэгсэл', 'Скүүтер', 'Тээврийн хэрэгсэл', 'Скутер'),
  ('Тээврийн хэрэгсэл', 'Caravan / trailer', 'Тээврийн хэрэгсэл', 'Чиргүүл, caravan'),
  ('Хувцас, хэрэглэл', 'Гоёлын даашинз', 'Хувцас, хэрэглэл', 'Хуримын, гоёлын даашинз, костюм'),
  ('Хувцас, хэрэглэл', 'Костюм', 'Хувцас, хэрэглэл', 'Хуримын, гоёлын даашинз, костюм'),
  ('Хувцас, хэрэглэл', 'Mascot хувцас', 'Хувцас, хэрэглэл', 'Тайзны, дүрийн, баярын хувцас'),
  ('Хувцас, хэрэглэл', 'Тайзны хувцас', 'Хувцас, хэрэглэл', 'Тайзны, дүрийн, баярын хувцас'),
  ('Хувцас, хэрэглэл', 'Гоёл чимэглэл, Цүнх, Нүдний шил', 'Хувцас, хэрэглэл', 'Гоёл, аксессуар'),
  ('Технологи, төхөөрөмж', 'Гар утас, Таблет', 'Технологи, төхөөрөмж', 'Гар утас, таблет'),
  ('Технологи, төхөөрөмж', 'Компьютер, Нөүтбүүк', 'Технологи, төхөөрөмж', 'Зөөврийн компьютер, компьютер'),
  ('Технологи, төхөөрөмж', 'Камер, Дрон', 'Технологи, төхөөрөмж', 'Камер, дрон'),
  ('Технологи, төхөөрөмж', 'Аудио, Хөгжим', 'Технологи, төхөөрөмж', 'Аудио, хөгжим, караоке'),
  ('Технологи, төхөөрөмж', 'Караоке', 'Технологи, төхөөрөмж', 'Аудио, хөгжим, караоке'),
  ('Технологи, төхөөрөмж', 'Ухаалаг цаг, Хэрэгсэл', 'Технологи, төхөөрөмж', 'Ухаалаг цаг, дагалдах хэрэгсэл'),
  ('Технологи, төхөөрөмж', 'Зурагт, Проектор', 'Технологи, төхөөрөмж', 'Зурагт, проектор'),
  ('Технологи, төхөөрөмж', 'Сервер, Сүлжээний төхөөрөмж', 'Технологи, төхөөрөмж', 'Сүлжээ, холбооны төхөөрөмж'),
  ('Цахилгаан бараа', 'Халаагуур, Тень', 'Цахилгаан бараа', 'Халаагуур, сэнс'),
  ('Цахилгаан бараа', 'Айр кондишн, Сэнс', 'Цахилгаан бараа', 'Агааржуулагч'),
  ('Цахилгаан бараа', 'Хөргөгч, Хөлдөөгч', 'Цахилгаан бараа', 'Хөргөгч, хөлдөөгч'),
  ('Цахилгаан бараа', 'Пейч, Плитка', 'Цахилгаан бараа', 'Гал тогооны цахилгаан хэрэгсэл'),
  ('Цахилгаан бараа', 'Тоос сорогч, Хивс угаагч', 'Цахилгаан бараа', 'Тоос сорогч, цэвэрлэгээний төхөөрөмж'),
  ('Цахилгаан бараа', 'Оёдлын машин', 'Цахилгаан бараа', 'Угаалгын, оёдлын төхөөрөмж'),
  ('Оффис, бизнесийн хэрэглээ', 'ПОС төхөөрөмж', 'Оффис, бизнесийн хэрэглээ', 'POS төхөөрөмж'),
  ('Оффис, бизнесийн хэрэглээ', 'Бар код уншигч', 'Оффис, бизнесийн хэрэглээ', 'POS төхөөрөмж'),
  ('Оффис, бизнесийн хэрэглээ', 'Шошго хэвлэгч', 'Оффис, бизнесийн хэрэглээ', 'POS төхөөрөмж'),
  ('Оффис, бизнесийн хэрэглээ', 'Уулзалтын чанга яригч сэт', 'Оффис, бизнесийн хэрэглээ', 'Онлайн хурлын төхөөрөмж'),
  ('Оффис, бизнесийн хэрэглээ', 'Зөөврийн дэлгэц', 'Оффис, бизнесийн хэрэглээ', 'Зөөврийн дэлгэц, самбар'),
  ('Оффис, бизнесийн хэрэглээ', 'Самбар', 'Оффис, бизнесийн хэрэглээ', 'Зөөврийн дэлгэц, самбар'),
  ('Оффис, бизнесийн хэрэглээ', 'Wi-Fi router', 'Оффис, бизнесийн хэрэглээ', 'Wi-Fi router, switch'),
  ('Багаж, тоног төхөөрөмж', 'Авто машины багаж хэрэгсэл', 'Багаж, тоног төхөөрөмж', 'Авто засварын багаж'),
  ('Багаж, тоног төхөөрөмж', 'Хөдөө аж ахуйн багаж хэрэгсэл', 'Багаж, тоног төхөөрөмж', 'Бусад багаж хэрэгсэл'),
  ('Багаж, тоног төхөөрөмж', 'Ресторан, кофе шопын хэрэгсэл', 'Багаж, тоног төхөөрөмж', 'Ресторан, кофе шопын тоноглол'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Асар, майхан', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Асар, майхан, сүүдрэвч'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Гэрэлтүүлгэ', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Гэрэл, дуу, микрофон'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Хөгжим, чанга яригч, микрафон', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Гэрэл, дуу, микрофон'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Photo Booth', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Photo booth'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Тоноглол, Дагалдах хэрэгсэл', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Хүүхдийн тоглоом, эвентийн хэрэгсэл'),
  ('Олон нийтийн арга хэмжээний хэрэгсэл', 'Тайзны чимэглэл', 'Олон нийтийн арга хэмжээний хэрэгсэл', 'Тайзны чимэглэл, backdrop'),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Нярайн ор', 'Хүүхэд, асаргааны хэрэгсэл', 'Нярайн ор, хэрэгсэл'),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Насилк, тэргэнцэр', 'Хүүхэд, асаргааны хэрэгсэл', 'Тэргэнцэр, асаргааны хэрэгсэл'),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Хивс цэвэрлэгч', 'Цахилгаан бараа', 'Тоос сорогч, цэвэрлэгээний төхөөрөмж'),
  ('Хүүхэд, асаргааны хэрэгсэл', 'Ачааны уут, сав, баглаа боодол', 'Аялал, зугаалгын хэрэгсэл', 'Ачаа box, уут'),
  ('Аялал, зугаалгын хэрэгсэл', 'Ширээ, сандал', 'Аялал, зугаалгын хэрэгсэл', 'Аяллын ширээ, сандал'),
  ('Аялал, зугаалгын хэрэгсэл', 'Ор, гудас', 'Аялал, зугаалгын хэрэгсэл', 'Унтлагын уут, дэвсгэр'),
  ('Аялал, зугаалгын хэрэгсэл', 'Цүнх, Чемодан', 'Аялал, зугаалгын хэрэгсэл', 'Цүнх, чемодан'),
  ('Аялал, зугаалгын хэрэгсэл', 'Хоолны хэрэгсэл', 'Аялал, зугаалгын хэрэгсэл', 'Аяллын хоолны хэрэгсэл'),
  ('Аялал, зугаалгын хэрэгсэл', 'Мишок, Cool Box', 'Аялал, зугаалгын хэрэгсэл', 'Cool box, мөсний хайрцаг'),
  ('Аялал, зугаалгын хэрэгсэл', 'Дуран, GPS, станц', 'Аялал, зугаалгын хэрэгсэл', 'GPS, радио холбоо'),
  ('Аялал, зугаалгын хэрэгсэл', 'Гэрэл, повер банк, нарны толь', 'Аялал, зугаалгын хэрэгсэл', 'Гэрэл, power bank, нарны зай'),
  ('Аялал, зугаалгын хэрэгсэл', 'Хийн баллон, плитка', 'Аялал, зугаалгын хэрэгсэл', 'Хийн баллон, аяллын плитка'),
  ('Спорт, хобби, тоглоом', 'Өвлийн спортын хэрэгсэл', 'Спорт, хобби, тоглоом', 'Өвлийн спорт'),
  ('Спорт, хобби, тоглоом', 'Усан спортын хэрэгсэлт', 'Спорт, хобби, тоглоом', 'Усны спорт'),
  ('Спорт, хобби, тоглоом', 'Гадаа талбайн спортын хэрэгсэл', 'Спорт, хобби, тоглоом', 'Гадаа талбайн спорт'),
  ('Спорт, хобби, тоглоом', 'Заалны спортын хэрэгсэл', 'Спорт, хобби, тоглоом', 'Заалны спорт'),
  ('Спорт, хобби, тоглоом', 'Фитнес тоног төхөөрөмж', 'Спорт, хобби, тоглоом', 'Фитнес төхөөрөмж'),
  ('Спорт, хобби, тоглоом', 'Парти болон хүлэгт тоглоомын сэт', 'Спорт, хобби, тоглоом', 'Party, хөлөгт тоглоом'),
  ('Спорт, хобби, тоглоом', 'Удирдлагатай машин', 'Спорт, хобби, тоглоом', 'Удирдлагатай машин, тоглоом'),
  ('Сурталчилгааны самбар, талбай', 'Billboard Сурталчилгааны самбар', 'Сурталчилгааны самбар, талбай', 'Зам дагуух сурталчилгааны самбар'),
  ('Сурталчилгааны самбар, талбай', 'Гадна сурталчилгааны Лед дэлгэц', 'Сурталчилгааны самбар, талбай', 'Гадна LED, digital дэлгэц'),
  ('Сурталчилгааны самбар, талбай', 'Орон сууцны лифтны сурталчилгааны самбар', 'Сурталчилгааны самбар, талбай', 'Дотор сурталчилгааны самбар'),
  ('Сурталчилгааны самбар, талбай', 'Хөдөлгөөнт самбар', 'Сурталчилгааны самбар, талбай', 'Хөдөлгөөнт сурталчилгааны самбар'),
  ('Хүнд машин механизм', 'Хөдөө аж ахуйн тоног төхөөрөмж', 'Хүнд машин механизм', 'Хөдөө аж ахуйн техник'),
  ('Хүнд машин механизм', 'Өргөгч, тээгч машин механизм', 'Хүнд машин механизм', 'Өргөх, зөөх'),
  ('Хүнд машин механизм', 'Чиргүүл, зөөврийн сууц', 'Тээврийн хэрэгсэл', 'Чиргүүл, caravan'),
  ('Хүнд машин механизм', 'Ухаж, өрөмждөх', 'Хүнд машин механизм', 'Ухах, өрөмдөх, нураах'),
  ('Хүнд машин механизм', 'Чирэгч, түрэгч', 'Хүнд машин механизм', 'Чирэх, түрэх'),
  ('Хүнд машин механизм', 'Цутгагч, индүүдэгч', 'Хүнд машин механизм', 'Зам, бетон, индүүдлэг');

-- Multiple old choices can now have the same final subcategory. Keep a single
-- rule per collection / final subcategory before changing the foreign keys.
with translated_rules as (
  select
    r.id,
    r.collection_id,
    coalesce(new_subcategory.id, r.subcategory_id) as final_subcategory_id,
    row_number() over (
      partition by r.collection_id, coalesce(new_subcategory.id, r.subcategory_id)
      order by
        case when new_subcategory.id is null then 0 else 1 end,
        r.created_at asc nulls last,
        r.id
    ) as duplicate_rank
  from public.seasonal_collection_rules r
  left join public.subcategories old_subcategory on old_subcategory.id = r.subcategory_id
  left join public.categories old_category on old_category.id = old_subcategory.category_id
  left join _subcategory_mappings m
    on m.old_category_name = old_category.name
   and m.old_subcategory_name = old_subcategory.name
  left join public.categories new_category on new_category.name = m.new_category_name
  left join public.subcategories new_subcategory
    on new_subcategory.category_id = new_category.id
   and new_subcategory.name = m.new_subcategory_name
)
delete from public.seasonal_collection_rules r
using translated_rules duplicates
where r.id = duplicates.id
  and duplicates.duplicate_rank > 1;

update public.seasonal_collection_rules r
set category_id = new_category.id,
    subcategory_id = new_subcategory.id
from _subcategory_mappings m
join public.categories old_category on old_category.name = m.old_category_name
join public.subcategories old_subcategory on old_subcategory.category_id = old_category.id and old_subcategory.name = m.old_subcategory_name
join public.categories new_category on new_category.name = m.new_category_name
join public.subcategories new_subcategory on new_subcategory.category_id = new_category.id and new_subcategory.name = m.new_subcategory_name
where r.subcategory_id = old_subcategory.id;

update public.jobs j
-- jobs.category_id is a legacy text column; jobs.subcategory_id is uuid.
set category_id = new_category.id::text,
    category = new_category.name,
    subcategory_id = new_subcategory.id,
    subcategory = new_subcategory.name
from _subcategory_mappings m
join public.categories old_category on old_category.name = m.old_category_name
join public.subcategories old_subcategory on old_subcategory.category_id = old_category.id and old_subcategory.name = m.old_subcategory_name
join public.categories new_category on new_category.name = m.new_category_name
join public.subcategories new_subcategory on new_subcategory.category_id = new_category.id and new_subcategory.name = m.new_subcategory_name
-- Some older installs store these IDs as text rather than uuid. Compare their
-- canonical text form so the migration works with either schema.
where j.subcategory_id::text = old_subcategory.id::text
   or (j.category_id::text = old_category.id::text and j.subcategory::text = old_subcategory.name::text);

-- A deleted legacy choice may not leave a dangling reference in an old listing.
update public.jobs j
set subcategory_id = null,
    subcategory = null
from public.subcategories s
where j.subcategory_id::text = s.id::text
  and not exists (
    select 1
    from _target_subcategories target
    join public.categories c on c.name = target.category_name
    where target.name = s.name
      and c.id = s.category_id
  );

delete from public.seasonal_collection_rules r
using public.subcategories s
where r.subcategory_id = s.id
  and not exists (
    select 1
    from _target_subcategories target
    join public.categories c on c.name = target.category_name
    where target.name = s.name
      and c.id = s.category_id
  );

delete from public.subcategories s
where not exists (
  select 1
  from _target_subcategories target
  join public.categories c on c.name = target.category_name
  where target.name = s.name
    and c.id = s.category_id
);

update public.jobs j
set category = c.name
from public.categories c
where j.category_id::text = c.id::text
  and j.category is distinct from c.name;

update public.jobs j
set subcategory = s.name
from public.subcategories s
where j.subcategory_id::text = s.id::text
  and j.subcategory is distinct from s.name;

-- Filters are separate from the category tree. A vehicle has one fuel type;
-- a real-estate listing has one advertised rental duration.
alter table public.jobs add column if not exists fuel_type text;
alter table public.jobs add column if not exists rental_duration text;

update public.jobs
set rental_duration = case price_type
  when 'hourly' then 'hourly'
  when 'daily' then 'daily'
  when 'monthly' then 'monthly'
  else null
end
where rental_duration is null
  and category = 'Үл хөдлөх';

create index if not exists jobs_fuel_type_active_idx
  on public.jobs (fuel_type)
  where is_active = true;

create index if not exists jobs_rental_duration_active_idx
  on public.jobs (rental_duration)
  where is_active = true;
commit;
