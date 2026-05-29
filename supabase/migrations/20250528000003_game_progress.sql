create table if not exists public.game_progress (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  xp        integer not null default 0,
  employed  boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.game_progress enable row level security;

create policy "Users can read/write own game_progress"
  on public.game_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Atomic XP award — XP never decreases, upserts the row if missing
create or replace function public.increment_xp(p_user_id uuid, p_delta integer)
returns void language plpgsql security definer as $$
begin
  insert into public.game_progress (user_id, xp, updated_at)
    values (p_user_id, p_delta, now())
  on conflict (user_id) do update
    set xp = public.game_progress.xp + p_delta,
        updated_at = now();
end;
$$;
