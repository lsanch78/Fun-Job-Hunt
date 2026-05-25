-- Add detail-card fields to the jobs table (lazy-loaded, all nullable)
alter table public.jobs
  add column if not exists description text,
  add column if not exists contacts    text,
  add column if not exists notes       text;
