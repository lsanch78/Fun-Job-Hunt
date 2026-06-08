-- Replace get_global_stats() now that applied_at exists on jobs.
-- The original definition in 20250525000005 stubbed avg_days_to_offer as null
-- because the column didn't exist yet at that point in migration order.

create or replace function public.get_global_stats()
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'hunters',
    (
      select count(distinct user_id)
      from public.jobs
      where status in ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW')
    ),

    'employed',
    (
      select count(distinct user_id)
      from public.jobs
      where status = 'OFFER'
    ),

    'interviews',
    (
      select count(*)
      from public.jobs
      where status in ('PHONE_SCREEN', 'INTERVIEW', 'OFFER')
    ),

    'avg_interview_rate',
    (
      select round(avg(rate)::numeric, 1)
      from (
        select
          user_id,
          count(*) filter (where status in ('PHONE_SCREEN','INTERVIEW','OFFER'))::float
            / nullif(count(*), 0) * 100 as rate
        from public.jobs
        group by user_id
        having count(*) >= 3
      ) rates
    ),

    'avg_days_to_offer',
    (
      select round(avg(days_diff)::numeric, 0)
      from (
        select
          j.user_id,
          min(now()::date - j.applied_at::date) as days_diff
        from public.jobs j
        where j.status = 'OFFER'
        group by j.user_id
      ) offer_days
    ),

    'total_apps',
    (
      select count(*) from public.jobs
    )
  );
$$;

grant execute on function public.get_global_stats() to anon, authenticated;
