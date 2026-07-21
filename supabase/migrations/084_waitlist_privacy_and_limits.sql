-- Waitlist: do not return founding codes on repeat signup; cap signups per email/day in RPC.

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
  v_signups_today INT;
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
      'founding_code', '',
      'already_registered', TRUE,
      'redeemed', v_existing.redeemed_at IS NOT NULL,
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
    RETURN json_build_object(
      'founding_code', '',
      'already_registered', TRUE,
      'redeemed', FALSE,
      'message',
        'This email is already on the waitlist. Check your inbox for your Founding Seller code.'
    );
END;
$$;

REVOKE ALL ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_waitlist_signup(TEXT, TEXT, TEXT, TEXT) TO service_role;
