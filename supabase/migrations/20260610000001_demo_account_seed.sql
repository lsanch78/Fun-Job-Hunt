-- ============================================================
-- Demo account seed for bd0d5e0f-53d8-4372-b6e5-7880171e5675
-- Absurd/funny job hunt data for portfolio showcase video
-- ============================================================

DO $$
DECLARE
  uid          uuid := 'bd0d5e0f-53d8-4372-b6e5-7880171e5675';

  -- job ids
  j_jurassic   uuid := gen_random_uuid();
  j_hogwarts   uuid := gen_random_uuid();
  j_shield     uuid := gen_random_uuid();
  j_initech    uuid := gen_random_uuid();
  j_umbrella   uuid := gen_random_uuid();
  j_willy      uuid := gen_random_uuid();
  j_dunder     uuid := gen_random_uuid();
  j_spacex     uuid := gen_random_uuid();
  j_wayne      uuid := gen_random_uuid();
  j_oscorp     uuid := gen_random_uuid();
  j_bluth      uuid := gen_random_uuid();
  j_nakatomi   uuid := gen_random_uuid();

  -- contact ids
  c_ian        uuid := gen_random_uuid();
  c_hermione   uuid := gen_random_uuid();
  c_nick       uuid := gen_random_uuid();
  c_peter      uuid := gen_random_uuid();
  c_michael    uuid := gen_random_uuid();
  c_dwight     uuid := gen_random_uuid();
  c_lucius     uuid := gen_random_uuid();

BEGIN

-- ── Jobs ──────────────────────────────────────────────────────────────────────

INSERT INTO public.jobs
  (id, user_id, company, title, status, rating, salary, notes, location, applied_at)
VALUES
  -- Active pipeline
  (j_jurassic, uid, 'Jurassic Park', 'Senior DevOps Engineer',
   'INTERVIEW', 4, '$140k',
   'Asked me to explain my disaster recovery philosophy. Mentioned the word "containment" a lot.',
   'Isla Nublar (On-site)', now() - interval '18 days'),

  (j_hogwarts, uid, 'Hogwarts School of Witchcraft & Wizardry', 'IT Infrastructure Manager',
   'PHONE_SCREEN', 5, '£95k',
   'Phone screen went great. They said my TCP/IP knowledge was "practically magical."',
   'Scottish Highlands (On-site)', now() - interval '12 days'),

  (j_shield, uid, 'S.H.I.E.L.D.', 'Full Stack Engineer — Helicarrier Systems',
   'APPLIED', 3, '$160k',
   'Applied through a hidden portal. Literally. The URL was behind a bookshelf.',
   'Remote (Classified)', now() - interval '5 days'),

  (j_willy, uid, 'Wonka Industries', 'Principal Chocolate Engineer',
   'OFFER', 5, '$120k',
   'They offered me the whole factory. Need to think about the Oompa Loompa reporting structure.',
   'Somewhere magical (On-site)', now() - interval '30 days'),

  -- Rejections / ghosted
  (j_initech, uid, 'Initech', 'Software Engineer',
   'REJECTED', 2, '$85k',
   'They said I had "a case of the Mondays" in my attitude. Also they needed the TPS reports by Friday.',
   'Austin, TX (Hybrid)', now() - interval '45 days'),

  (j_umbrella, uid, 'Umbrella Corporation', 'Backend Engineer — Biotech Division',
   'GHOSTED', 1, '$130k',
   'Everything was going well until the final round. Nobody has responded since. Suspicious.',
   'Raccoon City (On-site)', now() - interval '60 days'),

  (j_dunder, uid, 'Dunder Mifflin', 'Regional Manager (Tech Liaison)',
   'WITHDRAWN', 3, '$78k',
   'Withdrew after the hiring manager spent 40 minutes showing me his "World''s Best Boss" mug collection.',
   'Scranton, PA (On-site)', now() - interval '22 days'),

  -- More applied
  (j_spacex, uid, 'SpaceX', 'React Engineer — Starship HUD',
   'APPLIED', 4, '$155k',
   'The take-home involved rendering a real-time telemetry dashboard. Nailed it.',
   'Hawthorne, CA (Hybrid)', now() - interval '3 days'),

  (j_wayne, uid, 'Wayne Enterprises', 'Lead Frontend Engineer',
   'APPLIED', 5, '$170k',
   'Job description specifically said "no fear of bats required." I am suspicious.',
   'Gotham City (On-site)', now() - interval '7 days'),

  (j_oscorp, uid, 'Oscorp', 'Senior Software Engineer',
   'PHONE_SCREEN', 3, '$145k',
   'Recruiter was very interested in whether I had experience with "experimental integration work."',
   'New York, NY (On-site)', now() - interval '10 days'),

  (j_bluth, uid, 'Bluth Company', 'Software Engineer',
   'INTERVIEW', 2, '$90k',
   'There was always money in the banana stand. There was not always a coherent interview process.',
   'Newport Beach, CA (On-site)', now() - interval '14 days'),

  (j_nakatomi, uid, 'Nakatomi Corporation', 'Systems Engineer',
   'APPLIED', 4, '$125k',
   'Office Christmas party during the final round. Seemed like a great culture fit.',
   'Los Angeles, CA (On-site)', now() - interval '2 days');


-- ── Game progress (enough XP to look active) ─────────────────────────────────

INSERT INTO public.game_progress (user_id, xp, employed, updated_at)
VALUES (uid, 1240, false, now())
ON CONFLICT (user_id) DO UPDATE
  SET xp = 1240, updated_at = now();


-- ── Contacts ──────────────────────────────────────────────────────────────────

INSERT INTO public.contacts
  (id, user_id, name, company, email, linkedin, notes, comm_exp, last_comm_at, created_at)
VALUES
  (c_ian, uid, 'Dr. Ian Malcolm', 'Jurassic Park', 'ian.malcolm@ingen.com',
   'linkedin.com/in/dr-ian-malcolm',
   'Chaos theory guy. Very insightful in the interview debrief. Life, uh, finds a way.',
   3, now() - interval '5 days', now() - interval '20 days'),

  (c_hermione, uid, 'Hermione Granger', 'Hogwarts', 'h.granger@hogwarts.edu',
   'linkedin.com/in/hermione-granger',
   'Head of IT at Hogwarts. Reached out after she saw my open source work. Extremely responsive.',
   8, now() - interval '2 days', now() - interval '14 days'),

  (c_nick, uid, 'Nick Fury', 'S.H.I.E.L.D.', 'nfury@shield.gov',
   'linkedin.com/in/nick-fury-director',
   'He found ME. Said he was putting together a team. Very mysterious. Did not blink once.',
   2, now() - interval '10 days', now() - interval '10 days'),

  (c_peter, uid, 'Peter Parker', 'Oscorp', 'p.parker@oscorp.com',
   'linkedin.com/in/peter-parker',
   'Met at a tech meetup. Super friendly, left early — said something came up. Strong referral.',
   5, now() - interval '8 days', now() - interval '12 days'),

  (c_michael, uid, 'Michael Scott', 'Dunder Mifflin', 'm.scott@dundermifflin.com',
   'linkedin.com/in/michael-gary-scott',
   'Reached out on LinkedIn. His message was 400 words and ended with "That''s what she said."',
   1, now() - interval '22 days', now() - interval '22 days'),

  (c_dwight, uid, 'Dwight Schrute', 'Dunder Mifflin', 'd.schrute@dundermifflin.com',
   'linkedin.com/in/dwight-kurt-schrute',
   'Volunteered to be my "assistant to the regional referral coordinator." Beet farmer on weekends.',
   2, now() - interval '20 days', now() - interval '22 days'),

  (c_lucius, uid, 'Lucius Fox', 'Wayne Enterprises', 'l.fox@wayneenterprises.com',
   'linkedin.com/in/lucius-fox',
   'Brilliant. Sent me the most thoughtful take-home brief I''ve ever seen. Definitely not a front.',
   6, now() - interval '4 days', now() - interval '8 days');


-- ── Job ↔ Contact links ───────────────────────────────────────────────────────

INSERT INTO public.job_contacts (job_id, contact_id) VALUES
  (j_jurassic, c_ian),
  (j_hogwarts, c_hermione),
  (j_shield,   c_nick),
  (j_oscorp,   c_peter),
  (j_dunder,   c_michael),
  (j_dunder,   c_dwight),
  (j_wayne,    c_lucius);

END $$;
