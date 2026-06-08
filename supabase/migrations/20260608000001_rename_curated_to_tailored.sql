-- Rename curated_resumes → tailored_resumes and update the jobs FK column.
-- Safe pattern: rename table, add new column, backfill, drop old column.

-- 1. Rename the table
alter table public.curated_resumes rename to tailored_resumes;

-- 2. Rename the RLS policy so it stays meaningful
alter policy "curated_resumes_owner" on public.tailored_resumes
  rename to "tailored_resumes_owner";

-- 3. Rename the index
alter index if exists curated_resumes_user_id_idx
  rename to tailored_resumes_user_id_idx;

-- 4. Add the new FK column on jobs (nullable, no constraint yet)
alter table public.jobs
  add column if not exists tailored_resume_id uuid;

-- 5. Backfill from old column
update public.jobs
  set tailored_resume_id = curated_resume_id
  where curated_resume_id is not null;

-- 6. Add the FK constraint pointing at the renamed table
alter table public.jobs
  add constraint jobs_tailored_resume_id_fkey
    foreign key (tailored_resume_id)
    references public.tailored_resumes(id)
    on delete set null;

-- 7. Drop the old column (drops its FK constraint automatically)
alter table public.jobs
  drop column if exists curated_resume_id;
