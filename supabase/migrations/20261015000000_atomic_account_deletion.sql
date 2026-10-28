begin;
-- TG_OP is uppercase. The legacy lowercase comparison returned NEW (=null)
-- on DELETE, silently leaving jobs behind even while their owner was removed.
do $$ declare definition text; begin
 definition := pg_get_functiondef('public.require_active_rental_account()'::regprocedure);
 definition := replace(definition, 'tg_op = ''delete''', 'tg_op = ''DELETE''');
 execute definition;
end $$;
-- No names, phone numbers, identity hashes, account IDs or provider payloads.
create table if not exists public.deleted_account_financial_records (
 id uuid primary key default gen_random_uuid(), source text not null,
 amount numeric, status text, service_type text, occurred_at timestamptz,
 archived_at timestamptz not null default now()
);
alter table public.deleted_account_financial_records enable row level security;
revoke all on public.deleted_account_financial_records from public, anon, authenticated;
grant all on public.deleted_account_financial_records to service_role;

create table if not exists public.account_deletion_files (
 id uuid primary key default gen_random_uuid(), bucket_id text not null, object_name text not null,
 created_at timestamptz not null default now(), leased_until timestamptz,
 unique(bucket_id,object_name)
);
alter table public.account_deletion_files enable row level security;
revoke all on public.account_deletion_files from public, anon, authenticated;
grant all on public.account_deletion_files to service_role;

create or replace function public.delete_account_atomic(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; rentals uuid[]; payment_ids uuid[];
begin
 -- All account mutations lock this row first. Lock child rows before checking them.
 perform 1 from public.users where id=p_user_id for update;
 if exists(select 1 from public.users where id=p_user_id and is_super_admin) then raise exception 'ADMIN_ACCOUNT_PROTECTED'; end if;
 perform 1 from public.jobs where posted_by_id=p_user_id for update;
 select coalesce(array_agg(id),'{}') into ids from public.jobs where posted_by_id=p_user_id;
 perform 1 from public.rental_requests where requester_id=p_user_id or owner_id=p_user_id or job_id=any(ids) for update;
 select coalesce(array_agg(id),'{}') into rentals from public.rental_requests where requester_id=p_user_id or owner_id=p_user_id or job_id=any(ids);
 if exists(select 1 from public.rental_requests where id=any(rentals) and lower(status) not in ('cancelled','canceled','rejected','expired','completed','returned')) then raise exception 'ACTIVE_RENTAL'; end if;
 perform 1 from public.qpay_service_orders where user_id=p_user_id or job_ids && ids or job_id=any(ids) for update;
 if exists(select 1 from public.qpay_service_orders where (user_id=p_user_id or job_ids && ids or job_id=any(ids)) and status in ('CREATING','PENDING')) then raise exception 'PENDING_PAYMENT'; end if;
 if exists(select 1 from public.rental_disputes where (reporter_id=p_user_id or reported_user_id=p_user_id or rental_request_id=any(rentals)) and status in ('open','under_review')) then raise exception 'OPEN_DISPUTE'; end if;
 select coalesce(array_agg(id),'{}') into payment_ids from public.payments where user_id=p_user_id or rental_request_id=any(rentals);
 if exists(select 1 from public.payments where id=any(payment_ids) and lower(coalesce(status,'')) in ('pending','creating','processing')) then raise exception 'PENDING_PAYMENT'; end if;
 if exists(select 1 from public.sponsor_payments where (user_id=p_user_id or job_id=any(ids)) and lower(coalesce(status,'')) in ('pending','creating','processing')) then raise exception 'PENDING_PAYMENT'; end if;
 -- Queue actual Storage objects, never URLs supplied in the request.
 insert into public.account_deletion_files(bucket_id,object_name)
 select bucket_id,name from storage.objects where owner_id=p_user_id::text or owner=p_user_id
 on conflict do nothing;
 insert into public.deleted_account_financial_records(source,amount,status,service_type,occurred_at)
 select 'payments',amount,status,service_type,coalesce(paid_at,created_at) from public.payments where id=any(payment_ids);
 insert into public.deleted_account_financial_records(source,amount,status,service_type,occurred_at)
 select 'qpay_service_orders',amount,status,plan_id,coalesce(paid_at,created_at) from public.qpay_service_orders where user_id=p_user_id;
 insert into public.deleted_account_financial_records(source,amount,status,occurred_at)
 select 'sponsor_payments',amount,status,coalesce(paid_at,created_at) from public.sponsor_payments where user_id=p_user_id or job_id=any(ids);
 delete from public.mock_ebarimt_receipts where user_id=p_user_id or payment_id=any(payment_ids);
 delete from public.payments where id=any(payment_ids);
 delete from public.qpay_service_orders where user_id=p_user_id;
 delete from public.sponsor_payments where user_id=p_user_id or job_id=any(ids);
 delete from public.rental_reviews where request_id=any(rentals) or job_id=any(ids) or reviewer_id=p_user_id or reviewed_user_id=p_user_id or target_user_id=p_user_id;
 delete from public.rental_disputes where rental_request_id=any(rentals) or reporter_id=p_user_id or reported_user_id=p_user_id;
 delete from public.rental_requests where id=any(rentals);
 delete from public.jobs where id=any(ids);
 delete from public.feedback where user_id=p_user_id;
 delete from public.users where id=p_user_id;
 -- Cascade revokes sessions and deletes DAN identity, contacts and handoffs.
 delete from auth.users where id=p_user_id;
 if exists(select 1 from public.users where id=p_user_id)
    or exists(select 1 from auth.users where id=p_user_id)
    or exists(select 1 from public.dan_identities where user_id=p_user_id)
    or exists(select 1 from public.jobs where id=any(ids)) then
  raise exception 'DELETION_INCOMPLETE';
 end if;
end $$;
revoke all on function public.delete_account_atomic(uuid) from public,anon,authenticated;
grant execute on function public.delete_account_atomic(uuid) to service_role;

create or replace function public.claim_account_deletion_files()
returns table(id uuid,bucket_id text,object_name text)
language sql security definer set search_path='' as $$
 update public.account_deletion_files f set leased_until=now()+interval '5 minutes'
 where f.id in (select q.id from public.account_deletion_files q where q.leased_until is null or q.leased_until<now() order by q.created_at limit 100 for update skip locked)
 returning f.id,f.bucket_id,f.object_name;
$$;
revoke all on function public.claim_account_deletion_files() from public,anon,authenticated;
grant execute on function public.claim_account_deletion_files() to service_role;
commit;
