-- v073: per-person email switch (admin). Growvia sends nothing to addresses listed here.
-- Sign-in / password-reset emails come from Supabase Auth and are not affected. Safe to run more than once.
create table if not exists public.email_blocks (
  email      text primary key,               -- lower-case; Gmail addresses stored without dots / +tags
  user_id    uuid references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists email_blocks_user on public.email_blocks (user_id);
alter table public.email_blocks enable row level security;  -- no policies: server (service role) only
grant all on public.email_blocks to service_role;
