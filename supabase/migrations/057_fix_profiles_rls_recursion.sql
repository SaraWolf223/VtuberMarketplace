-- Fix infinite RLS recursion: admin policies must not SELECT profiles inside profiles policies.
-- Use SECURITY DEFINER helper (bypasses RLS when checking admin role).

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_app_admin() TO authenticated;

DROP POLICY IF EXISTS profiles_select_admin ON profiles;
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

DROP POLICY IF EXISTS listing_images_select_admin ON listing_images;
CREATE POLICY listing_images_select_admin ON listing_images
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

-- Align other admin RLS checks (same recursion risk on nested profile reads)
DROP POLICY IF EXISTS admin_all_listings ON listings;
CREATE POLICY admin_all_listings ON listings
  FOR ALL
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS promo_codes_admin_select ON promo_codes;
CREATE POLICY promo_codes_admin_select ON promo_codes
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

DROP POLICY IF EXISTS promo_codes_admin_insert ON promo_codes;
CREATE POLICY promo_codes_admin_insert ON promo_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS promo_codes_admin_update ON promo_codes;
CREATE POLICY promo_codes_admin_update ON promo_codes
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS platform_settings_admin_select ON platform_settings;
CREATE POLICY platform_settings_admin_select ON platform_settings
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

DROP POLICY IF EXISTS platform_settings_admin_insert ON platform_settings;
CREATE POLICY platform_settings_admin_insert ON platform_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS platform_settings_admin_update ON platform_settings;
CREATE POLICY platform_settings_admin_update ON platform_settings
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS promo_redemptions_admin_select ON promo_redemptions;
CREATE POLICY promo_redemptions_admin_select ON promo_redemptions
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

DROP POLICY IF EXISTS reports_select_admin ON reports;
CREATE POLICY reports_select_admin ON reports
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

DROP POLICY IF EXISTS listings_select_admin ON listings;
CREATE POLICY listings_select_admin ON listings
  FOR SELECT
  TO authenticated
  USING (is_app_admin());
