begin;
-- Installed inactive: enable only after credential probes + sandbox refund tests pass.
-- The secret is looked up in Vault at execution time, never embedded in cron.command.
do $schedule$
declare polling_job bigint;
begin
  if not exists(select 1 from vault.secrets where name='store_refunds_cron_secret') then
    raise exception 'Missing private store refund polling secret';
  end if;
  select cron.schedule('store-refunds-hourly','17 * * * *',
    $command$select net.http_post(
      url:='https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/store-refunds?source=google',
      headers:=jsonb_build_object('Content-Type','application/json','x-refunds-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='store_refunds_cron_secret')),
      body:='{}'::jsonb,timeout_milliseconds:=20000);$command$) into polling_job;
  perform cron.alter_job(polling_job,active:=false);
end $schedule$;
commit;
