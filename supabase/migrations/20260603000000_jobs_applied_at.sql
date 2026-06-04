alter table public.jobs add column if not exists applied_at timestamptz;

update public.jobs
  set applied_at = (date_applied || 'T00:00:00Z')::timestamptz
  where applied_at is null;

alter table public.jobs
  alter column applied_at set not null,
  alter column applied_at set default now();

drop index if exists jobs_user_id_date_idx;
alter table public.jobs drop column date_applied;

create index jobs_user_id_applied_at_idx on public.jobs(user_id, applied_at desc);
