-- ============================================================
-- RLS Security Tests
-- Run with: supabase test db
--
-- Verifies that a user cannot read or write another user's data.
--
-- Key patterns:
--   SELECT cross-user  → Bob sees 0 rows (RLS filters them)
--   INSERT wrong owner → throws 42501 (WITH CHECK fails)
--   UPDATE cross-user  → 0 rows affected (USING clause excludes the row)
--   DELETE cross-user  → 0 rows affected (USING clause excludes the row)
--   Anon SELECT        → 0 rows (auth.uid() = NULL never matches)
--
-- Verification strategy for UPDATE/DELETE: run Bob's attempt as authenticated,
-- then RESET to superuser to confirm Alice's row is untouched, then restore Bob.
-- ============================================================

BEGIN;

SELECT plan(47);

-- ── Seed two test users ───────────────────────────────────────────────────────

DO $$
BEGIN
  INSERT INTO auth.users (id, email, role, aud, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-000000000001','alice@test.local','authenticated','authenticated',now(),now()),
    ('00000000-0000-0000-0000-000000000002','bob@test.local',  'authenticated','authenticated',now(),now())
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Seed Alice's data as superuser (bypasses RLS)
INSERT INTO public.jobs (id, user_id, company, title, date_applied, status)
VALUES ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','AliceCorp','Engineer','2025-01-01','APPLIED');

INSERT INTO public.workdays (id, user_id, punch_in, date)
VALUES ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',now(),'2025-01-01');

INSERT INTO public.quick_cast_links (id, user_id, label, url)
VALUES ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Alice Link','https://alice.example.com');

INSERT INTO public.music_tracks (id, user_id, url, video_id, title)
VALUES ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','https://youtube.com/watch?v=alice','alice','Alice Song');

INSERT INTO public.scratch_pad (user_id, notes, list)
VALUES ('00000000-0000-0000-0000-000000000001','Alice notes','[]');

INSERT INTO public.ai_settings (user_id, cover_letter_prompt)
VALUES ('00000000-0000-0000-0000-000000000001','Alice prompt');

INSERT INTO public.resume_slots (user_id, slot, name)
VALUES ('00000000-0000-0000-0000-000000000001','a','Alice CV');

INSERT INTO public.ai_usage (user_id, count, period)
VALUES ('00000000-0000-0000-0000-000000000001',3,to_char(now(),'YYYY-MM'));

INSERT INTO public.subscriptions (user_id, status)
VALUES ('00000000-0000-0000-0000-000000000001','active');

-- ── Helper: switch to Bob ─────────────────────────────────────────────────────

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 1. jobs
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.jobs WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s jobs'
);

SELECT throws_ok(
  $$INSERT INTO public.jobs (id, user_id, company, title, date_applied, status)
    VALUES ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Attacker','Hacker','2025-01-01','APPLIED')$$,
  '42501', NULL,
  'Bob cannot INSERT a job owned by Alice'
);

UPDATE public.jobs SET company = 'Pwned' WHERE id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM public.jobs  WHERE id = 'a0000000-0000-0000-0000-000000000001';

RESET role;
SELECT is(
  (SELECT company FROM public.jobs WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  'AliceCorp',
  'Bob UPDATE on Alice''s job was blocked — company unchanged'
);
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Bob DELETE on Alice''s job was blocked — row still exists'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

INSERT INTO public.jobs (id, user_id, company, title, date_applied, status)
VALUES ('b0000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','BobCorp','Dev','2025-01-02','APPLIED');

SELECT is(
  (SELECT count(*) FROM public.jobs WHERE user_id = '00000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Bob can SELECT his own jobs'
);

-- ══════════════════════════════════════════════════════════════
-- 2. workdays
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.workdays WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s workdays'
);

SELECT throws_ok(
  $$INSERT INTO public.workdays (user_id, punch_in, date)
    VALUES ('00000000-0000-0000-0000-000000000001',now(),'2025-01-01')$$,
  '42501', NULL,
  'Bob cannot INSERT a workday owned by Alice'
);

UPDATE public.workdays SET punch_out = now() WHERE id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM public.workdays WHERE id = 'a0000000-0000-0000-0000-000000000002';

RESET role;
SELECT is(
  (SELECT punch_out FROM public.workdays WHERE id = 'a0000000-0000-0000-0000-000000000002'),
  NULL::timestamptz,
  'Bob UPDATE on Alice''s workday was blocked — punch_out still null'
);
SELECT is(
  (SELECT count(*) FROM public.workdays WHERE id = 'a0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Bob DELETE on Alice''s workday was blocked — row still exists'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 3. quick_cast_links
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.quick_cast_links WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s quick_cast_links'
);

SELECT throws_ok(
  $$INSERT INTO public.quick_cast_links (user_id, label, url)
    VALUES ('00000000-0000-0000-0000-000000000001','Evil','https://evil.com')$$,
  '42501', NULL,
  'Bob cannot INSERT a quick_cast_link owned by Alice'
);

UPDATE public.quick_cast_links SET label = 'Pwned' WHERE id = 'a0000000-0000-0000-0000-000000000003';
DELETE FROM public.quick_cast_links WHERE id = 'a0000000-0000-0000-0000-000000000003';

RESET role;
SELECT is(
  (SELECT label FROM public.quick_cast_links WHERE id = 'a0000000-0000-0000-0000-000000000003'),
  'Alice Link',
  'Bob UPDATE on Alice''s quick_cast_link was blocked'
);
SELECT is(
  (SELECT count(*) FROM public.quick_cast_links WHERE id = 'a0000000-0000-0000-0000-000000000003'),
  1::bigint,
  'Bob DELETE on Alice''s quick_cast_link was blocked'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 4. music_tracks
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.music_tracks WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s music_tracks'
);

SELECT throws_ok(
  $$INSERT INTO public.music_tracks (user_id, url, video_id, title)
    VALUES ('00000000-0000-0000-0000-000000000001','https://y.com','vid','Evil Song')$$,
  '42501', NULL,
  'Bob cannot INSERT a music_track owned by Alice'
);

UPDATE public.music_tracks SET title = 'Pwned' WHERE id = 'a0000000-0000-0000-0000-000000000004';
DELETE FROM public.music_tracks WHERE id = 'a0000000-0000-0000-0000-000000000004';

RESET role;
SELECT is(
  (SELECT title FROM public.music_tracks WHERE id = 'a0000000-0000-0000-0000-000000000004'),
  'Alice Song',
  'Bob UPDATE on Alice''s music_track was blocked'
);
SELECT is(
  (SELECT count(*) FROM public.music_tracks WHERE id = 'a0000000-0000-0000-0000-000000000004'),
  1::bigint,
  'Bob DELETE on Alice''s music_track was blocked'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 5. scratch_pad
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.scratch_pad WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s scratch_pad'
);

SELECT throws_ok(
  $$INSERT INTO public.scratch_pad (user_id, notes) VALUES ('00000000-0000-0000-0000-000000000001','Evil note')$$,
  '42501', NULL,
  'Bob cannot INSERT a scratch_pad row owned by Alice'
);

UPDATE public.scratch_pad SET notes = 'Pwned' WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.scratch_pad WHERE user_id = '00000000-0000-0000-0000-000000000001';

RESET role;
SELECT is(
  (SELECT notes FROM public.scratch_pad WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  'Alice notes',
  'Bob UPDATE on Alice''s scratch_pad was blocked'
);
SELECT is(
  (SELECT count(*) FROM public.scratch_pad WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Bob DELETE on Alice''s scratch_pad was blocked'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 6. ai_settings
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.ai_settings WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s ai_settings'
);

SELECT throws_ok(
  $$INSERT INTO public.ai_settings (user_id, cover_letter_prompt)
    VALUES ('00000000-0000-0000-0000-000000000001','Injected prompt')$$,
  '42501', NULL,
  'Bob cannot INSERT ai_settings owned by Alice'
);

UPDATE public.ai_settings SET cover_letter_prompt = 'Pwned' WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.ai_settings WHERE user_id = '00000000-0000-0000-0000-000000000001';

RESET role;
SELECT is(
  (SELECT cover_letter_prompt FROM public.ai_settings WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  'Alice prompt',
  'Bob UPDATE on Alice''s ai_settings was blocked'
);
SELECT is(
  (SELECT count(*) FROM public.ai_settings WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Bob DELETE on Alice''s ai_settings was blocked'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 7. resume_slots
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.resume_slots WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s resume_slots'
);

SELECT throws_ok(
  $$INSERT INTO public.resume_slots (user_id, slot, name)
    VALUES ('00000000-0000-0000-0000-000000000001','b','Evil CV')$$,
  '42501', NULL,
  'Bob cannot INSERT a resume_slot owned by Alice'
);

UPDATE public.resume_slots SET name = 'Pwned' WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.resume_slots WHERE user_id = '00000000-0000-0000-0000-000000000001';

RESET role;
SELECT is(
  (SELECT name FROM public.resume_slots WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  'Alice CV',
  'Bob UPDATE on Alice''s resume_slot was blocked'
);
SELECT is(
  (SELECT count(*) FROM public.resume_slots WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Bob DELETE on Alice''s resume_slot was blocked'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 8. ai_usage (select-only policy for owner)
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.ai_usage WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s ai_usage'
);

-- ══════════════════════════════════════════════════════════════
-- 9. subscriptions (read-only for owner; no client writes allowed)
-- ══════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Bob cannot SELECT Alice''s subscription'
);

SELECT throws_ok(
  $$INSERT INTO public.subscriptions (user_id, status)
    VALUES ('00000000-0000-0000-0000-000000000002','active')$$,
  '42501', NULL,
  'Bob cannot INSERT his own subscription (service-role-only write)'
);

UPDATE public.subscriptions SET status = 'active' WHERE user_id = '00000000-0000-0000-0000-000000000001';
RESET role;
SELECT is(
  (SELECT status FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  'active',
  'Bob UPDATE on Alice''s subscription was blocked — status unchanged'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","email":"alice@test.local"}';

SELECT is(
  (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Alice can SELECT her own subscription'
);

SELECT throws_ok(
  $$INSERT INTO public.subscriptions (user_id, status)
    VALUES ('00000000-0000-0000-0000-000000000001','active')$$,
  '42501', NULL,
  'Alice cannot INSERT her own subscription (service-role only)'
);

UPDATE public.subscriptions SET status = 'canceled' WHERE user_id = '00000000-0000-0000-0000-000000000001';
RESET role;
SELECT is(
  (SELECT status FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  'active',
  'Alice UPDATE on her own subscription was blocked — no UPDATE policy exists'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","email":"bob@test.local"}';

-- ══════════════════════════════════════════════════════════════
-- 10. feedback (insert-only for auth; read only for dev email)
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.feedback (user_id, topic, message)
VALUES ('00000000-0000-0000-0000-000000000002','bug','Something broke');

SELECT is(
  (SELECT count(*) FROM public.feedback),
  0::bigint,
  'Bob (non-dev email) cannot SELECT any feedback rows'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","email":"alice@test.local"}';

SELECT is(
  (SELECT count(*) FROM public.feedback),
  0::bigint,
  'Alice (non-dev email) cannot SELECT feedback rows'
);

-- ══════════════════════════════════════════════════════════════
-- 11. Anon access: auth.uid() = NULL → no rows match user_id checks
-- ══════════════════════════════════════════════════════════════

-- Clear JWT so auth.uid() returns NULL
SET LOCAL request.jwt.claims = '{}';
SET LOCAL role = anon;

SELECT is((SELECT count(*) FROM public.jobs),             0::bigint, 'Anon gets 0 rows from jobs');
SELECT is((SELECT count(*) FROM public.workdays),         0::bigint, 'Anon gets 0 rows from workdays');
SELECT is((SELECT count(*) FROM public.scratch_pad),      0::bigint, 'Anon gets 0 rows from scratch_pad');
SELECT is((SELECT count(*) FROM public.quick_cast_links), 0::bigint, 'Anon gets 0 rows from quick_cast_links');
SELECT is((SELECT count(*) FROM public.music_tracks),     0::bigint, 'Anon gets 0 rows from music_tracks');
SELECT is((SELECT count(*) FROM public.resume_slots),     0::bigint, 'Anon gets 0 rows from resume_slots');
SELECT is((SELECT count(*) FROM public.ai_settings),      0::bigint, 'Anon gets 0 rows from ai_settings');
SELECT is((SELECT count(*) FROM public.ai_usage),         0::bigint, 'Anon gets 0 rows from ai_usage');
SELECT is((SELECT count(*) FROM public.subscriptions),    0::bigint, 'Anon gets 0 rows from subscriptions');

SELECT * FROM finish();

ROLLBACK;
