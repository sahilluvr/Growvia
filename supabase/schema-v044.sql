-- Growvia v044 — run once in Supabase → SQL Editor.
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

notify pgrst, 'reload schema';
