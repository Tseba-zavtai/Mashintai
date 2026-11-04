-- Only this private endpoint can return configuration status; no key/token values in output.
select net.http_post(
  url:='https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/store-refunds?source=readiness',
  headers:=jsonb_build_object('Content-Type','application/json','x-refunds-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='store_refunds_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=20000
) as request_id;
