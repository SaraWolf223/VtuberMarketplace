-- Audit session fixes: profile INSERT guard, block client-side bypass paths.

-- ---------------------------------------------------------------------------
-- 1. Profile INSERT — force safe defaults (prevent self-granted admin/premium)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_profile_trusted_fields_on_self_insert()
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

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
    NEW.role := 'user';
    NEW.is_premium := FALSE;
    NEW.premium_until := NULL;
    NEW.banned_at := NULL;
    NEW.shadow_banned := FALSE;
    NEW.phone_verified_at := NULL;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.listing_count := 0;
    NEW.stripe_customer_id := NULL;
    NEW.college_edu_email := NULL;
    NEW.college_badge_verified_at := NULL;
    NEW.college_badge_expires_at := NULL;
    IF NEW.auth_provider IS NULL OR NEW.auth_provider = '' THEN
      NEW.auth_provider := 'google';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_trusted_fields_insert ON profiles;
CREATE TRIGGER profiles_protect_trusted_fields_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_trusted_fields_on_self_insert();

-- ---------------------------------------------------------------------------
-- 2. Block client writes that bypass edge validation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS listing_create_log_insert_own ON listing_create_log;

DROP POLICY IF EXISTS listing_images_insert_own ON listing_images;
CREATE POLICY listing_images_no_direct_insert ON listing_images
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS reports_insert_own ON reports;
CREATE POLICY reports_no_direct_insert ON reports
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS listings_delete_own ON listings;
CREATE POLICY listings_no_direct_delete ON listings
  FOR DELETE TO authenticated
  USING (FALSE);
