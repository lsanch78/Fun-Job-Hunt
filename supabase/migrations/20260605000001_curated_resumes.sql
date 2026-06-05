create table if not exists public.curated_resumes (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  label            text        not null default 'Untitled',
  content          jsonb       not null default '{}',
  section_order    text[]      not null default '{}',
  matched_keywords text[]      not null default '{}',
  created_at       timestamptz not null default now()
);

alter table public.curated_resumes enable row level security;

create policy "curated_resumes_owner"
  on public.curated_resumes for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index curated_resumes_user_id_idx on public.curated_resumes(user_id);
