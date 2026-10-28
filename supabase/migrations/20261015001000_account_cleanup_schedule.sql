begin;
create extension if not exists pg_net with schema extensions;
-- No secret in cron text: this endpoint can only consume already-authorized,
-- service-only deletion queue entries and returns no user/file information.
select cron.schedule('tureesly-account-file-cleanup','*/10 * * * *',
 $job$select net.http_post(url := 'https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/account-deletion-cleanup', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000);$job$);
commit;
