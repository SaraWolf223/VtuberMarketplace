-- Security hardening round 3 (post full-codebase audit).
--
-- 1. Manager privilege gap: managers (is_app_staff but not is_app_admin) could
--    UPDATE *other* users' profiles via PostgREST and flip trusted fields
--    (role, is_premium, is_founding_seller, banned_at, ...). The protect trigger
--    only reverted trusted fields on SELF-updates, and the bypass branch was
--    admin-only — so a manager editing another row hit no protection.
--    Legitimate moderation (ban/warn/shadow-ban) runs through the `admin-action`
--    edge function using the service role, which is already bypassed below, so
--    broadening the protection to all non-admin authenticated callers is safe.

-- ---------------------------------------------------------------------------
-- 1. Profile trusted-field protection — also cover non-admin updates to OTHER rows
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
  -- Trusted contexts bypass all protection.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Real admins may edit trusted fields on OTHER users' rows via REST.
  IF is_app_admin() AND auth.uid() IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;

  -- Everyone else with a JWT (normal users editing themselves AND managers
  -- editing anyone): trusted fields cannot change. Staff moderation goes through
  -- the service-role edge function, which is bypassed above.
  IF auth.uid() IS NOT NULL THEN
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
