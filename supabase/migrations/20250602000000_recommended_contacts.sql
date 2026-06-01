create table recommended_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  title text,
  email text,
  linkedin_url text,
  company text,
  seniority text check (seniority in ('peer', 'manager')),
  why text,
  created_at timestamptz default now()
);

alter table recommended_contacts enable row level security;

create policy "Users see own contacts" on recommended_contacts
  for select using (auth.uid() = user_id);

create policy "Service role can insert" on recommended_contacts
  for insert with check (true);
