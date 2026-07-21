-- Prompt 24: college student badge via .edu email OTP.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS college_edu_email TEXT,
  ADD COLUMN IF NOT EXISTS college_badge_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS college_badge_expires_at TIMESTAMPTZ;

ALTER TABLE user_prefs
  ADD COLUMN IF NOT EXISTS feed_college_students_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS college_email_verification_codes (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  send_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS college_email_codes_expires_idx
  ON college_email_verification_codes (expires_at);

ALTER TABLE college_email_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION college_badge_is_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_user_id
      AND p.college_badge_expires_at IS NOT NULL
      AND p.college_badge_expires_at > NOW()
  );
$$;

REVOKE ALL ON FUNCTION college_badge_is_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION college_badge_is_active(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION set_feed_college_students_only(p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_prefs
  SET
    feed_college_students_only = COALESCE(p_enabled, FALSE),
    updated_at = NOW()
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set your home ZIP in location settings first';
  END IF;

  RETURN COALESCE(p_enabled, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION set_feed_college_students_only(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_feed_college_students_only(BOOLEAN) TO authenticated;

CREATE OR REPLACE VIEW profiles_public AS
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
  (
    college_badge_expires_at IS NOT NULL
    AND college_badge_expires_at > NOW()
  ) AS college_badge_active
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;
