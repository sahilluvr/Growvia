-- v074: Lead finder jobs (Google Maps businesses + website contact emails). Safe to run more than once.
create table if not exists public.lead_finds (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  what        text not null,
  "where"     text not null,
  wanted      int  not null default 0,
  found       int  not null default 0,     -- businesses returned by Google Maps (counts toward the monthly allowance)
  requests    int  not null default 0,     -- Google Maps searches used (global free-allowance cap)
  status      text not null default 'enriching', -- enriching | done
  results     jsonb not null default '[]'::jsonb,
  saved       int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lead_finds_owner_time on public.lead_finds (owner_id, created_at desc);
alter table public.lead_finds enable row level security;  -- no policies: the server (service role) reads/writes it, scoped to the project
grant all on public.lead_finds to service_role;
