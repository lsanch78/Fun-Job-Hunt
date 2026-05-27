-- Update AI usage check to give rank-5+ users 10 generations/month (up from 5).
-- Rank 5 = 900 XP. XP formula: jobs * 20 + floor(jobs / 10) * 20
-- Solving: 20j + 2*floor(j/10) >= 900 → j >= 41 (conservatively 40 jobs with bonus)
-- We use 40 jobs as the threshold to keep the math simple and slightly generous.

CREATE OR REPLACE FUNCTION check_and_increment_ai_usage(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_period text := to_char(now(), 'YYYY-MM');
  v_count        int;
  v_job_count    int;
  limit_val      int;
BEGIN
  -- Derive limit from job count (proxy for rank)
  SELECT COUNT(*) INTO v_job_count FROM jobs WHERE user_id = p_user_id;
  limit_val := CASE WHEN v_job_count >= 40 THEN 10 ELSE 5 END;

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
