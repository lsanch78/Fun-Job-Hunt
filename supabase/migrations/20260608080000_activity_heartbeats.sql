-- Replace punch-in/punch-out workday tracking with 15-minute activity heartbeats.
-- Sessions are computed client-side by grouping consecutive heartbeats with gaps <= 30 min.

create table activity_heartbeats (
  id      uuid        primary key default gen_random_uuid(),
  user_id uuid        not null references auth.users on delete cascade,
  ts      timestamptz not null    default now()
);

alter table activity_heartbeats enable row level security;

create policy "Users can manage their own heartbeats"
  on activity_heartbeats for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index activity_heartbeats_user_ts on activity_heartbeats (user_id, ts desc);

drop table if exists workdays;
