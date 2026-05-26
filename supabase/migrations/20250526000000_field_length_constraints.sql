-- ============================================================
-- EffJobHunt: Field length constraints
-- Migration: 20250526000000_field_length_constraints
-- Adds varchar(N) limits as a DB-level backstop.
-- Frontend maxLength and service-layer validation are the
-- first two layers. This is the final guard that cannot be
-- bypassed by direct API calls.
-- See docs/SCALABILITY.md for rationale and limit values.
-- ============================================================

-- jobs table
alter table public.jobs
  alter column company      type varchar(100),
  alter column title        type varchar(150),
  alter column posting_url  type varchar(500),
  alter column salary       type varchar(20),
  alter column description  type varchar(5000),
  alter column contacts     type varchar(1000),
  alter column notes        type varchar(2000);

-- ai_settings table
alter table public.ai_settings
  alter column cover_letter_prompt type varchar(3000),
  alter column why_good_fit_prompt type varchar(3000);

-- resume_slots table
alter table public.resume_slots
  alter column name type varchar(50);

-- quick_cast_links table
alter table public.quick_cast_links
  alter column label type varchar(50),
  alter column url   type varchar(500),
  alter column icon  type varchar(50);

-- music_tracks table
alter table public.music_tracks
  alter column url      type varchar(500),
  alter column video_id type varchar(20),
  alter column title    type varchar(100);
