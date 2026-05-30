-- Harden feedback RLS:
-- 1. Lock user_id to auth.uid() on insert (prevents spoofing another user's UUID)
-- 2. Rate-limit to 10 submissions per user per 24 hours

drop policy if exists "authenticated users can submit feedback" on feedback;

create policy "authenticated users can submit feedback"
  on feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      select count(*)
      from feedback
      where user_id = auth.uid()
        and created_at > now() - interval '24 hours'
    ) < 10
  );
