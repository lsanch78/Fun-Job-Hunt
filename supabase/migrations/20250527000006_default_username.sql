-- Sequence for auto-incrementing hunter numbers
create sequence if not exists public.hunter_number_seq start 1;

-- Trigger function: assign a default username to new users who don't have one
create or replace function public.assign_default_username()
returns trigger language plpgsql security definer as $$
declare
  existing_username text;
  new_number        int;
begin
  existing_username := new.raw_user_meta_data ->> 'username';

  -- Only assign if no username was set (e.g. OAuth providers may set one)
  if existing_username is null or trim(existing_username) = '' then
    new_number := nextval('public.hunter_number_seq');
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', 'Job Hunter ' || lpad(new_number::text, 4, '0'));
  end if;

  return new;
end;
$$;

-- Fire before insert so the metadata is set when the row lands
drop trigger if exists on_auth_user_created_default_username on auth.users;
create trigger on_auth_user_created_default_username
  before insert on auth.users
  for each row execute function public.assign_default_username();
