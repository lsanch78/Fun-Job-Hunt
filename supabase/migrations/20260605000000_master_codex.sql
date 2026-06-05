create table if not exists public.master_codex (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  content       jsonb       not null default '{}',
  section_order text[]      not null default '{}',
  updated_at    timestamptz not null default now(),
  constraint master_codex_user_id_key unique (user_id)
);

alter table public.master_codex enable row level security;

create policy "Users manage own master codex"
  on public.master_codex for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
