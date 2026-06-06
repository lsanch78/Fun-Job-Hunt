-- cover_letters table
create table if not exists cover_letters (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null default '',
  body             text not null default '',
  job_description  text not null default '',
  created_at       timestamptz not null default now()
);

alter table cover_letters enable row level security;

create policy "Users manage own cover letters"
  on cover_letters for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- FK from jobs to cover_letters (nullable)
alter table jobs
  add column if not exists cover_letter_id uuid
    references cover_letters(id) on delete set null;
