create table claude_rec_cache (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  title_bucket text not null,
  recommendations jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  cache_hits integer not null default 0,
  unique (company_name, title_bucket)
);

alter table claude_rec_cache enable row level security;
