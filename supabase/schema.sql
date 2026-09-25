-- Growvia database schema for Supabase (free tier).
-- Run once: Supabase Dashboard → SQL Editor → New query → paste all → Run.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ───────────────────────── Tables ─────────────────────────
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  website     text,
  segment     text not null,
  city        text,
  goal        text,
  audience    text,
  offer       text,
  voice       text,
  channels    text[] not null default '{}',
  plan        jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  objective    text,
  channels     text[] not null default '{}',
  status       text not null default 'draft' check (status in ('draft','active','completed')),
  created_at   timestamptz not null default now()
);

create table if not exists public.content_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  channel       text not null,
  kind          text not null,
  title         text not null,
  body          text not null,
  status        text not null default 'draft' check (status in ('draft','approved','scheduled','published')),
  scheduled_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  company      text,
  source       text not null default 'manual',
  stage        text not null default 'new' check (stage in ('new','contacted','qualified','won','lost')),
  value        numeric not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  agent       text not null,
  text        text not null,
  tag         text,
  created_at  timestamptz not null default now()
);

create index if not exists campaigns_owner_idx on public.campaigns(owner_id, created_at desc);
create index if not exists content_campaign_idx on public.content_items(campaign_id);
create index if not exists content_owner_idx on public.content_items(owner_id);
create index if not exists leads_owner_idx on public.leads(owner_id, created_at desc);
create index if not exists activity_owner_idx on public.activity(owner_id, created_at desc);

-- ───────────────────────── API access ─────────────────────────
-- Signed-in users reach these tables through Supabase's API; RLS below limits them to their own rows.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.businesses, public.campaigns, public.content_items, public.leads, public.activity to authenticated;
revoke all on public.businesses, public.campaigns, public.content_items, public.leads, public.activity from anon;

-- ───────────────────────── Row Level Security ─────────────────────────
-- Every row belongs to its owner. Users can only ever see and change their own data.
alter table public.businesses    enable row level security;
alter table public.campaigns     enable row level security;
alter table public.content_items enable row level security;
alter table public.leads         enable row level security;
alter table public.activity      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['businesses','campaigns','content_items','leads','activity'] loop
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ───────────────────────── Public lead form ─────────────────────────
-- Lets anyone with a business's form link see its name and submit a lead,
-- without exposing any other data.
create or replace function public.public_business(bid uuid)
returns table (id uuid, name text, segment text, city text, offer text)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.segment, b.city, b.offer from public.businesses b where b.id = bid;
$$;

create or replace function public.submit_lead(
  bid uuid, p_name text, p_email text, p_phone text, p_message text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.businesses where id = bid;
  if owner is null then return false; end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 120 then return false; end if;
  insert into public.leads (owner_id, business_id, name, email, phone, source, stage, notes)
  values (owner, bid, left(trim(p_name),120), left(p_email,200), left(p_phone,40), 'lead form', 'new', left(p_message,2000));
  insert into public.activity (owner_id, agent, text, tag)
  values (owner, 'Lead Finder', 'New lead from your lead form: ' || left(trim(p_name),120), '+1 lead');
  return true;
end $$;

revoke all on function public.public_business(uuid) from public;
revoke all on function public.submit_lead(uuid, text, text, text, text) from public;
grant execute on function public.public_business(uuid) to anon, authenticated;
grant execute on function public.submit_lead(uuid, text, text, text, text) to anon, authenticated;

-- ═════════════════════════ v006 · Email engine, inbox, sequences, meetings ═════════════════════════

-- Leads double as the contact list.
alter table public.leads add column if not exists tags text[] not null default '{}';
alter table public.leads add column if not exists unsubscribed boolean not null default false;
alter table public.leads add column if not exists email_status text not null default 'ok';      -- ok | bounced
alter table public.leads add column if not exists last_contacted_at timestamptz;
alter table public.leads add column if not exists last_replied_at timestamptz;
create index if not exists leads_owner_email_idx on public.leads(owner_id, lower(email));

-- A connected sending mailbox (SMTP for sending, IMAP for reading replies). Password is AES-GCM encrypted by the app.
create table if not exists public.mailboxes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label         text not null default 'Main mailbox',
  from_name     text not null,
  from_email    text not null,
  smtp_host     text not null,
  smtp_port     int  not null default 465,
  smtp_secure   boolean not null default true,
  imap_host     text,
  imap_port     int  not null default 993,
  username      text not null,
  password_enc  text not null,
  daily_limit   int  not null default 100,
  signature     text,
  status        text not null default 'connected',            -- connected | error
  last_error    text,
  imap_last_uid bigint not null default 0,
  imap_uidvalidity bigint,
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  category    text not null default 'General',
  subject     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Email campaigns: an ordered set of steps sent over time to enrolled leads.
create table if not exists public.sequences (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name          text not null,
  status        text not null default 'draft' check (status in ('draft','active','paused','completed')),
  mailbox_id    uuid references public.mailboxes(id) on delete set null,
  stop_on_reply boolean not null default true,
  send_days     int[] not null default '{1,2,3,4,5}',           -- 0 = Sunday
  send_start    int not null default 9,                          -- hour, in timezone
  send_end      int not null default 18,
  timezone      text not null default 'Asia/Kolkata',
  created_at    timestamptz not null default now()
);

create table if not exists public.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  position     int not null,
  wait_days    numeric not null default 0,
  subject      text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  step_index   int not null default 0,                           -- next step to send
  status       text not null default 'active' check (status in ('active','replied','completed','unsubscribed','bounced','failed','stopped')),
  next_run_at  timestamptz not null default now(),
  thread_id    uuid,
  last_error   text,
  created_at   timestamptz not null default now(),
  unique (sequence_id, lead_id)
);
create index if not exists enrollments_due_idx on public.enrollments(status, next_run_at);

create table if not exists public.threads (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lead_id          uuid references public.leads(id) on delete cascade,
  subject          text not null,
  last_message_at  timestamptz not null default now(),
  unread           boolean not null default false,
  status           text not null default 'open' check (status in ('open','closed')),
  created_at       timestamptz not null default now()
);
create index if not exists threads_owner_idx on public.threads(owner_id, last_message_at desc);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  thread_id     uuid not null references public.threads(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete set null,
  direction     text not null check (direction in ('out','in')),
  from_email    text,
  to_email      text,
  subject       text,
  body_text     text,
  body_html     text,
  message_id    text,                                            -- RFC 5322 Message-ID
  in_reply_to   text,
  status        text not null default 'sent' check (status in ('scheduled','sending','sent','failed','received')),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  opened_at     timestamptz,
  open_count    int not null default 0,
  clicked_at    timestamptz,
  click_count   int not null default 0,
  error         text,
  sequence_id   uuid references public.sequences(id) on delete set null,
  step_id       uuid references public.sequence_steps(id) on delete set null,
  mailbox_id    uuid references public.mailboxes(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages(thread_id, created_at);
create index if not exists messages_msgid_idx on public.messages(message_id);
create index if not exists messages_due_idx on public.messages(status, scheduled_at);

create table if not exists public.booking_pages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  slug         text not null unique,
  title        text not null default 'Book a call',
  description  text,
  duration     int not null default 30,
  days         int[] not null default '{1,2,3,4,5}',
  start_hour   int not null default 10,
  end_hour     int not null default 18,
  timezone     text not null default 'Asia/Kolkata',
  location     text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lead_id     uuid references public.leads(id) on delete set null,
  name        text not null,
  email       text not null,
  notes       text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  status      text not null default 'confirmed' check (status in ('confirmed','cancelled','completed')),
  created_at  timestamptz not null default now()
);
create index if not exists bookings_owner_idx on public.bookings(owner_id, start_at);

grant select, insert, update, delete on public.mailboxes, public.email_templates, public.sequences, public.sequence_steps,
  public.enrollments, public.threads, public.messages, public.booking_pages, public.bookings to authenticated;
revoke all on public.mailboxes, public.email_templates, public.sequences, public.sequence_steps,
  public.enrollments, public.threads, public.messages, public.booking_pages, public.bookings from anon;

do $$
declare t text;
begin
  foreach t in array array['mailboxes','email_templates','sequences','sequence_steps','enrollments','threads','messages','booking_pages','bookings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Background jobs (scheduler, booking page, tracking) use the service role.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;

-- ═════════════════════════ v007 · WhatsApp, Facebook, Instagram ═════════════════════════

-- Connected channel accounts (WhatsApp number, Facebook Page, Instagram professional account).
create table if not exists public.channel_accounts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  provider         text not null check (provider in ('whatsapp','facebook','instagram')),
  external_id      text not null,                -- phone_number_id / page_id / ig_user_id
  name             text not null,
  username         text,
  picture          text,
  phone_display    text,
  waba_id          text,                         -- WhatsApp Business Account id
  page_id          text,                         -- Facebook Page linked to an Instagram account
  access_token_enc text not null,
  app_secret_enc   text,                         -- optional: per-number app secret for webhook signatures
  status           text not null default 'connected',
  last_error       text,
  meta             jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  unique (provider, external_id)
);

alter table public.threads  add column if not exists channel text not null default 'email';
alter table public.threads  add column if not exists channel_account_id uuid references public.channel_accounts(id) on delete set null;
alter table public.threads  add column if not exists external_key text;               -- wa_id / PSID / IGSID
alter table public.threads  add column if not exists last_inbound_at timestamptz;
create index if not exists threads_external_idx on public.threads(channel_account_id, external_key);

alter table public.messages add column if not exists channel text not null default 'email';
alter table public.messages add column if not exists external_id text;                -- wamid / mid
alter table public.messages add column if not exists delivery text;                    -- sent | delivered | read | failed
alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists media_type text;
alter table public.messages add column if not exists template_name text;
alter table public.messages add column if not exists broadcast_id uuid;
create index if not exists messages_external_idx on public.messages(external_id);

alter table public.leads add column if not exists wa_id text;                           -- WhatsApp number in international format
alter table public.leads add column if not exists fb_psid text;
alter table public.leads add column if not exists ig_id text;
alter table public.leads add column if not exists wa_opt_in boolean not null default false;
create index if not exists leads_wa_idx on public.leads(owner_id, wa_id);

-- Social posts published directly to Facebook / Instagram.
create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content_item_id uuid references public.content_items(id) on delete set null,
  caption       text not null default '',
  link          text,
  media         jsonb not null default '[]',      -- [{url, type: image|video}]
  targets       uuid[] not null default '{}',     -- channel_accounts ids
  status        text not null default 'draft' check (status in ('draft','scheduled','publishing','published','partial','failed')),
  scheduled_at  timestamptz,
  published_at  timestamptz,
  results       jsonb not null default '[]',      -- [{account_id, provider, ok, external_id, permalink, error}]
  created_at    timestamptz not null default now()
);
create index if not exists social_posts_due_idx on public.social_posts(status, scheduled_at);

-- WhatsApp template broadcasts.
create table if not exists public.wa_broadcasts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  account_id    uuid not null references public.channel_accounts(id) on delete cascade,
  name          text not null,
  template_name text not null,
  language      text not null default 'en_US',
  params        jsonb not null default '[]',      -- body variable mapping, e.g. ["{{first_name}}", "Diwali offer"]
  lead_ids      uuid[] not null default '{}',
  status        text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed')),
  scheduled_at  timestamptz,
  sent_count    int not null default 0,
  failed_count  int not null default 0,
  created_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.channel_accounts, public.social_posts, public.wa_broadcasts to authenticated;
revoke all on public.channel_accounts, public.social_posts, public.wa_broadcasts from anon;
grant all on public.channel_accounts, public.social_posts, public.wa_broadcasts to service_role;

do $$
declare t text;
begin
  foreach t in array array['channel_accounts','social_posts','wa_broadcasts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Public media bucket for images/videos you publish (Instagram and Facebook fetch them by URL).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public = true;
    execute 'drop policy if exists "growvia media upload" on storage.objects';
    execute $p$create policy "growvia media upload" on storage.objects for insert to authenticated
             with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute 'drop policy if exists "growvia media manage" on storage.objects';
    execute $p$create policy "growvia media manage" on storage.objects for delete to authenticated
             using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;
