-- ============================================================
-- EffJobHunt: Global public stats RPC
-- Migration: 20250525000005_global_stats_fn
--
-- Returns aggregate metrics across ALL users so the auth page
-- can show a live "community ticker" without exposing any PII.
-- SECURITY DEFINER lets unauthenticated callers run the query
-- while bypassing RLS (we only return counts, never user data).
-- ============================================================

create or replace function public.get_global_stats()
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    -- Users currently job-hunting: have at least one job not in a terminal status
    'hunters',
    (
      select count(distinct user_id)
      from public.jobs
      where status in ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW')
    ),

    -- Users who landed a job: have at least one OFFER
    'employed',
    (
      select count(distinct user_id)
      from public.jobs
      where status = 'OFFER'
    ),

    -- Total interview-stage events across all users
    'interviews',
    (
      select count(*)
      from public.jobs
      where status in ('PHONE_SCREEN', 'INTERVIEW', 'OFFER')
    ),

    -- Average interview conversion rate per user (apps → interview+)
    -- Computed as: for each user with ≥1 app, calc their rate, then average
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
        having count(*) >= 3   -- only users with meaningful sample size
      ) rates
    ),

    -- Average days to first OFFER per user who received one
    -- (applied_at column added in 20260603000000; function replaced there)
    'avg_days_to_offer',
    null,

    -- Total applications submitted across the platform
    'total_apps',
    (
      select count(*) from public.jobs
    )
  );
$$;

-- Allow unauthenticated (anon) callers to invoke this function
grant execute on function public.get_global_stats() to anon, authenticated;
