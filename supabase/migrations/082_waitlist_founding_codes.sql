-- Landing waitlist → unique Founding Seller promo code per email (redeem with matching account email).

CREATE TABLE waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  zip_code CHAR(5) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buy', 'sell', 'both')),
  founding_code TEXT NOT NULL,
  promo_code_id UUID NOT NULL REFERENCES promo_codes (id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'landing-page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  redeemed_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT waitlist_signups_email_lower_unique UNIQUE (email),
  CONSTRAINT waitlist_signups_founding_code_unique UNIQUE (founding_code),
  CONSTRAINT waitlist_signups_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX waitlist_signups_zip_idx ON waitlist_signups (zip_code);
CREATE INDEX waitlist_signups_promo_idx ON waitlist_signups (promo_code_id);
CREATE INDEX waitlist_signups_unredeemed_idx ON waitlist_signups (created_at DESC)
  WHERE redeemed_at IS NULL;

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_signups_admin_select ON waitlist_signups
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Generate FC-XXXXXXXX codes (promo_codes format)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gen_waitlist_founding_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_try INT := 0;
  v_raw TEXT;
BEGIN
  LOOP
    v_try := v_try + 1;
    IF v_try > 30 THEN
      RAISE EXCEPTION 'CODE_GEN_FAILED';
    END IF;
    v_raw := replace(gen_random_uuid()::text, '-', '');
    v_code := 'FC-' || upper(substr(v_raw, 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM promo_codes pc WHERE lower(pc.code) = lower(v_code));
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION gen_waitlist_founding_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gen_waitlist_founding_code() TO service_role;

-- ---------------------------------------------------------------------------
-- Register waitlist signup + founding_seller promo (idempotent per email)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_waitlist_signup(
  p_email TEXT,
  p_zip TEXT,
  p_role TEXT,
  p_source TEXT DEFAULT 'landing-page'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_zip TEXT;
  v_role TEXT := lower(trim(p_role));
  v_source TEXT := coalesce(nullif(trim(p_source), ''), 'landing-page');
  v_existing waitlist_signups%ROWTYPE;
  v_code TEXT;
  v_promo_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  v_zip := regexp_replace(coalesce(p_zip, ''), '\D', '', 'g');
  IF length(v_zip) <> 5 THEN
    RAISE EXCEPTION 'INVALID_ZIP';
  END IF;

  IF v_role NOT IN ('buy', 'sell', 'both') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  SELECT * INTO v_existing FROM waitlist_signups WHERE email = v_email;
  IF FOUND THEN
    RETURN json_build_object(
      'founding_code', v_existing.founding_code,
      'already_registered', TRUE,
      'redeemed', v_existing.redeemed_at IS NOT NULL,
      'message',
        'You are already on the waitlist. Save your Founding Seller code — redeem it in the app after you sign in with '
        || v_existing.email || '.'
    );
  END IF;

  v_code := gen_waitlist_founding_code();

  INSERT INTO promo_codes (code, type, value, max_redemptions, active)
  VALUES (v_code, 'founding_seller', 1, 1, TRUE)
  RETURNING id INTO v_promo_id;

  INSERT INTO waitlist_signups (email, zip_code, role, founding_code, promo_code_id, source)
  VALUES (v_email, v_zip, v_role, v_code, v_promo_id, v_source);

  RETURN json_build_object(
    'founding_code', v_code,
    'already_registered', FALSE,
    'redeemed', FALSE,
    'message',
      'You are on the waitlist! After you download Local Marketplace and sign in with '
      || v_email
      || ', open Settings → Redeem promo code and enter your Founding Seller code below.'
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM waitlist_signups WHERE email = v_email;
    IF FOUND THEN
      RETURN json_build_object(
        'founding_code', v_existing.founding_code,
        'already_registered', TRUE,
        'redeemed', v_existing.redeemed_at IS NOT NULL,
        'message', 'You are already on the waitlist.'
      );
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Founding redeem: waitlist codes must match signed-in profile email
-- ---------------------------------------------------------------------------
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
  v_period_start DATE;
  v_waitlist_email TEXT;
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

  IF v_promo.type = 'founding_seller' THEN
    IF v_profile.is_founding_seller THEN
      INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
      VALUES (p_user_id, v_code, FALSE);
      RAISE EXCEPTION 'FOUNDING_ALREADY';
    END IF;

    SELECT ws.email INTO v_waitlist_email
    FROM waitlist_signups ws
    WHERE ws.promo_code_id = v_promo.id;

    IF FOUND AND lower(v_waitlist_email) <> lower(v_profile.email) THEN
      INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
      VALUES (p_user_id, v_code, FALSE);
      RAISE EXCEPTION 'WAITLIST_EMAIL_MISMATCH';
    END IF;

    v_period_start := date_trunc('month', v_now AT TIME ZONE 'UTC')::date;

    INSERT INTO promo_redemptions (promo_code_id, user_id)
    VALUES (v_promo.id, p_user_id);

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
    SET is_founding_seller = TRUE,
        founding_seller_at = v_now,
        updated_at = v_now
    WHERE id = p_user_id;

    INSERT INTO founding_boost_credits (user_id, period_start, credits_total, credits_used)
    VALUES (p_user_id, v_period_start, 10, 0)
    ON CONFLICT (user_id, period_start) DO NOTHING;

    UPDATE waitlist_signups
    SET redeemed_at = v_now,
        redeemed_user_id = p_user_id
    WHERE promo_code_id = v_promo.id;

    INSERT INTO promo_redeem_attempts (user_id, code_attempt, success)
    VALUES (p_user_id, v_code, TRUE);

    RETURN json_build_object(
      'type', 'founding_seller',
      'message',
      'You are now a Founding Seller — badge on your profile and 10 free boosts every month.'
    );
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
