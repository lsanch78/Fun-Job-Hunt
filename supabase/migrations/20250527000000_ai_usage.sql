-- AI usage tracking for proxy-mode rate limiting (10 generations/month per user)

CREATE TABLE ai_usage (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count      int         NOT NULL DEFAULT 0,
  period     text        NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage count (for UI display)
CREATE POLICY "select own usage" ON ai_usage
  FOR SELECT USING (user_id = auth.uid());

-- Atomically check and increment usage, resetting count on new calendar month.
-- Returns { allowed, count, limit } as JSONB.
-- Runs as SECURITY DEFINER so the Edge Function service-role client can call it.
CREATE OR REPLACE FUNCTION check_and_increment_ai_usage(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_period text := to_char(now(), 'YYYY-MM');
  v_count        int;
  limit_val      int := 10;
BEGIN
  -- Upsert row, resetting count to 0 if it's a new month
  INSERT INTO ai_usage (user_id, count, period)
  VALUES (p_user_id, 0, current_period)
  ON CONFLICT (user_id) DO UPDATE
    SET count      = CASE
                       WHEN ai_usage.period = current_period THEN ai_usage.count
                       ELSE 0
                     END,
        period     = current_period,
        updated_at = now();

  SELECT count INTO v_count FROM ai_usage WHERE user_id = p_user_id;

  IF v_count >= limit_val THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', limit_val);
  END IF;

  UPDATE ai_usage
  SET count = count + 1, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', limit_val);
END;
$$;
