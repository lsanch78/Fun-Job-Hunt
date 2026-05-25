-- ============================================================
-- EffJobHunt: Resume slots table
-- Migration: 20250525000004_resume_slots
-- Up to 3 named resumes per user, stored at {user_id}/resume_{slot}.pdf
-- slot values: 'a' | 'b' | 'c'
-- ============================================================

create table if not exists public.resume_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       text not null check (slot in ('a', 'b', 'c')),
  name       text not null default 'Resume',
  uploaded_at timestamptz not null default now(),
  unique (user_id, slot)
);

alter table public.resume_slots enable row level security;

create policy "resume_slots_select"
  on public.resume_slots for select
  to authenticated
  using (user_id = auth.uid());

create policy "resume_slots_insert"
  on public.resume_slots for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "resume_slots_update"
  on public.resume_slots for update
  to authenticated
  using (user_id = auth.uid());

create policy "resume_slots_delete"
  on public.resume_slots for delete
  to authenticated
  using (user_id = auth.uid());
