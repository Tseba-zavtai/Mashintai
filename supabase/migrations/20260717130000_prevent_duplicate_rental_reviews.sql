-- A reviewer may submit only one review for the same rental request.
-- Existing records are preserved; the trigger blocks only future duplicates.
create or replace function public.prevent_duplicate_rental_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_id is null then
    return new;
  end if;

  -- Serialise concurrent taps/devices for this same request + reviewer pair.
  perform pg_advisory_xact_lock(
    hashtextextended(new.request_id::text || ':' || new.reviewer_id::text, 0)
  );

  if exists (
    select 1
    from public.rental_reviews
    where request_id = new.request_id
      and reviewer_id = new.reviewer_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'Та энэ түрээсийн хүсэлтэд үнэлгээ өгсөн байна.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_rental_review_trigger on public.rental_reviews;
create trigger prevent_duplicate_rental_review_trigger
before insert on public.rental_reviews
for each row
execute function public.prevent_duplicate_rental_review();