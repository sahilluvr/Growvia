-- v078: Site security scans (outside-in website security check, score and fixes). Safe to run more than once.
create table if not exists public.site_security (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  url         text not null,
  score       int  not null,
  grade       text not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists site_security_biz_time on public.site_security (business_id, created_at desc);
alter table public.site_security enable row level security;  -- no policies: the server (service role) reads/writes it, scoped to the project
grant all on public.site_security to service_role;
