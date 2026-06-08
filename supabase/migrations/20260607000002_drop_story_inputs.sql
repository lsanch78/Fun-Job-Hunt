-- Drop story_inputs column and set_story_input RPC added by the now-deleted
-- story mode feature (originally in 20250529000000_game_progress_story_inputs.sql).
-- Story mode was removed in full; these objects serve no purpose.

alter table public.game_progress
  drop column if exists story_inputs;

drop function if exists public.set_story_input(uuid, integer, text);
