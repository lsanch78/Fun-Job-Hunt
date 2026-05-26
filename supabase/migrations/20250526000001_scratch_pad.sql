-- Scratch pad: one row per user, two text columns (notes + checklist JSON)
create table if not exists scratch_pad (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  notes     text check (char_length(notes) <= 8000),
  list      text check (char_length(list)  <= 8000),
  updated_at timestamptz not null default now()
);

alter table scratch_pad enable row level security;

create policy "Users manage own scratch pad"
  on scratch_pad for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
