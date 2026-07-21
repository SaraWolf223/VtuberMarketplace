-- iPhone waitlist (separate from founding-seller landing waitlist).

CREATE TABLE ios_waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  zip_code CHAR(5),
  source TEXT NOT NULL DEFAULT 'landing-page-ios',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ios_waitlist_signups_email_lower_unique UNIQUE (email),
  CONSTRAINT ios_waitlist_signups_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX ios_waitlist_signups_created_idx ON ios_waitlist_signups (created_at DESC);
CREATE INDEX ios_waitlist_signups_zip_idx ON ios_waitlist_signups (zip_code) WHERE zip_code IS NOT NULL;

ALTER TABLE ios_waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY ios_waitlist_signups_admin_select ON ios_waitlist_signups
  FOR SELECT TO authenticated
  USING (is_app_admin());

-- Extend bulk email audience
ALTER TABLE email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_audience_check;
ALTER TABLE email_campaigns ADD CONSTRAINT email_campaigns_audience_check
  CHECK (audience IN ('waitlist', 'users', 'ios_waitlist'));

CREATE OR REPLACE FUNCTION register_ios_waitlist_signup(
  p_email TEXT,
  p_zip TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'landing-page-ios'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_zip TEXT;
  v_source TEXT := coalesce(nullif(trim(p_source), ''), 'landing-page-ios');
  v_existing ios_waitlist_signups%ROWTYPE;
  v_signups_today INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  IF p_zip IS NOT NULL AND trim(p_zip) <> '' THEN
    v_zip := regexp_replace(trim(p_zip), '\D', '', 'g');
    IF length(v_zip) <> 5 THEN
      RAISE EXCEPTION 'INVALID_ZIP';
    END IF;
  ELSE
    v_zip := NULL;
  END IF;

  SELECT * INTO v_existing FROM ios_waitlist_signups WHERE email = v_email;
  IF FOUND THEN
    RETURN json_build_object(
      'already_registered', TRUE,
      'message',
        'This email is already on the iPhone waitlist. We will email you when the iOS app is ready.'
    );
  END IF;

  SELECT count(*)::INT INTO v_signups_today
  FROM ios_waitlist_signups
  WHERE created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_signups_today >= 500 THEN
    RAISE EXCEPTION 'WAITLIST_CAPACITY';
  END IF;

  INSERT INTO ios_waitlist_signups (email, zip_code, source)
  VALUES (v_email, v_zip, v_source);

  RETURN json_build_object(
    'already_registered', FALSE,
    'message',
      'You are on the iPhone waitlist! We will email you when Local Marketplace is available on the App Store.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'already_registered', TRUE,
      'message',
        'This email is already on the iPhone waitlist. We will email you when the iOS app is ready.'
    );
END;
$$;

REVOKE ALL ON FUNCTION register_ios_waitlist_signup(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_ios_waitlist_signup(TEXT, TEXT, TEXT) TO service_role;
