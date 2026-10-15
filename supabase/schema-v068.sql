-- v068: forms v2 — stable field keys, submissions timeline, blocked-attempt log, server keys, private uploads.
-- Safe to run more than once.

-- 1. Server key (only a hash is stored; the key is shown once in the builder).
alter table public.lead_forms add column if not exists server_key_hash text;

-- 2. One row per submission: answers by field key, consent, hidden values, page, UTMs, files.
create table if not exists public.lead_submissions (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  form_id     uuid references public.lead_forms(id) on delete set null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  form_name   text,
  email       text,
  answers     jsonb not null default '{}',
  labels      jsonb not null default '{}',
  consent     jsonb,
  hidden      jsonb not null default '{}',
  page        text,
  referrer    text,
  utm         jsonb not null default '{}',
  files       jsonb not null default '[]',
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists lead_submissions_lead_idx on public.lead_submissions(lead_id, created_at desc);
create index if not exists lead_submissions_rate_idx on public.lead_submissions(form_id, ip_hash, created_at desc);
create index if not exists lead_submissions_email_idx on public.lead_submissions(form_id, email, created_at desc);

-- 3. Blocked attempts (bot trap, too fast, rate limits, wrong website, failed human check).
create table if not exists public.form_blocks (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.lead_forms(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reason      text not null,
  ip_hash     text,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists form_blocks_form_idx on public.form_blocks(form_id, created_at desc);

grant select on public.lead_submissions, public.form_blocks to authenticated;
revoke all on public.lead_submissions, public.form_blocks from anon;
grant all on public.lead_submissions, public.form_blocks to service_role;
alter table public.lead_submissions enable row level security;
alter table public.form_blocks enable row level security;
drop policy if exists "team_read" on public.lead_submissions;
create policy "team_read" on public.lead_submissions for select to authenticated using (public.gv_can(owner_id, business_id, 'read'));
drop policy if exists "team_read" on public.form_blocks;
create policy "team_read" on public.form_blocks for select to authenticated using (public.gv_can(owner_id, business_id, 'read'));

-- 4. Private bucket for uploaded files (only the server reads it; the app hands out 10-minute links).
insert into storage.buckets (id, name, public) values ('form-uploads', 'form-uploads', false) on conflict (id) do nothing;

-- 5. Upgrade existing forms without changing behaviour:
--    a) every field gets key = its current posted name (id), so live embeds keep working;
update public.lead_forms lf set fields = (
  select coalesce(jsonb_agg(case when f ? 'key' then f else f || jsonb_build_object('key', f->>'id') end order by ord), '[]'::jsonb)
  from jsonb_array_elements(lf.fields) with ordinality as t(f, ord)
) where exists (select 1 from jsonb_array_elements(lf.fields) f where not (f ? 'key'));
--    b) auto-reply written down explicitly (v1 treated "missing" as ON) so the new OFF default changes nothing;
update public.lead_forms set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{auto_reply}',
  coalesce(settings->'auto_reply', '{}'::jsonb) || jsonb_build_object('enabled', coalesce((settings->'auto_reply'->>'enabled')::boolean, true)))
where coalesce(settings->>'version', '1') <> '2';
--    c) "redblink, website" → ["redblink","website"];
update public.lead_forms set settings = settings || jsonb_build_object('tags', coalesce((
  select jsonb_agg(distinct lower(trim(t))) from unnest(string_to_array(coalesce(settings->>'tag', 'website'), ',')) t where trim(t) <> ''), '[]'::jsonb))
where not (settings ? 'tags');
--    d) mark as v2.
update public.lead_forms set settings = settings || '{"version":2}'::jsonb where coalesce(settings->>'version', '1') <> '2';

-- 6. Review list: forms whose visitor auto-reply is ON (run this and check each one).
select lf.id, lf.name as form, b.name as project, lf.settings->'auto_reply'->>'subject' as subject
from public.lead_forms lf join public.businesses b on b.id = lf.business_id
where (lf.settings->'auto_reply'->>'enabled')::boolean is true
order by b.name, lf.name;
