create table feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,
  topic      text        not null,
  contact    text,
  message    text        not null,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "authenticated users can submit feedback"
  on feedback for insert
  to authenticated
  with check (true);

create policy "dev can read all feedback"
  on feedback for select
  using (auth.jwt() ->> 'email' = 'luis.sanchez01994@gmail.com');
