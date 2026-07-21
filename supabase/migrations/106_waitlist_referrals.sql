-- Waitlist referral system (additive). Adds a PUBLIC, shareable referral_code
-- (distinct from the private redeemable founding_code), tracks who referred whom,
-- and counts successful referrals. Also adds a privacy-safe public count RPC for
-- the landing page social-proof counter.
--
-- Everything here is additive: existing columns, constraints, and the redeem
-- flow (apply_promo_redemption) are untouched. register_waitlist_signup keeps a
-- backward-compatible JSON shape (existing keys unchanged) and gains a few new
-- keys plus an optional p_ref argument.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Short, shareable referral code generator (lowercase alphanumeric, unique)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gen_waitlist_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_try INT := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    IF v_try > 30 THEN
      RAISE EXCEPTION 'REFERRAL_CODE_GEN_FAILED';
    END IF;
    v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM waitlist_signups w WHERE lower(w.referral_code) = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION gen_waitlist_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gen_waitlist_referral_code() TO service_role;

-- ---------------------------------------------------------------------------
-- Backfill referral_code for existing rows (one at a time so the uniqueness
-- check inside the generator sees previously assigned codes in this txn).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM waitlist_signups WHERE referral_code IS NULL LOOP
    UPDATE waitlist_signups
    SET referral_code = gen_waitlist_referral_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Enforce uniqueness now that every row has a code.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_referral_code_unique
  ON waitlist_signups (referral_code);
CREATE INDEX IF NOT EXISTS waitlist_signups_referred_by_idx
  ON waitlist_signups (referred_by_code);

-- ---------------------------------------------------------------------------
-- register_waitlist_signup: add optional p_ref + p_role default 'both'.
-- Replaces the 5-arg version (migration 099) with a 6-arg version.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS register_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION register_waitlist_signup(
  p_email TEXT,
  p_zip TEXT,
  p_role TEXT DEFAULT 'both',
  p_source TEXT DEFAULT 'landing-page',
  p_platform TEXT DEFAULT 'unspecified',
  p_ref TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_zip TEXT;
  v_role TEXT := lower(trim(coalesce(p_role, 'both')));
  v_source TEXT := coalesce(nullif(trim(p_source), ''), 'landing-page');
  v_platform TEXT := lower(coalesce(nullif(trim(p_platform), ''), 'unspecified'));
  v_ref TEXT := lower(nullif(trim(coalesce(p_ref, '')), ''));
  v_existing waitlist_signups%ROWTYPE;
  v_code TEXT;
  v_referral_code TEXT;
  v_promo_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_signups_today INT;
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  v_zip := regexp_replace(coalesce(p_zip, ''), '\D', '', 'g');
  IF length(v_zip) <> 5 THEN
    RAISE EXCEPTION 'INVALID_ZIP';
  END IF;

  -- Lenient: role/platform are optional from the landing form. Coerce anything
  -- unexpected to safe defaults instead of failing the signup.
  IF v_role NOT IN ('buy', 'sell', 'both') THEN
    v_role := 'both';
  END IF;

  IF v_platform NOT IN ('ios', 'android', 'web', 'unspecified') THEN
    v_platform := 'unspecified';
  END IF;

  -- Ignore a self-referral or a code that points at this same email later.
  IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9_-]{3,40}$' THEN
    v_ref := NULL;
  END IF;

  SELECT * INTO v_existing FROM waitlist_signups WHERE email = v_email;
  IF FOUND THEN
    -- Returning signup: never re-expose the private founding code, but DO return
    -- the public referral code so they can recover their share link.
    RETURN json_build_object(
      'founding_code', '',
      'already_registered', TRUE,
      'redeemed', v_existing.redeemed_at IS NOT NULL,
      'referral_code', v_existing.referral_code,
      'referral_count', v_existing.referral_count,
      'message',
        'This email is already on the waitlist. Check your inbox for your Founding Seller code, '
        || 'or contact support if you need help.'
    );
  END IF;

  SELECT count(*)::INT INTO v_signups_today
  FROM waitlist_signups
  WHERE created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_signups_today >= 500 THEN
    RAISE EXCEPTION 'WAITLIST_CAPACITY';
  END IF;

  v_code := gen_waitlist_founding_code();
  v_referral_code := gen_waitlist_referral_code();

  INSERT INTO promo_codes (code, type, value, max_redemptions, active)
  VALUES (v_code, 'founding_seller', 1, 1, TRUE)
  RETURNING id INTO v_promo_id;

  INSERT INTO waitlist_signups (
    email, zip_code, role, founding_code, promo_code_id, source, platform,
    referral_code, referred_by_code
  )
  VALUES (
    v_email, v_zip, v_role, v_code, v_promo_id, v_source, v_platform,
    v_referral_code, v_ref
  );

  -- Credit the referrer (if the ref code matches a different signup).
  IF v_ref IS NOT NULL THEN
    UPDATE waitlist_signups
    SET referral_count = referral_count + 1
    WHERE referral_code = v_ref AND email <> v_email;
  END IF;

  RETURN json_build_object(
    'founding_code', v_code,
    'already_registered', FALSE,
    'redeemed', FALSE,
    'referral_code', v_referral_code,
    'referral_count', 0,
    'message',
      'You are on the waitlist! After you download Local Marketplace and sign in with '
      || v_email
      || ', open Settings → Redeem promo code and enter your Founding Seller code below.'
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM waitlist_signups WHERE email = v_email;
    RETURN json_build_object(
      'founding_code', '',
      'already_registered', TRUE,
      'redeemed', COALESCE(v_existing.redeemed_at IS NOT NULL, FALSE),
      'referral_code', COALESCE(v_existing.referral_code, ''),
      'referral_count', COALESCE(v_existing.referral_count, 0),
      'message',
        'This email is already on the waitlist. Check your inbox for your Founding Seller code.'
    );
END;
$$;

REVOKE ALL ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Privacy-safe public count for the landing-page social-proof counter.
-- Returns only an integer; RLS still blocks anon from reading any row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_waitlist_public_stats()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM waitlist_signups;
$$;

REVOKE ALL ON FUNCTION get_waitlist_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_waitlist_public_stats() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Referral tally lookup by public referral code (for a returning sharer).
-- Exposes only a count for a code the caller already holds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_referral_status(p_ref TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT := lower(nullif(trim(coalesce(p_ref, '')), ''));
  v_count INT;
BEGIN
  IF v_ref IS NULL OR v_ref !~ '^[a-z0-9_-]{3,40}$' THEN
    RETURN json_build_object('referral_count', 0, 'found', FALSE);
  END IF;

  SELECT referral_count INTO v_count
  FROM waitlist_signups
  WHERE referral_code = v_ref;

  IF NOT FOUND THEN
    RETURN json_build_object('referral_count', 0, 'found', FALSE);
  END IF;

  RETURN json_build_object('referral_count', COALESCE(v_count, 0), 'found', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION get_referral_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_referral_status(TEXT) TO anon, authenticated, service_role;
