-- ============================================================
-- EffJobHunt: Workdays table
-- Migration: 20250524000001_workdays_table
-- ============================================================

create table if not exists public.workdays (
  id        uuid        primary key default gen_random_uuid(),
  user_id   uuid        not null references auth.users(id) on delete cascade,
  punch_in  timestamptz not null,
  punch_out timestamptz,                 -- null while session is active
  date      text        not null         -- YYYY-MM-DD of punch_in (local date at punch-in time)
);

-- Performance: user's sessions sorted by date
create index if not exists workdays_user_id_date_idx
  on public.workdays(user_id, date desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.workdays enable row level security;

create policy "workdays_owner_policy"
  on public.workdays for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
