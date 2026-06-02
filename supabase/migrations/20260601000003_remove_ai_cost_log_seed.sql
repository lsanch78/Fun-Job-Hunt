-- Remove manually seeded historical token data; real logging is now in place.
DELETE FROM ai_cost_log WHERE created_at = '2026-06-01T00:00:00Z' AND period = '2026-06' AND model = 'claude-sonnet-4-5';
