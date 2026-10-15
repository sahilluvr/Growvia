-- v072: sign-up log for per-network sign-up limits (bot protection). Safe to run more than once.
create table if not exists public.signup_log (
  id           bigint generated always as identity primary key,
  ip_hash      text,
  email_domain text,
  created_at   timestamptz not null default now()
);
create index if not exists signup_log_ip_time on public.signup_log (ip_hash, created_at desc);
alter table public.signup_log enable row level security;  -- no policies: only the server (service role) reads/writes it
grant all on public.signup_log to service_role;
-- Keep 30 days.
delete from public.signup_log where created_at < now() - interval '30 days';
