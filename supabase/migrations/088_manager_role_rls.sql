-- Manager role RLS + staff helpers (requires manager enum from 085).

CREATE OR REPLACE FUNCTION is_app_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'manager') FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION is_app_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_app_staff() TO authenticated;

DROP POLICY IF EXISTS profiles_select_admin ON profiles;
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT TO authenticated USING (is_app_staff());

DROP POLICY IF EXISTS listing_images_select_admin ON listing_images;
CREATE POLICY listing_images_select_admin ON listing_images
  FOR SELECT TO authenticated USING (is_app_staff());

DROP POLICY IF EXISTS admin_all_listings ON listings;
CREATE POLICY admin_all_listings ON listings
  FOR ALL TO authenticated USING (is_app_staff()) WITH CHECK (is_app_staff());

DROP POLICY IF EXISTS reports_select_admin ON reports;
CREATE POLICY reports_select_admin ON reports
  FOR SELECT TO authenticated USING (is_app_staff());

DROP POLICY IF EXISTS reports_admin_update ON reports;
CREATE POLICY reports_admin_update ON reports
  FOR UPDATE TO authenticated USING (is_app_staff()) WITH CHECK (is_app_staff());

DROP POLICY IF EXISTS listings_select_admin ON listings;
CREATE POLICY listings_select_admin ON listings
  FOR SELECT TO authenticated USING (is_app_staff());

DROP POLICY IF EXISTS listings_admin_update ON listings;
CREATE POLICY listings_admin_update ON listings
  FOR UPDATE TO authenticated USING (is_app_staff()) WITH CHECK (is_app_staff());

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE TO authenticated USING (is_app_staff()) WITH CHECK (is_app_staff());

DROP POLICY IF EXISTS moderation_actions_admin ON moderation_actions;
CREATE POLICY moderation_actions_admin ON moderation_actions
  FOR ALL TO authenticated
  USING (is_app_staff()) WITH CHECK (is_app_staff() AND admin_id = auth.uid());

DROP POLICY IF EXISTS banned_keywords_admin_all ON banned_keywords;
CREATE POLICY banned_keywords_admin_all ON banned_keywords
  FOR ALL TO authenticated USING (is_app_staff()) WITH CHECK (is_app_staff());

CREATE OR REPLACE FUNCTION admin_delete_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_paths text[];
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT path), ARRAY[]::text[])
  INTO v_paths
  FROM (
    SELECT storage_path AS path FROM listing_images WHERE listing_id = p_listing_id AND storage_path IS NOT NULL
    UNION
    SELECT thumb_path FROM listing_images WHERE listing_id = p_listing_id AND thumb_path IS NOT NULL
  ) s;

  IF array_length(v_paths, 1) > 0 THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'listing-images'
      AND name = ANY(v_paths);
  END IF;

  DELETE FROM listings WHERE id = p_listing_id;

  INSERT INTO moderation_actions (admin_id, action, listing_id, target_user_id, notes)
  VALUES (auth.uid(), 'delete_listing', p_listing_id, v_listing.seller_id, NULL);

  UPDATE reports
  SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = auth.uid()
  WHERE listing_id = p_listing_id AND status = 'open';

  RETURN json_build_object('listing_id', p_listing_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_listing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_listing_detail(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean := FALSE;
  v_listing listings%ROWTYPE;
  v_seller record;
  v_images json;
  v_distance double precision;
  v_favorited boolean;
  v_user_point extensions.geography;
  v_college_active boolean := FALSE;
  v_seller_premium boolean := FALSE;
  v_seller_admin boolean := FALSE;
  v_seller_founding boolean := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_app_staff() INTO v_is_staff;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF NOT v_is_staff THEN
    IF v_listing.seller_id <> v_uid AND v_listing.status NOT IN ('active', 'sold') THEN
      RETURN json_build_object('error', 'NOT_FOUND');
    END IF;

    IF v_listing.seller_id <> v_uid AND EXISTS (
      SELECT 1 FROM blocks WHERE blocker_id = v_uid AND blocked_id = v_listing.seller_id
    ) THEN
      RETURN json_build_object('error', 'NOT_FOUND');
    END IF;
  END IF;

  IF v_is_staff THEN
    SELECT id, username, display_name, avatar_url, rating_avg, rating_count,
           is_premium, premium_until, role, is_founding_seller
    INTO v_seller FROM profiles WHERE id = v_listing.seller_id;
  ELSE
    SELECT id, username, display_name, avatar_url, rating_avg, rating_count,
           is_premium, premium_until, role, is_founding_seller
    INTO v_seller FROM profiles
    WHERE id = v_listing.seller_id AND banned_at IS NULL AND shadow_banned = FALSE;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  v_college_active := college_badge_is_active(v_listing.seller_id);
  v_seller_premium := v_seller.is_premium = TRUE
    AND (v_seller.premium_until IS NULL OR v_seller.premium_until > NOW());
  v_seller_admin := v_seller.role = 'admin';
  v_seller_founding := COALESCE(v_seller.is_founding_seller, FALSE);

  SELECT COALESCE(
    json_agg(json_build_object('storage_path', li.storage_path, 'sort_order', li.sort_order) ORDER BY li.sort_order),
    '[]'::json
  )
  INTO v_images FROM listing_images li WHERE li.listing_id = p_listing_id;

  SELECT home_location INTO v_user_point FROM user_prefs WHERE user_id = v_uid;

  IF v_user_point IS NOT NULL AND v_listing.location IS NOT NULL THEN
    v_distance := extensions.ST_Distance(v_listing.location, v_user_point) / 1609.344;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM favorites f WHERE f.user_id = v_uid AND f.listing_id = p_listing_id
  ) INTO v_favorited;

  RETURN json_build_object(
    'listing', json_build_object(
      'id', v_listing.id, 'title', v_listing.title, 'description', v_listing.description,
      'price', v_listing.price, 'category', v_listing.category, 'zip_code', v_listing.zip_code,
      'status', v_listing.status, 'boosted_until', v_listing.boosted_until,
      'published_at', v_listing.published_at, 'expires_at', v_listing.expires_at,
      'seller_id', v_listing.seller_id, 'is_own', v_listing.seller_id = v_uid
    ),
    'seller', json_build_object(
      'id', v_seller.id, 'username', v_seller.username, 'display_name', v_seller.display_name,
      'avatar_url', v_seller.avatar_url, 'rating_avg', v_seller.rating_avg,
      'rating_count', v_seller.rating_count, 'college_badge_active', v_college_active,
      'is_premium', v_seller_premium, 'is_admin', v_seller_admin, 'is_founding_seller', v_seller_founding
    ),
    'images', v_images, 'distance_miles', v_distance, 'is_favorited', v_favorited
  );
END;
$$;

REVOKE ALL ON FUNCTION get_listing_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_detail(uuid) TO authenticated;
