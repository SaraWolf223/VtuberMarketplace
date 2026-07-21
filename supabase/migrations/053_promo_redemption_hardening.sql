-- Promo redemption hardening: atomic apply, rate limits, abuse guards

CREATE TABLE promo_redeem_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  code_attempt TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX promo_redeem_attempts_user_time_idx
  ON promo_redeem_attempts (user_id, created_at DESC);

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_codes_redemption_cap CHECK (
    max_redemptions IS NULL OR redemption_count <= max_redemptions
  );

-- One free Premium-month promo per account (lifetime), across all codes
CREATE UNIQUE INDEX promo_redemptions_one_free_premium_per_user
  ON promo_redemptions (user_id)
  WHERE premium_until IS NOT NULL;

ALTER TABLE promo_redeem_attempts ENABLE ROW LEVEL SECURITY;

-- No client policies: attempts logged only via service-role RPC

CREATE OR REPLACE FUNCTION apply_promo_redemption(p_user_id UUID, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(p_code));
  v_attempts INT;
  v_profile profiles%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_premium_until TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF v_code IS NULL OR v_code = '' OR v_code !~ '^[A-Z0-9_-]{4,32}$' THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  SELECT COUNT(*)::int
  INTO v_attempts
  FROM promo_redeem_attempts
  WHERE user_id = p_user_id
    AND created_at > v_now - INTERVAL '1 hour';

  IF v_attempts >= 10 THEN
    RAISE EXCEPTION 'RATE_LIMIT';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.banned_at IS NOT NULL THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_profile.phone_verified_at IS NULL THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'PHONE_REQUIRED';
  END IF;

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE LOWER(code) = LOWER(v_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF NOT v_promo.active THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= v_now THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redemption_count >= v_promo.max_redemptions THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM promo_redemptions r
    WHERE r.promo_code_id = v_promo.id AND r.user_id = p_user_id
  ) THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'ALREADY_REDEEMED';
  END IF;

  IF v_promo.type = 'free_premium_month' AND EXISTS (
    SELECT 1 FROM promo_redemptions r
    WHERE r.user_id = p_user_id AND r.premium_until IS NOT NULL
  ) THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    RAISE EXCEPTION 'PREMIUM_PROMO_ALREADY_USED';
  END IF;

  IF v_promo.type = 'free_boosts' THEN
    INSERT INTO promo_redemptions (promo_code_id, user_id, boosts_remaining)
    VALUES (v_promo.id, p_user_id, v_promo.value);

    UPDATE promo_codes
    SET redemption_count = redemption_count + 1,
        updated_at = v_now
    WHERE id = v_promo.id
      AND active = TRUE
      AND (expires_at IS NULL OR expires_at > v_now)
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_CODE';
    END IF;

    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, TRUE);

    RETURN json_build_object(
      'type', 'free_boosts',
      'boosts_remaining', v_promo.value,
      'message', format(
        '%s free boost%s added to your account.',
        v_promo.value,
        CASE WHEN v_promo.value = 1 THEN '' ELSE 's' END
      )
    );
  END IF;

  -- free_premium_month
  v_premium_until := v_now;
  IF v_profile.premium_until IS NOT NULL AND v_profile.premium_until > v_now THEN
    v_premium_until := v_profile.premium_until;
  END IF;
  v_premium_until := v_premium_until + INTERVAL '1 month';

  INSERT INTO promo_redemptions (promo_code_id, user_id, premium_until)
  VALUES (v_promo.id, p_user_id, v_premium_until);

  UPDATE promo_codes
  SET redemption_count = redemption_count + 1,
      updated_at = v_now
  WHERE id = v_promo.id
    AND active = TRUE
    AND (expires_at IS NULL OR expires_at > v_now)
    AND (max_redemptions IS NULL OR redemption_count < max_redemptions);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  UPDATE profiles
  SET is_premium = TRUE,
      premium_until = v_premium_until,
      updated_at = v_now
  WHERE id = p_user_id;

  INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
  VALUES (p_user_id, v_code, TRUE);

  RETURN json_build_object(
    'type', 'free_premium_month',
    'premium_until', v_premium_until,
    'message', format(
      'Premium active until %s. No Stripe subscription was created.',
      to_char(v_premium_until AT TIME ZONE 'UTC', 'Mon DD, YYYY')
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, FALSE);
    IF EXISTS (
      SELECT 1 FROM promo_redemptions r
      WHERE r.user_id = p_user_id AND r.premium_until IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'PREMIUM_PROMO_ALREADY_USED';
    END IF;
    RAISE EXCEPTION 'ALREADY_REDEEMED';
END;
$$;

REVOKE ALL ON FUNCTION apply_promo_redemption(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_promo_redemption(UUID, TEXT) TO service_role;
