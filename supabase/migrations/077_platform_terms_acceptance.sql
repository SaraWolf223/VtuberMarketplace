-- Platform Terms of Service acceptance tracking (first sign-in gate).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN profiles.terms_accepted_at IS 'When the user accepted the current platform Terms + Privacy';
COMMENT ON COLUMN profiles.terms_version IS 'Version id of accepted legal bundle (bump to require re-acceptance)';

-- Block self-service writes to terms fields (RPC-only via accept_platform_terms).
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
    IF OLD.terms_accepted_at IS DISTINCT FROM NEW.terms_accepted_at THEN
      NEW.terms_accepted_at := OLD.terms_accepted_at;
    END IF;
    IF OLD.terms_version IS DISTINCT FROM NEW.terms_version THEN
      NEW.terms_version := OLD.terms_version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION accept_platform_terms(p_version TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_version TEXT := NULLIF(TRIM(p_version), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Invalid terms version';
  END IF;

  UPDATE profiles
  SET
    terms_accepted_at = NOW(),
    terms_version = v_version,
    updated_at = NOW()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'terms_accepted_at', NOW(),
    'terms_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION accept_platform_terms(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_platform_terms(TEXT) TO authenticated;
