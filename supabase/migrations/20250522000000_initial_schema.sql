-- ============================================================
-- EffJobHunt: Initial schema
-- Migration: 20250522000000_initial_schema
-- ============================================================

-- gen_random_uuid() is built into Postgres 13+ (pgcrypto) and always available on Supabase.
-- uuid-ossp / gen_random_uuid() is not reliably on the search path on hosted instances.

-- ============================================================
-- TABLE: search_profiles
-- ============================================================
create table if not exists public.search_profiles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  job_titles      text[] not null default '{}',
  keywords        text[] not null default '{}',
  location        text,
  sources         text[] not null default '{"linkedin","handshake"}',
  active          boolean not null default true,
  min_match_score integer not null default 50
    check (min_match_score between 0 and 100),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE: resume
-- FK to auth.users (Supabase built-in auth table)
-- ============================================================
create table if not exists public.resume (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  structured_json jsonb not null default '{}',
  raw_text        text not null default '',
  updated_at      timestamptz not null default now()
);

-- One resume per user
create unique index if not exists resume_user_id_unique
  on public.resume(user_id);

-- ============================================================
-- TABLE: form_answer_map
-- ============================================================
create table if not exists public.form_answer_map (
  id          uuid primary key default gen_random_uuid(),
  key         text not null,
  value       text not null default '',
  type        text not null default 'factual'
    check (type in ('factual', 'essay', 'sensitive')),
  essay_bank  jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists form_answer_map_key_unique
  on public.form_answer_map(key);

-- ============================================================
-- TABLE: job_postings
-- ============================================================
create table if not exists public.job_postings (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  company         text not null,
  description     text not null default '',
  requirements    text not null default '',
  application_url text not null,
  source          text not null
    check (source in ('linkedin', 'handshake')),
  url_hash        text not null,
  match_score     integer not null default 0
    check (match_score between 0 and 100),
  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  request_review  boolean not null default false,
  scraped_at      timestamptz not null default now()
);

-- Acceptance criteria: unique indexes
create unique index if not exists job_postings_application_url_unique
  on public.job_postings(application_url);

create unique index if not exists job_postings_url_hash_unique
  on public.job_postings(url_hash);

-- Performance indexes for review queue queries
create index if not exists job_postings_status_idx
  on public.job_postings(status);

create index if not exists job_postings_scraped_at_idx
  on public.job_postings(scraped_at desc);

-- ============================================================
-- TABLE: application_records
-- ============================================================
create table if not exists public.application_records (
  id                       uuid primary key default gen_random_uuid(),
  job_posting_id           uuid not null
    references public.job_postings(id) on delete cascade,
  status                   text not null default 'queued'
    check (status in ('queued', 'in_progress', 'submitted', 'failed', 'skipped')),
  tailored_resume_snapshot text not null default '',
  form_answers_used        jsonb not null default '{}',
  outcome                  text,
  created_at               timestamptz not null default now()
);

create index if not exists application_records_job_posting_id_idx
  on public.application_records(job_posting_id);

-- ============================================================
-- REALTIME: enable on job_postings
-- Publishes INSERT/UPDATE/DELETE events to subscribers
-- ============================================================
alter publication supabase_realtime add table public.job_postings;

-- ============================================================
-- ROW LEVEL SECURITY
-- Enabled on all tables. Temporary permissive policies for
-- single-user v1 — will be replaced with user-scoped policies
-- in a later issue.
-- ============================================================
alter table public.search_profiles      enable row level security;
alter table public.resume               enable row level security;
alter table public.form_answer_map      enable row level security;
alter table public.job_postings         enable row level security;
alter table public.application_records  enable row level security;

create policy "authenticated_full_access_search_profiles"
  on public.search_profiles for all
  to authenticated using (true) with check (true);

create policy "authenticated_full_access_resume"
  on public.resume for all
  to authenticated using (true) with check (true);

create policy "authenticated_full_access_form_answer_map"
  on public.form_answer_map for all
  to authenticated using (true) with check (true);

create policy "authenticated_full_access_job_postings"
  on public.job_postings for all
  to authenticated using (true) with check (true);

create policy "authenticated_full_access_application_records"
  on public.application_records for all
  to authenticated using (true) with check (true);
