-- Growvia v047 — run once in Supabase → SQL Editor.
-- ═════════════ v047: PayPal (prepaid) plans through Razorpay ═════════════
-- provider: razorpay (card/UPI subscription) | prepaid (one-time PayPal month/year; status 'prepaid' until current_end)
alter table public.subscriptions add column if not exists provider text not null default 'razorpay';
create index if not exists subscriptions_prepaid_idx on public.subscriptions(current_end) where provider = 'prepaid';

notify pgrst, 'reload schema';
