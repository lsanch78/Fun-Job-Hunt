create table company_contact_cache (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  contacts jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  cache_hits integer not null default 0,
  cache_misses integer not null default 0
);

-- Only service role can read/write — no user-level RLS needed
alter table company_contact_cache enable row level security;
