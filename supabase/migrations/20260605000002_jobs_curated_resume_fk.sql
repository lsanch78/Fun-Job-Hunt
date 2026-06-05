alter table public.jobs
  add column if not exists curated_resume_id uuid
    references public.curated_resumes(id) on delete set null;
