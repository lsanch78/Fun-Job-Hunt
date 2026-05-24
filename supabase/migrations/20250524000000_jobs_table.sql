-- ============================================================
-- EffJobHunt: Jobs table
-- Migration: 20250524000000_jobs_table
-- ============================================================

create table if not exists public.jobs (
  id               uuid        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  company          text        not null,
  title            text        not null,
  status           text        not null default 'APPLIED'
    check (status in ('APPLIED','PHONE_SCREEN','INTERVIEW','OFFER','REJECTED','GHOSTED','WITHDRAWN')),
  posting_url      text,
  date_applied     text        not null,
  interview_stage  text
    check (interview_stage is null or interview_stage in ('PHONE','TECHNICAL','ONSITE','FINAL','OFFER')),
  rating           integer     not null default 0
    check (rating between 0 and 5),
  salary           text
);

-- Performance: user's own jobs sorted by date
create index if not exists jobs_user_id_date_idx
  on public.jobs(user_id, date_applied desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.jobs enable row level security;

create policy "jobs_owner_policy"
  on public.jobs for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
