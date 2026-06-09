-- Enforce at most one active workday session per user at the DB level.
-- An active session is any row where punch_out IS NULL.
-- Without this, a race condition in the app could insert two concurrent rows
-- and both would succeed, creating duplicate active sessions.
create unique index if not exists workdays_one_active_per_user
  on public.workdays(user_id)
  where punch_out is null;
