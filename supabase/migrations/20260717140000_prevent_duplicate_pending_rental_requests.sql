-- Prevent duplicate active rental requests for the same renter and listing.
-- The client also performs a friendly pre-check, while this trigger protects
-- against race conditions and direct API calls.
create or replace function public.prevent_duplicate_pending_rental_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and new.job_id is not null and new.requester_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(new.job_id::text || ':' || new.requester_id::text, 0)
    );

    if exists (
      select 1
      from public.rental_requests
      where job_id = new.job_id
        and requester_id = new.requester_id
        and status = 'pending'
    ) then
      raise exception 'A pending rental request already exists for this listing'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_pending_rental_request_trigger on public.rental_requests;
create trigger prevent_duplicate_pending_rental_request_trigger
before insert on public.rental_requests
for each row
execute function public.prevent_duplicate_pending_rental_request();