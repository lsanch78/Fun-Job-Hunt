-- Migration: 20250522000001_search_profiles_locations
-- Replace the single `location` text column with `locations text[]`
-- to support multiple locations and/or Remote simultaneously.

alter table public.search_profiles
  rename column location to locations;

alter table public.search_profiles
  alter column locations type text[] using
    case
      when locations is null or locations = '' then '{}'::text[]
      else array[locations]
    end;

alter table public.search_profiles
  alter column locations set default '{}';

alter table public.search_profiles
  alter column locations set not null;
