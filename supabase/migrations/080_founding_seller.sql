-- Founding Seller: profile badge + 10 free boosts/month; redeem via promo type `founding_seller`.

ALTER TYPE boost_source ADD VALUE IF NOT EXISTS 'founding_credit';
ALTER TYPE promo_code_type ADD VALUE IF NOT EXISTS 'founding_seller';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_founding_seller BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS founding_seller_at TIMESTAMPTZ;

CREATE TABLE founding_boost_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  credits_total INT NOT NULL DEFAULT 10,
  credits_used INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_start)
);

CREATE INDEX founding_boost_credits_user_idx ON founding_boost_credits (user_id);

ALTER TABLE founding_boost_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY founding_boost_credits_select_own ON founding_boost_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Protect trusted profile fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_profile_trusted_fields_on_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce(auth.jwt()->>'role', '');
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF is_app_admin() AND auth.uid() IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      NEW.role := OLD.role;
    END IF;
    IF OLD.banned_at IS DISTINCT FROM NEW.banned_at THEN
      NEW.banned_at := OLD.banned_at;
    END IF;
    IF OLD.shadow_banned IS DISTINCT FROM NEW.shadow_banned THEN
      NEW.shadow_banned := OLD.shadow_banned;
    END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      NEW.phone := OLD.phone;
    END IF;
    IF OLD.phone_verified_at IS DISTINCT FROM NEW.phone_verified_at THEN
      NEW.phone_verified_at := OLD.phone_verified_at;
    END IF;
    IF OLD.is_premium IS DISTINCT FROM NEW.is_premium THEN
      NEW.is_premium := OLD.is_premium;
    END IF;
    IF OLD.premium_until IS DISTINCT FROM NEW.premium_until THEN
      NEW.premium_until := OLD.premium_until;
    END IF;
    IF OLD.is_founding_seller IS DISTINCT FROM NEW.is_founding_seller THEN
      NEW.is_founding_seller := OLD.is_founding_seller;
    END IF;
    IF OLD.founding_seller_at IS DISTINCT FROM NEW.founding_seller_at THEN
      NEW.founding_seller_at := OLD.founding_seller_at;
    END IF;
    IF OLD.rating_avg IS DISTINCT FROM NEW.rating_avg THEN
      NEW.rating_avg := OLD.rating_avg;
    END IF;
    IF OLD.rating_count IS DISTINCT FROM NEW.rating_count THEN
      NEW.rating_count := OLD.rating_count;
    END IF;
    IF OLD.listing_count IS DISTINCT FROM NEW.listing_count THEN
      NEW.listing_count := OLD.listing_count;
    END IF;
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      NEW.stripe_customer_id := OLD.stripe_customer_id;
    END IF;
    IF OLD.college_edu_email IS DISTINCT FROM NEW.college_edu_email THEN
      NEW.college_edu_email := OLD.college_edu_email;
    END IF;
    IF OLD.college_badge_verified_at IS DISTINCT FROM NEW.college_badge_verified_at THEN
      NEW.college_badge_verified_at := OLD.college_badge_verified_at;
    END IF;
    IF OLD.college_badge_expires_at IS DISTINCT FROM NEW.college_badge_expires_at THEN
      NEW.college_badge_expires_at := OLD.college_badge_expires_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public profiles + promo redemption
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS profiles_public;

CREATE VIEW profiles_public AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  rating_avg,
  rating_count,
  listing_count,
  is_premium,
  created_at,
  college_badge_is_active(id) AS college_badge_active,
  (role = 'admin') AS is_admin,
  is_founding_seller
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;

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
