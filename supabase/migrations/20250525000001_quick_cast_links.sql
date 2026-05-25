-- quick_cast_links: per-user hotbar slots for the QuickCast panel
create table if not exists public.quick_cast_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null default '',
  url        text not null,
  icon       text not null default 'link',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index quick_cast_links_user_id_idx on public.quick_cast_links (user_id, position);

alter table public.quick_cast_links enable row level security;

create policy "owner access" on public.quick_cast_links
  for all using (user_id = auth.uid());
