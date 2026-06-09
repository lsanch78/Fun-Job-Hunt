alter table public.jobs
  add column if not exists has_description boolean not null default false;

-- Backfill existing rows
update public.jobs
  set has_description = (description is not null and description <> '');

-- Trigger to keep has_description in sync with description
create or replace function public.sync_has_description()
returns trigger language plpgsql as $$
begin
  new.has_description := (new.description is not null and new.description <> '');
  return new;
end;
$$;

create or replace trigger trg_sync_has_description
  before insert or update of description on public.jobs
  for each row execute function public.sync_has_description();
