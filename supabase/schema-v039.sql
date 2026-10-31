-- Growvia v039 — run once in Supabase → SQL Editor.
-- ═════════════ v039: Growth plan + self-serve Agency ═════════════
-- Plans are now free | pro | growth | agency (upgrades start at once with unused days refunded; downgrades start at period end).
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free','pro','growth','agency'));

notify pgrst, 'reload schema';
