-- Tiered AI usage limits based on rank (derived from job count):
--   Base (Rank 1–4):  10/month  — < 40 jobs
--   Rank 5–6:         20/month  — 40–90 jobs  (Rank 5 = 900 XP ≈ 40 jobs)
--   Rank 7+:          30/month  — ≥ 91 jobs   (Rank 7 = 2000 XP ≈ 91 jobs)

CREATE OR REPLACE FUNCTION check_and_increment_ai_usage(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_period text := to_char(now(), 'YYYY-MM');
  v_count        int;
  v_job_count    int;
  limit_val      int;
BEGIN
  SELECT COUNT(*) INTO v_job_count FROM jobs WHERE user_id = p_user_id;
  limit_val := CASE
    WHEN v_job_count >= 91 THEN 30
    WHEN v_job_count >= 40 THEN 20
    ELSE 10
  END;

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
