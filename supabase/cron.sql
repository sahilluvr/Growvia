-- Growvia scheduler: runs every minute inside your Supabase project (free).
-- 1) Replace YOUR-SITE and YOUR-CRON-SECRET below (same value as CRON_SECRET in Vercel).
-- 2) Supabase → SQL Editor → paste → Run.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('growvia-tick') where exists (select 1 from cron.job where jobname = 'growvia-tick');

select cron.schedule(
  'growvia-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-SITE.vercel.app/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
