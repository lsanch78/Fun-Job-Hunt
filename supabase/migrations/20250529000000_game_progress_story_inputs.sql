alter table public.game_progress
  add column if not exists story_inputs text[] not null default '{}';

-- Sets a single index in story_inputs, growing the array as needed.
create or replace function public.set_story_input(p_user_id uuid, p_index integer, p_value text)
returns void language plpgsql security definer as $$
begin
  insert into public.game_progress (user_id, story_inputs, updated_at)
    values (p_user_id, array_fill(''::text, array[p_index + 1]), now())
  on conflict (user_id) do update
    set story_inputs = (
          select array_agg(
            case when i - 1 = p_index then p_value
                 else coalesce(v, '')
            end order by i
          )
          from generate_series(
            1,
            greatest(array_length(public.game_progress.story_inputs, 1), p_index + 1)
          ) as i
          left join unnest(public.game_progress.story_inputs) with ordinality as u(v, ord)
            on u.ord = i
        ),
        updated_at = now();
end;
$$;
