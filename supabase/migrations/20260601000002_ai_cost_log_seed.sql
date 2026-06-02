-- Manually seeded historical token usage from Anthropic console (pre-logging).
-- Period: 2026-06, model: claude-sonnet-4-5
-- Input: 280278 + 41696 = 321974, Output: 12075 + 11794 = 23869
-- Attributed to a sentinel system user_id so it doesn't break the FK constraint.
-- The dev portal sums all rows so this will be included in totals.

INSERT INTO ai_cost_log (
  user_id,
  model,
  period,
  input_tokens,
  output_tokens,
  cache_read_input_tokens,
  cache_creation_input_tokens,
  created_at
)
VALUES (
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),  -- owner account (you)
  'claude-sonnet-4-5',
  '2026-06',
  321974,
  23869,
  0,
  0,
  '2026-06-01T00:00:00Z'
);
