-- Growvia scheduler: runs every 5 minutes inside your Supabase project (free). Every minute burned Vercel Hobby CPU.
-- 1) Replace YOUR-CRON-SECRET below (same value as CRON_SECRET in Vercel).
-- 2) Supabase → SQL Editor → paste → Run.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('growvia-tick') where exists (select 1 from cron.job where jobname = 'growvia-tick');

select cron.schedule(
  'growvia-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://usegrowvia.com/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
