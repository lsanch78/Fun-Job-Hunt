-- ============================================================
-- EffJobHunt: AI settings table
-- Migration: 20250525000006_ai_settings
-- Stores user-editable system prompts for the AI assistant.
-- One row per user. Missing row = use hardcoded defaults.
-- ============================================================

create table if not exists public.ai_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  cover_letter_prompt text not null default '',
  why_good_fit_prompt text not null default '',
  updated_at          timestamptz not null default now()
);

alter table public.ai_settings enable row level security;

create policy "ai_settings_select"
  on public.ai_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "ai_settings_insert"
  on public.ai_settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "ai_settings_update"
  on public.ai_settings for update
  to authenticated
  using (user_id = auth.uid());

create policy "ai_settings_delete"
  on public.ai_settings for delete
  to authenticated
  using (user_id = auth.uid());
