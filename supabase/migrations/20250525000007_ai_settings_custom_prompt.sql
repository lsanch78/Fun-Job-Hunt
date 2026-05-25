-- ============================================================
-- EffJobHunt: Add custom_prompt column to ai_settings
-- Migration: 20250525000007_ai_settings_custom_prompt
-- ============================================================

alter table public.ai_settings
  add column if not exists custom_prompt text not null default '';
