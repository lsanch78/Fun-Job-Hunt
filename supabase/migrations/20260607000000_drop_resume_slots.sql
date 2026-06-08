-- Drop deprecated A/B/C resume slot system.
-- The master_cv / curated_resumes tables are the current resume system and are unaffected.

-- Drop the resume_slots table (cascades RLS policies automatically).
-- NOTE: delete the 'resumes' storage bucket manually via the Supabase dashboard.
drop table if exists public.resume_slots;
