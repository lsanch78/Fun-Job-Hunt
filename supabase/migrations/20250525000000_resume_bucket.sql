-- ============================================================
-- EffJobHunt: Resume storage bucket
-- Migration: 20250525000000_resume_bucket
-- One resume per user, stored at {user_id}/resume.pdf
-- ============================================================

-- Create private bucket (public: false = no anonymous access)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,                    -- 10 MB limit
  array['application/pdf']
)
on conflict (id) do nothing;

-- Only the owning user can upload / replace their resume
create policy "resumes_upload_policy"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can update (upsert) their resume
create policy "resumes_update_policy"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can read their resume
create policy "resumes_read_policy"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can delete their resume
create policy "resumes_delete_policy"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
