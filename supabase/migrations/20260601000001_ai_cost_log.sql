-- Token-level log written by the ai-generate edge function after each call.
-- Used by the dev portal cost dashboard.

CREATE TABLE ai_cost_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model      text        NOT NULL,
  period     text        NOT NULL,  -- YYYY-MM
  input_tokens              int NOT NULL DEFAULT 0,
  output_tokens             int NOT NULL DEFAULT 0,
  cache_read_input_tokens   int NOT NULL DEFAULT 0,
  cache_creation_input_tokens int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can write; no client reads needed.
-- Dev portal reads via service role in dev-costs function.
