-- ── Subscriptions table ───────────────────────────────────────────────────────
-- Tracks Stripe subscription state per user.
-- Only written by edge functions using the service role key.

create table if not exists subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text unique,
  stripe_subscription_id text unique,
  status               text not null default 'free',  -- 'free' | 'active' | 'canceled'
  current_period_end   timestamptz,
  updated_at           timestamptz default now()
);

-- Users can read their own row; no client-side writes (service role only)
alter table subscriptions enable row level security;

create policy "Users can read own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);
