-- Read-only operator report. No keys, receipts, purchase tokens, or user contact data.
select platform, environment, count(*) as verified_receipts
from public.store_purchase_receipts group by platform, environment;

select platform, event_type, environment, count(*) as pending_manual_reviews,
       min(occurred_at) as oldest_event
from public.store_refund_events where status='needs_review'
group by platform, event_type, environment;

select jobname, schedule, active from cron.job where jobname='store-refunds-hourly';

select j.jobname, d.status, d.start_time, d.end_time
from cron.job_run_details d join cron.job j on j.jobid=d.jobid
where j.jobname='store-refunds-hourly' order by d.start_time desc limit 10;
