-- Monthly cost snapshot: one row per YYYY-MM period.
-- Upserted by the dev-costs edge function on every dev-portal load.
-- Stores all fields needed to reconstruct the full cost dashboard for any past month.

CREATE TABLE monthly_cost_snapshots (
  period                      text        PRIMARY KEY,  -- YYYY-MM

  -- Revenue
  active_sub_count            int         NOT NULL DEFAULT 0,
  estimated_monthly_income    numeric     NOT NULL DEFAULT 0,

  -- Usage
  total_calls                 int         NOT NULL DEFAULT 0,
  unique_users                int         NOT NULL DEFAULT 0,
  paid_user_count             int         NOT NULL DEFAULT 0,
  free_user_count             int         NOT NULL DEFAULT 0,
  avg_calls_paid_user         numeric     NOT NULL DEFAULT 0,
  avg_calls_free_user         numeric     NOT NULL DEFAULT 0,

  -- Tokens
  total_input_tokens          bigint      NOT NULL DEFAULT 0,
  total_output_tokens         bigint      NOT NULL DEFAULT 0,
  total_cache_read_tokens     bigint      NOT NULL DEFAULT 0,
  total_cache_write_tokens    bigint      NOT NULL DEFAULT 0,

  -- Cost
  total_anthropic_cost_usd    numeric     NOT NULL DEFAULT 0,
  avg_cost_per_call           numeric     NOT NULL DEFAULT 0,

  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only service role (edge function) reads/writes this table.
