-- music_tracks: per-user YouTube track queue for the music player
create table if not exists public.music_tracks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  video_id   text not null,
  title      text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index music_tracks_user_id_idx on public.music_tracks (user_id, position);

alter table public.music_tracks enable row level security;

create policy "owner access" on public.music_tracks
  for all using (user_id = auth.uid());
