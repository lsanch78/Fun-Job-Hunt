-- ============================================================
-- EffJobHunt: Drop interview_stage column from jobs
-- Migration: 20250524000002_drop_interview_stage
-- ============================================================

alter table public.jobs drop column if exists interview_stage;
