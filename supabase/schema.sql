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

-- ═════════════════════════ v012 · Workspaces, multiple projects, SEO ═════════════════════════

-- A workspace groups projects (e.g. your agency, or one per client). A project is a business/website.
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id, created_at);

-- Many projects per account (was: one business per account).
alter table public.businesses drop constraint if exists businesses_owner_id_key;
alter table public.businesses add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists businesses_owner_idx on public.businesses(owner_id, created_at);
create index if not exists businesses_workspace_idx on public.businesses(workspace_id);

-- Give every existing account a first workspace holding its existing project.
insert into public.workspaces (owner_id, name)
select distinct b.owner_id, 'My workspace' from public.businesses b
where not exists (select 1 from public.workspaces w where w.owner_id = b.owner_id);
update public.businesses b set workspace_id = (select w.id from public.workspaces w where w.owner_id = b.owner_id order by w.created_at limit 1)
where b.workspace_id is null;

-- Activity belongs to a project (null = account-wide, shown in every project).
alter table public.activity add column if not exists business_id uuid references public.businesses(id) on delete cascade;
update public.activity a set business_id = (select b.id from public.businesses b where b.owner_id = a.owner_id order by b.created_at limit 1)
where a.business_id is null;
create index if not exists activity_business_idx on public.activity(business_id, created_at desc);
create index if not exists leads_business_idx on public.leads(business_id, created_at desc);
create index if not exists campaigns_business_idx on public.campaigns(business_id, created_at desc);

-- Google Search Console connection per project.
alter table public.businesses add column if not exists gsc_refresh_enc text;
alter table public.businesses add column if not exists gsc_email text;
alter table public.businesses add column if not exists gsc_site text;
alter table public.businesses add column if not exists gsc_sites text[] not null default '{}';

-- SEO audits: crawl results, speed, AI output, Search Console snapshot.
create table if not exists public.seo_audits (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  url          text not null,
  status       text not null default 'running',       -- running | done | failed
  score        int,
  scores       jsonb not null default '{}',
  site         jsonb not null default '{}',
  pages        jsonb not null default '[]',
  issues       jsonb not null default '[]',
  speed        jsonb not null default '{}',
  ai           jsonb not null default '{}',
  gsc          jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists seo_audits_business_idx on public.seo_audits(business_id, created_at desc);

grant select, insert, update, delete on public.workspaces, public.seo_audits to authenticated;
revoke all on public.workspaces, public.seo_audits from anon;
grant all on public.workspaces, public.seo_audits to service_role;

do $$
declare t text;
begin
  foreach t in array array['workspaces','seo_audits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ═════════════════════════ v013 · Rankings, AI visibility (GEO), reports ═════════════════════════

-- Per-project SEO settings (schedules, competitors, report emails) and job state.
alter table public.businesses add column if not exists seo_prefs jsonb not null default '{}';
alter table public.businesses add column if not exists seo_state jsonb not null default '{}';

-- Keywords you track.
create table if not exists public.seo_keywords (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  keyword      text not null,
  target_url   text,
  source       text not null default 'manual',     -- manual | gsc | ai | suggest
  created_at   timestamptz not null default now(),
  unique (business_id, keyword)
);

-- Daily position per keyword (from Search Console, or a SERP API).
create table if not exists public.seo_rankings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  keyword_id   uuid not null references public.seo_keywords(id) on delete cascade,
  day          date not null,
  source       text not null default 'gsc',        -- gsc | serp
  position     numeric,
  clicks       int not null default 0,
  impressions  int not null default 0,
  url          text,
  unique (keyword_id, day, source)
);
create index if not exists seo_rankings_kw_idx on public.seo_rankings(keyword_id, day);
create index if not exists seo_rankings_biz_idx on public.seo_rankings(business_id, day);

-- Daily Google Search totals for the site.
create table if not exists public.seo_daily (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day          date not null,
  clicks       int not null default 0,
  impressions  int not null default 0,
  ctr          numeric not null default 0,
  position     numeric,
  primary key (business_id, day)
);

-- AI visibility: questions people ask AI assistants, and each check's result.
create table if not exists public.geo_prompts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  prompt       text not null,
  created_at   timestamptz not null default now(),
  unique (business_id, prompt)
);
create table if not exists public.geo_checks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  prompt_id    uuid not null references public.geo_prompts(id) on delete cascade,
  run_id       uuid not null,
  engine       text not null,                      -- gemini | perplexity | openai
  mentioned    boolean not null default false,
  rank         int,                                -- order among businesses named in the answer
  cited        boolean not null default false,     -- your website is among the sources
  sources      text[] not null default '{}',
  competitors  text[] not null default '{}',
  sentiment    text,
  answer       text,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists geo_checks_biz_idx on public.geo_checks(business_id, created_at desc);
create index if not exists geo_checks_run_idx on public.geo_checks(run_id);

grant select, insert, update, delete on public.seo_keywords, public.seo_rankings, public.seo_daily, public.geo_prompts, public.geo_checks to authenticated;
revoke all on public.seo_keywords, public.seo_rankings, public.seo_daily, public.geo_prompts, public.geo_checks from anon;
grant all on public.seo_keywords, public.seo_rankings, public.seo_daily, public.geo_prompts, public.geo_checks to service_role;

do $$
declare t text;
begin
  foreach t in array array['seo_keywords','seo_rankings','seo_daily','geo_prompts','geo_checks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;
alter table public.seo_audits add column if not exists experts jsonb;
alter table public.seo_audits add column if not exists trigger text not null default 'manual'; -- manual | schedule

-- ═════════════════════════ v014 · Team, notifications, lead forms ═════════════════════════

-- Profiles mirror auth users (name + email) so teams and notifications can show/email people.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  created_at  timestamptz not null default now()
);
create or replace function public.gv_sync_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email, name = excluded.name;
  return new;
end $$;
drop trigger if exists gv_profile on auth.users;
create trigger gv_profile after insert or update of email, raw_user_meta_data on auth.users for each row execute function public.gv_sync_profile();
insert into public.profiles (id, email, name) select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) from auth.users on conflict (id) do nothing;

-- Team: people the account owner invites. workspace_ids null = every workspace (and the shared inbox/email/channels).
create table if not exists public.team_members (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  email          text not null,
  role           text not null default 'member',   -- admin | member | viewer
  workspace_ids  uuid[],
  status         text not null default 'invited',  -- invited | active
  invite_token   text unique,
  invited_by     uuid,
  created_at     timestamptz not null default now(),
  unique (owner_id, email)
);
create index if not exists team_members_user_idx on public.team_members(user_id, status);

-- Access rule used by every table: owner, or an active teammate (viewers read only; workspace limits apply to project data).
create or replace function public.gv_can(o uuid, b uuid, mode text) returns boolean language plpgsql stable security definer set search_path = public as $$
declare m record; ws uuid;
begin
  -- Your own rows — but only in your own projects (a row can't point at someone else's project).
  if o = auth.uid() then
    return b is null or not exists (select 1 from public.businesses where id = b) or exists (select 1 from public.businesses where id = b and owner_id = o);
  end if;
  select role, workspace_ids into m from public.team_members where owner_id = o and user_id = auth.uid() and status = 'active' limit 1;
  if not found then return false; end if;
  if mode = 'write' and m.role = 'viewer' then return false; end if;
  if m.workspace_ids is null then return true; end if;
  if b is null then return false; end if;
  select workspace_id into ws from public.businesses where id = b;
  return ws = any(m.workspace_ids);
end $$;

create or replace function public.gv_role(o uuid) returns text language sql stable security definer set search_path = public as $$
  select case when o = auth.uid() then 'owner' else (select role from public.team_members where owner_id = o and user_id = auth.uid() and status = 'active' limit 1) end;
$$;

-- Rows a teammate creates belong to the account they're working in (never to the teammate).
create or replace function public.gv_set_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); o uuid; bid uuid; hdr text;
begin
  if auth.uid() is null then return new; end if;               -- server jobs (service role) set owner themselves
  if tg_table_name = 'businesses' then
    select owner_id into o from public.workspaces where id = (j->>'workspace_id')::uuid;
    bid := null;
  else
    if j ? 'business_id' and (j->>'business_id') is not null then bid := (j->>'business_id')::uuid; select owner_id into o from public.businesses where id = bid; end if;
    if o is null and j ? 'campaign_id' and (j->>'campaign_id') is not null then select owner_id, business_id into o, bid from public.campaigns where id = (j->>'campaign_id')::uuid; end if;
    if o is null then
      hdr := current_setting('request.headers', true)::json->>'x-gv-project';
      if hdr ~ '^[0-9a-fA-F-]{36}$' then select owner_id, id into o, bid from public.businesses where id = hdr::uuid; end if;
      if tg_table_name <> 'activity' then bid := null; end if;
    end if;
    if o is null and not exists (select 1 from public.businesses where owner_id = auth.uid()) then
      select owner_id into o from public.team_members where user_id = auth.uid() and status = 'active' order by created_at limit 1; -- teammate with no projects of their own
    end if;
  end if;
  if o is not null and o <> auth.uid() and public.gv_can(o, bid, 'write') then new.owner_id := o; end if;
  return new;
end $$;

-- Replace the old owner-only policies with team-aware ones.
do $$
declare t text; bexpr text;
begin
  foreach t in array array['businesses','campaigns','content_items','leads','activity','mailboxes','email_templates','sequences','sequence_steps','enrollments','threads','messages','booking_pages','bookings','channel_accounts','social_posts','wa_broadcasts','seo_audits','seo_keywords','seo_rankings','seo_daily','geo_prompts','geo_checks'] loop
    bexpr := case
      when t = 'businesses' then 'id'
      when t = 'content_items' then '(select c.business_id from public.campaigns c where c.id = campaign_id)'
      when t in ('campaigns','leads','activity','seo_audits','seo_keywords','seo_rankings','seo_daily','geo_prompts','geo_checks') then 'business_id'
      else 'null::uuid' end;
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format('drop policy if exists "team_read" on public.%I', t);
    execute format('drop policy if exists "team_write" on public.%I', t);
    execute format('drop policy if exists "team_update" on public.%I', t);
    execute format('drop policy if exists "team_delete" on public.%I', t);
    execute format('create policy "team_read" on public.%I for select to authenticated using (public.gv_can(owner_id, %s, ''read''))', t, bexpr);
    execute format('create policy "team_write" on public.%I for insert to authenticated with check (public.gv_can(owner_id, %s, ''write''))', t, bexpr);
    execute format('create policy "team_update" on public.%I for update to authenticated using (public.gv_can(owner_id, %s, ''write'')) with check (public.gv_can(owner_id, %s, ''write''))', t, bexpr, bexpr);
    execute format('create policy "team_delete" on public.%I for delete to authenticated using (public.gv_can(owner_id, %s, ''write''))', t, bexpr);
    execute format('drop trigger if exists gv_owner on public.%I', t);
    execute format('create trigger gv_owner before insert on public.%I for each row execute function public.gv_set_owner()', t);
  end loop;
end $$;

-- Workspaces: owner, or teammates allowed in that workspace.
drop policy if exists "owner_all" on public.workspaces;
drop policy if exists "team_read" on public.workspaces;
drop policy if exists "team_manage" on public.workspaces;
create policy "team_read" on public.workspaces for select to authenticated using (
  owner_id = (select auth.uid()) or exists (select 1 from public.team_members m where m.owner_id = workspaces.owner_id and m.user_id = (select auth.uid()) and m.status = 'active' and (m.workspace_ids is null or workspaces.id = any(m.workspace_ids))));
create policy "team_manage" on public.workspaces for all to authenticated using (owner_id = (select auth.uid()) or public.gv_role(owner_id) = 'admin') with check (owner_id = (select auth.uid()) or public.gv_role(owner_id) = 'admin');
drop trigger if exists gv_owner on public.workspaces;
create trigger gv_owner before insert on public.workspaces for each row execute function public.gv_set_owner();

-- Team table: owner and admins manage; everyone can see their own membership.
alter table public.team_members enable row level security;
drop policy if exists "team_self" on public.team_members;
drop policy if exists "team_admin" on public.team_members;
create policy "team_self" on public.team_members for select to authenticated using (user_id = (select auth.uid()) or owner_id = (select auth.uid()) or public.gv_role(owner_id) = 'admin');
create policy "team_admin" on public.team_members for all to authenticated using (owner_id = (select auth.uid()) or public.gv_role(owner_id) = 'admin') with check (owner_id = (select auth.uid()) or public.gv_role(owner_id) = 'admin');

alter table public.profiles enable row level security;
drop policy if exists "profile_read" on public.profiles;
drop policy if exists "profile_self" on public.profiles;
create policy "profile_read" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (select 1 from public.team_members m where m.status = 'active' and ((m.owner_id = (select auth.uid()) and m.user_id = profiles.id) or (m.user_id = (select auth.uid()) and m.owner_id = profiles.id))));
create policy "profile_self" on public.profiles for update to authenticated using (id = (select auth.uid()));

-- Accept an invite (the signed-in email must match the invited email).
create or replace function public.accept_invite(tok text) returns text language plpgsql security definer set search_path = public as $$
declare m public.team_members; em text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  select * into m from public.team_members where invite_token = tok;
  if not found then return 'not_found'; end if;
  if lower(m.email) <> em then return 'wrong_email'; end if;
  update public.team_members set user_id = auth.uid(), status = 'active', invite_token = null where id = m.id;
  return 'ok';
end $$;
revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

-- Per-person notification choices (global settings).
create table if not exists public.user_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  notify      jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
drop policy if exists "prefs_self" on public.user_prefs;
create policy "prefs_self" on public.user_prefs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Every system email Growvia sends (for de-duplication and the "Recent emails" list).
create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete set null,
  type         text not null,
  recipients   text[] not null default '{}',
  subject      text,
  status       text not null default 'sent',   -- sent | failed | skipped
  error        text,
  dedupe       text unique,
  created_at   timestamptz not null default now()
);
create index if not exists email_log_owner_idx on public.email_log(owner_id, created_at desc);
alter table public.email_log enable row level security;
drop policy if exists "log_read" on public.email_log;
create policy "log_read" on public.email_log for select to authenticated using (public.gv_can(owner_id, business_id, 'read'));

-- Website lead forms (embeddable on any site).
create table if not exists public.lead_forms (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null default 'Website form',
  fields       jsonb not null default '[]',
  settings     jsonb not null default '{}',
  submissions  int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists lead_forms_business_idx on public.lead_forms(business_id);
alter table public.leads add column if not exists meta jsonb not null default '{}';
alter table public.leads add column if not exists form_id uuid references public.lead_forms(id) on delete set null;

grant select, insert, update, delete on public.team_members, public.user_prefs, public.lead_forms to authenticated;
grant select on public.profiles, public.email_log to authenticated;
grant update on public.profiles to authenticated;
revoke all on public.team_members, public.user_prefs, public.lead_forms, public.profiles, public.email_log from anon;
grant all on public.team_members, public.user_prefs, public.lead_forms, public.profiles, public.email_log to service_role;

do $$
begin
  execute 'alter table public.lead_forms enable row level security';
  execute 'drop policy if exists "team_read" on public.lead_forms';
  execute 'drop policy if exists "team_write" on public.lead_forms';
  execute 'create policy "team_read" on public.lead_forms for select to authenticated using (public.gv_can(owner_id, business_id, ''read''))';
  execute 'create policy "team_write" on public.lead_forms for all to authenticated using (public.gv_can(owner_id, business_id, ''write'')) with check (public.gv_can(owner_id, business_id, ''write''))';
  execute 'drop trigger if exists gv_owner on public.lead_forms';
  execute 'create trigger gv_owner before insert on public.lead_forms for each row execute function public.gv_set_owner()';
end $$;

-- One-off email broadcasts reuse the campaign engine (a one-email sequence that may send any day/hour).
alter table public.sequences add column if not exists kind text not null default 'campaign';
do $$ begin
  alter table public.sequences drop constraint if exists sequences_kind_check;
  alter table public.sequences add constraint sequences_kind_check check (kind in ('campaign','broadcast'));
end $$;
-- AI-written social posts remember the brief and image design they came from.
alter table public.social_posts add column if not exists ai jsonb;


-- ═════════════ v016 — Ad studio (text ads + video ads) ═════════════
create table if not exists public.ad_projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null default 'New ad',
  url          text,
  brief        jsonb not null default '{}',   -- site summary, offer, audience, images, colours
  text_ads     jsonb not null default '{}',   -- per platform
  video        jsonb not null default '{}',   -- script scenes + settings (format, avatar, voice, music, palette)
  audio_url    text,
  video_url    text,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ad_projects_business_idx on public.ad_projects(business_id, created_at desc);
grant select, insert, update, delete on public.ad_projects to authenticated;
revoke all on public.ad_projects from anon;
grant all on public.ad_projects to service_role;
do $$
begin
  execute 'alter table public.ad_projects enable row level security';
  execute 'drop policy if exists "team_read" on public.ad_projects';
  execute 'drop policy if exists "team_write" on public.ad_projects';
  execute 'create policy "team_read" on public.ad_projects for select to authenticated using (public.gv_can(owner_id, business_id, ''read''))';
  execute 'create policy "team_write" on public.ad_projects for all to authenticated using (public.gv_can(owner_id, business_id, ''write'')) with check (public.gv_can(owner_id, business_id, ''write''))';
  execute 'drop trigger if exists gv_owner on public.ad_projects';
  execute 'create trigger gv_owner before insert on public.ad_projects for each row execute function public.gv_set_owner()';
end $$;
-- Videos can be larger than photos; allow up to 100 MB per file in the media bucket.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    update storage.buckets set file_size_limit = null where id = 'media' and file_size_limit is not null and file_size_limit < 104857600;
  end if;
end $$;


-- ═════════════ v019 — Background jobs (AI work runs without blocking the screen) ═════════════
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,  -- who started it (gets the "ready" pop-up)
  kind         text not null,
  params       jsonb not null default '{}',
  title        text not null,
  link         text,
  status       text not null default 'queued' check (status in ('queued','running','done','failed')),
  message      text,
  result       jsonb,
  attempts     int not null default 0,
  seen         boolean not null default false,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index if not exists jobs_user_idx on public.jobs(user_id, created_at desc);
create index if not exists jobs_status_idx on public.jobs(status, created_at);
alter table public.jobs enable row level security;
drop policy if exists "jobs_read" on public.jobs;
create policy "jobs_read" on public.jobs for select to authenticated using (user_id = (select auth.uid()) or public.gv_can(owner_id, business_id, 'read'));
drop policy if exists "jobs_seen" on public.jobs;
create policy "jobs_seen" on public.jobs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, update on public.jobs to authenticated;
revoke all on public.jobs from anon;
grant all on public.jobs to service_role;


-- ═══════════ v020: Billing (Free / Pro subscriptions via Razorpay), usage meters, AI cache, invite lookup ═══════════

-- Invitation details for the invite page, readable without signing in (only with the secret token).
create or replace function public.invite_info(tok text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('email', m.email, 'role', m.role, 'owner_name', coalesce(p.name, split_part(p.email, '@', 1), 'the team'), 'owner_id', m.owner_id)
  from public.team_members m left join public.profiles p on p.id = m.owner_id
  where m.invite_token = tok and m.status = 'invited' and length(tok) >= 16 limit 1
$$;
revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;

-- One subscription per account (the account owner pays; the whole team gets the plan).
create table if not exists public.subscriptions (
  owner_id              uuid primary key references auth.users(id) on delete cascade,
  plan                  text not null default 'free' check (plan in ('free','pro','growth','agency')),
  status                text not null default 'none',   -- none | created | authenticated | active | pending | halted | cancelled | completed | expired | paused
  billing_interval      text check (billing_interval in ('month','year')),
  currency              text,                            -- USD | INR (what the card is charged in)
  amount                int,                             -- minor units per interval
  rzp_subscription_id   text unique,
  rzp_plan_id           text,
  rzp_customer_id       text,
  payment_method        text,
  short_url             text,
  current_start         timestamptz,
  current_end           timestamptz,
  cancel_at_period_end  boolean not null default false,
  cancelled_at          timestamptz,
  trial_end             timestamptz,
  replaces              text,                            -- older subscription this one takes over from (plan switch)
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subs_read" on public.subscriptions;
create policy "subs_read" on public.subscriptions for select to authenticated using (public.gv_can(owner_id, null, 'read'));
grant select on public.subscriptions to authenticated;
revoke all on public.subscriptions from anon;
grant all on public.subscriptions to service_role;

alter table public.subscriptions add column if not exists scheduled_change jsonb;   -- e.g. {"interval":"year","at":"…"} (switch at renewal)

-- Every new account starts with a 14-day Pro trial (no card). Existing accounts get theirs from today.
create or replace function public.gv_start_trial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (owner_id, trial_end) values (new.id, now() + interval '14 days') on conflict (owner_id) do nothing;
  return new;
end $$;
drop trigger if exists gv_trial on auth.users;
create trigger gv_trial after insert on auth.users for each row execute function public.gv_start_trial();
insert into public.subscriptions (owner_id, trial_end) select id, now() + interval '14 days' from auth.users on conflict (owner_id) do nothing;

-- Razorpay plan ids we've created (one per interval + currency + price).
create table if not exists public.billing_plans (
  key          text primary key,                        -- e.g. month-USD-1500
  rzp_plan_id  text not null,
  created_at   timestamptz not null default now()
);
alter table public.billing_plans enable row level security;
revoke all on public.billing_plans from anon, authenticated;
grant all on public.billing_plans to service_role;

-- Webhook events already handled (Razorpay retries; each event is applied once).
create table if not exists public.billing_events (
  id          text primary key,
  type        text not null,
  created_at  timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

-- Payment history (receipts / invoices).
create table if not exists public.payments (
  id               text primary key,                    -- Razorpay payment id
  owner_id         uuid not null references auth.users(id) on delete cascade,
  subscription_id  text,
  amount           int not null,
  currency         text not null,
  status           text not null,                       -- captured | failed | refunded
  method           text,
  invoice_id       text,
  invoice_url      text,
  paid_at          timestamptz not null default now()
);
create index if not exists payments_owner_idx on public.payments(owner_id, paid_at desc);
alter table public.payments enable row level security;
drop policy if exists "payments_read" on public.payments;
create policy "payments_read" on public.payments for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.payments to authenticated;
revoke all on public.payments from anon;
grant all on public.payments to service_role;

-- Monthly usage that isn't a row somewhere else (video exports).
create table if not exists public.usage_events (
  id          bigserial primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  ref         text,
  created_at  timestamptz not null default now()
);
create index if not exists usage_events_idx on public.usage_events(owner_id, kind, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists "usage_read" on public.usage_events;
create policy "usage_read" on public.usage_events for select to authenticated using (public.gv_can(owner_id, null, 'read'));
drop policy if exists "usage_add" on public.usage_events;
create policy "usage_add" on public.usage_events for insert to authenticated with check (public.gv_can(owner_id, null, 'write'));
grant select, insert on public.usage_events to authenticated;
grant usage on sequence public.usage_events_id_seq to authenticated;
revoke all on public.usage_events from anon;
grant all on public.usage_events to service_role;

-- Short-lived AI results (keyword / question suggestions) so they appear instantly the next time.
create table if not exists public.ai_cache (
  key         text primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  value       jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.ai_cache enable row level security;
drop policy if exists "ai_cache_rw" on public.ai_cache;
create policy "ai_cache_rw" on public.ai_cache for all to authenticated using (public.gv_can(owner_id, null, 'read')) with check (public.gv_can(owner_id, null, 'write'));
grant select, insert, update, delete on public.ai_cache to authenticated;
revoke all on public.ai_cache from anon;
grant all on public.ai_cache to service_role;


-- ═══════════ v026: Admin dashboard ═══════════
-- Pro given by the owner (no payment). status = 'comp'; comp_until null = no end date.
alter table public.subscriptions add column if not exists comp_until timestamptz;
alter table public.subscriptions add column if not exists admin_note text;

-- What the admin changed, and when.
create table if not exists public.admin_events (
  id          bigserial primary key,
  action      text not null,
  target_id   uuid,
  target_email text,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.admin_events enable row level security;
revoke all on public.admin_events from anon, authenticated;
grant all on public.admin_events to service_role;
grant usage on sequence public.admin_events_id_seq to service_role;

-- Per-account numbers for the admin users list (service role only).
create or replace function public.admin_user_stats() returns table (owner_id uuid, projects bigint, leads bigint, team bigint, emails_month bigint, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id,
    (select count(*) from public.businesses b where b.owner_id = u.id),
    (select count(*) from public.leads l where l.owner_id = u.id),
    (select count(*) from public.team_members t where t.owner_id = u.id),
    (select count(*) from public.messages m where m.owner_id = u.id and m.direction = 'out' and m.created_at >= date_trunc('month', now())),
    (select max(a.created_at) from public.activity a where a.owner_id = u.id)
  from auth.users u
$$;
revoke all on function public.admin_user_stats() from public, anon, authenticated;
grant execute on function public.admin_user_stats() to service_role;

-- ═════════════ v027: YouTube + Google Business Profile, honest scheduling, contact imports ═════════════
-- New connectable accounts: a YouTube channel and a Google Business Profile location (token = Google refresh token, encrypted).
do $$ begin
  alter table public.channel_accounts drop constraint if exists channel_accounts_provider_check;
  alter table public.channel_accounts add constraint channel_accounts_provider_check check (provider in ('whatsapp','facebook','instagram','youtube','gbp'));
end $$;
-- Per-post options (YouTube title/privacy, Google post button…).
alter table public.social_posts add column if not exists options jsonb not null default '{}';
-- Content planned for a channel Growvia can't post to: remind the team when it's due (once).
alter table public.content_items add column if not exists reminded_at timestamptz;

-- Before v027, "Schedule" on a content card only set a date and never posted. Those become "planned" (reminder only)
-- unless a real scheduled post exists for them.
update public.content_items c set status = 'approved'
where c.status = 'scheduled' and not exists (select 1 from public.social_posts p where p.content_item_id = c.id and p.status in ('scheduled','publishing','published','partial'));

-- Google Business Profile: daily performance, monthly search terms, reviews, Maps rank tracking.
create table if not exists public.gbp_daily (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day          date not null,
  search_views int not null default 0,
  maps_views   int not null default 0,
  calls        int not null default 0,
  website      int not null default 0,
  directions   int not null default 0,
  messages     int not null default 0,
  bookings     int not null default 0,
  primary key (business_id, day)
);
create table if not exists public.gbp_keywords (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  month        date not null,
  keyword      text not null,
  impressions  int not null default 0,
  below        boolean not null default false,   -- Google only says "fewer than N"
  primary key (business_id, month, keyword)
);
create table if not exists public.gbp_reviews (
  id           text primary key,                 -- Google review resource name
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reviewer     text not null default 'A Google user',
  photo        text,
  rating       int not null default 0,
  comment      text not null default '',
  reply        text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists gbp_reviews_biz_idx on public.gbp_reviews(business_id, created_at desc);
create table if not exists public.local_keywords (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  keyword      text not null,
  created_at   timestamptz not null default now(),
  unique (business_id, keyword)
);
create table if not exists public.local_ranks (
  keyword_id   uuid not null references public.local_keywords(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day          date not null,
  position     int,                              -- null = not in the top 20 on Google Maps
  rating       numeric,
  reviews      int,
  top          jsonb not null default '[]',      -- [{position, title, rating, reviews}]
  primary key (keyword_id, day)
);
create index if not exists local_ranks_biz_idx on public.local_ranks(business_id, day);
alter table public.businesses add column if not exists local_state jsonb not null default '{}';  -- last sync, profile check, errors

-- Contacts fetched from Google Contacts, waiting for the user to review and import (kept 1 day).
create table if not exists public.contact_imports (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  source       text not null default 'google',
  label        text,
  rows         jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

grant select, insert, update, delete on public.gbp_daily, public.gbp_keywords, public.gbp_reviews, public.local_keywords, public.local_ranks, public.contact_imports to authenticated;
revoke all on public.gbp_daily, public.gbp_keywords, public.gbp_reviews, public.local_keywords, public.local_ranks, public.contact_imports from anon;
grant all on public.gbp_daily, public.gbp_keywords, public.gbp_reviews, public.local_keywords, public.local_ranks, public.contact_imports to service_role;
do $$
declare t text;
begin
  foreach t in array array['gbp_daily','gbp_keywords','gbp_reviews','local_keywords','local_ranks','contact_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team_read" on public.%I', t);
    execute format('drop policy if exists "team_write" on public.%I', t);
    execute format('create policy "team_read" on public.%I for select to authenticated using (public.gv_can(owner_id, business_id, ''read''))', t);
    execute format('create policy "team_write" on public.%I for all to authenticated using (public.gv_can(owner_id, business_id, ''write'')) with check (public.gv_can(owner_id, business_id, ''write''))', t);
    execute format('drop trigger if exists gv_owner on public.%I', t);
    execute format('create trigger gv_owner before insert on public.%I for each row execute function public.gv_set_owner()', t);
  end loop;
end $$;

-- ═════════════ v029: Competitors (tracker + head-to-head) ═════════════
create table if not exists public.competitors (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name         text not null,
  website      text,                             -- host, e.g. pizzapalace.in
  place_id     text,                             -- Google Maps place id when known
  address      text,
  source       text not null default 'manual',   -- manual | maps | google | ai | settings
  created_at   timestamptz not null default now()
);
create unique index if not exists competitors_biz_name_idx on public.competitors(business_id, lower(name));
-- Weekly public numbers from Google Maps for you ('me') and each competitor (its id): rating + review count over time.
create table if not exists public.competitor_snapshots (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  subject      text not null,
  day          date not null,
  rating       numeric,
  reviews      int,
  primary key (business_id, subject, day)
);
-- Live Google results keep the top 20 sites so positions can be compared with competitors.
alter table public.seo_rankings add column if not exists top jsonb;

grant select, insert, update, delete on public.competitors, public.competitor_snapshots to authenticated;
revoke all on public.competitors, public.competitor_snapshots from anon;
grant all on public.competitors, public.competitor_snapshots to service_role;
do $$
declare t text;
begin
  foreach t in array array['competitors','competitor_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team_read" on public.%I', t);
    execute format('drop policy if exists "team_write" on public.%I', t);
    execute format('create policy "team_read" on public.%I for select to authenticated using (public.gv_can(owner_id, business_id, ''read''))', t);
    execute format('create policy "team_write" on public.%I for all to authenticated using (public.gv_can(owner_id, business_id, ''write'')) with check (public.gv_can(owner_id, business_id, ''write''))', t);
    execute format('drop trigger if exists gv_owner on public.%I', t);
    execute format('create trigger gv_owner before insert on public.%I for each row execute function public.gv_set_owner()', t);
  end loop;
end $$;
-- Competitors typed into SEO settings before v029 move to the new table.
insert into public.competitors (business_id, owner_id, name, website, source)
select b.id, b.owner_id, left(c->>'name', 80), nullif(c->>'domain', ''), 'settings'
from public.businesses b, jsonb_array_elements(coalesce(b.seo_prefs->'competitors', '[]'::jsonb)) c
where coalesce(c->>'name', '') <> ''
on conflict do nothing;

-- ═════════════ v029: Sending health (email, WhatsApp, domains) + safe warm-up ═════════════
-- Per-message delivery outcomes, so bounce/unsubscribe rates can be measured per mailbox.
alter table public.messages add column if not exists bounced_at timestamptz;
alter table public.messages add column if not exists unsubscribed_at timestamptz;
update public.messages set bounced_at = coalesce(sent_at, created_at)
where bounced_at is null and direction = 'out' and status = 'failed' and error ~* '(bounce|user unknown|no such user|does not exist|rejected)';
create index if not exists messages_mailbox_sent_idx on public.messages(mailbox_id, sent_at) where direction = 'out';
-- Warm-up schedule + latest health verdict per mailbox.
alter table public.mailboxes add column if not exists warmup jsonb not null default '{}';   -- {enabled, started_at, start, step}
alter table public.mailboxes add column if not exists health jsonb not null default '{}';   -- {score, status, reasons, paused, paused_reason, checked_at, ...}
-- leads.email_status: ok | bounced | invalid (no mail server / bad format) | risky (disposable). invalid is skipped like bounced.

-- Sending domains: DNS setup (SPF, DKIM, DMARC, MX), blocklists, Gmail Postmaster data.
create table if not exists public.sender_domains (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  domain       text not null,
  checks       jsonb not null default '{}',
  postmaster   jsonb,
  checked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (owner_id, domain)
);
-- Google Postmaster Tools connection (one Google account per Growvia account).
create table if not exists public.postmaster_links (
  owner_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  refresh_enc  text not null,
  email        text,
  domains      text[] not null default '{}',
  error        text,
  synced_at    timestamptz,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.sender_domains, public.postmaster_links to authenticated;
revoke all on public.sender_domains, public.postmaster_links from anon;
grant all on public.sender_domains, public.postmaster_links to service_role;
do $$
declare t text;
begin
  foreach t in array array['sender_domains','postmaster_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team_read" on public.%I', t);
    execute format('drop policy if exists "team_write" on public.%I', t);
    execute format('create policy "team_read" on public.%I for select to authenticated using (public.gv_can(owner_id, null::uuid, ''read''))', t);
    execute format('create policy "team_write" on public.%I for all to authenticated using (public.gv_can(owner_id, null::uuid, ''write'')) with check (public.gv_can(owner_id, null::uuid, ''write''))', t);
    execute format('drop trigger if exists gv_owner on public.%I', t);
    execute format('create trigger gv_owner before insert on public.%I for each row execute function public.gv_set_owner()', t);
  end loop;
end $$;

-- ═════════════ v030: faster dashboard ═════════════
-- The plan for a project's owner in one call (lets the sidebar load in the same round trip as everything else).
create or replace function public.project_plan(pid uuid) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('owner_id', b.owner_id,
    'sub', (select row_to_json(s) from public.subscriptions s where s.owner_id = b.owner_id),
    'email', (select u.email from auth.users u where u.id = b.owner_id))
  from public.businesses b where b.id = pid and public.gv_can(b.owner_id, b.id, 'read');
$$;
revoke all on function public.project_plan(uuid) from public, anon;
grant execute on function public.project_plan(uuid) to authenticated, service_role;
-- Indexes for the counts every dashboard page shows.
create index if not exists leads_business_stage_idx on public.leads(business_id, stage);
create index if not exists threads_unread_idx on public.threads(owner_id) where unread;

-- ═════════════ v039: Growth plan + self-serve Agency ═════════════
-- Plans are now free | pro | growth | agency (upgrades start at once with unused days refunded; downgrades start at period end).
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free','pro','growth','agency'));

-- Make the API see the new tables/columns right away.
notify pgrst, 'reload schema';

-- ═════════════ v044: in-app notifications (bell, toasts, celebrations) ═════════════
create table if not exists public.app_notifications (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null,              -- post_live | post_failed | post_scheduled | channel | milestone
  title       text not null,
  body        text,
  url         text,                       -- where the notification opens (a post permalink or an app page)
  provider    text,                       -- facebook | instagram | youtube | gbp … (for the icon)
  celebrate   text,                       -- set on milestones (first post, 10th post …) to show the celebration once
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists app_notifications_owner_idx on public.app_notifications(owner_id, created_at desc);
alter table public.app_notifications enable row level security;
grant select, update on public.app_notifications to authenticated;
grant all on public.app_notifications to service_role;
revoke all on public.app_notifications from anon;
drop policy if exists "team_read" on public.app_notifications;
drop policy if exists "team_update" on public.app_notifications;
create policy "team_read" on public.app_notifications for select to authenticated using (public.gv_can(owner_id, null, 'read'));
create policy "team_update" on public.app_notifications for update to authenticated using (public.gv_can(owner_id, null, 'read')) with check (public.gv_can(owner_id, null, 'read'));


-- ═════════════ v047: PayPal (prepaid) plans through Razorpay ═════════════
-- provider: razorpay (card/UPI subscription) | prepaid (one-time PayPal month/year; status 'prepaid' until current_end)
alter table public.subscriptions add column if not exists provider text not null default 'razorpay';
create index if not exists subscriptions_prepaid_idx on public.subscriptions(current_end) where provider = 'prepaid';

