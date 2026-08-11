-- A "successful rental" is deliberately strict: the rental is completed and
-- both participants have reviewed the other participant for that same request.
-- This makes the public badge meaningful and prevents a one-sided action from
-- increasing a user's trust signal.
create or replace function public.get_mutual_successful_rental_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.rental_requests rr
  where rr.status = 'completed'
    and p_user_id in (rr.owner_id, rr.requester_id)
    and exists (
      select 1
      from public.rental_reviews owner_review
      where owner_review.request_id = rr.id
        and owner_review.reviewer_id = rr.owner_id
        and owner_review.reviewed_user_id = rr.requester_id
    )
    and exists (
      select 1
      from public.rental_reviews requester_review
      where requester_review.request_id = rr.id
        and requester_review.reviewer_id = rr.requester_id
        and requester_review.reviewed_user_id = rr.owner_id
    );
$$;

revoke all on function public.get_mutual_successful_rental_count(uuid) from public;
grant execute on function public.get_mutual_successful_rental_count(uuid) to authenticated;
