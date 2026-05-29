alter table public.game_progress
  drop column if exists story_inputs;

drop function if exists public.set_story_input(uuid, integer, text);
