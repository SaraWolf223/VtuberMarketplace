-- College badge: active only while verified and not past expiry; 10-day re-verify grace
-- then purge. Admin list = active verified users only.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS college_reverify_deadline_at TIMESTAMPTZ;

-- Backfill grace deadline for existing verifications
UPDATE profiles
SET college_reverify_deadline_at = college_badge_expires_at + INTERVAL '10 days'
WHERE college_edu_email IS NOT NULL
  AND college_badge_expires_at IS NOT NULL
  AND college_reverify_deadline_at IS NULL;

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
      AND p.college_edu_email IS NOT NULL
      AND p.college_badge_verified_at IS NOT NULL
      AND p.college_badge_expires_at IS NOT NULL
      AND p.college_badge_expires_at > NOW()
  );
$$;

REVOKE ALL ON FUNCTION college_badge_is_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION college_badge_is_active(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION purge_expired_college_badges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE profiles
  SET
    college_edu_email = NULL,
    college_badge_verified_at = NULL,
    college_badge_expires_at = NULL,
    college_reverify_deadline_at = NULL,
    updated_at = NOW()
  WHERE college_edu_email IS NOT NULL
    AND college_badge_expires_at IS NOT NULL
    AND college_badge_expires_at < NOW()
    AND college_reverify_deadline_at IS NOT NULL
    AND college_reverify_deadline_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_college_badges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_college_badges() TO service_role;

-- Purge users who missed the grace window (including backfilled deadlines in the past)
SELECT purge_expired_college_badges();

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
  college_badge_is_active(id) AS college_badge_active
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_listing_detail(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := FALSE;
  v_listing listings%ROWTYPE;
  v_seller record;
  v_images json;
  v_distance double precision;
  v_favorited boolean;
  v_user_point extensions.geography;
  v_college_active boolean := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = v_uid;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF NOT v_is_admin THEN
    IF v_listing.seller_id <> v_uid AND v_listing.status NOT IN ('active', 'sold') THEN
      RETURN json_build_object('error', 'NOT_FOUND');
    END IF;

    IF v_listing.seller_id <> v_uid AND EXISTS (
      SELECT 1 FROM blocks WHERE blocker_id = v_uid AND blocked_id = v_listing.seller_id
    ) THEN
      RETURN json_build_object('error', 'NOT_FOUND');
    END IF;
  END IF;

  IF v_is_admin THEN
    SELECT
      id,
      username,
      display_name,
      avatar_url,
      rating_avg,
      rating_count
    INTO v_seller
    FROM profiles
    WHERE id = v_listing.seller_id;
  ELSE
    SELECT
      id,
      username,
      display_name,
      avatar_url,
      rating_avg,
      rating_count
    INTO v_seller
    FROM profiles
    WHERE id = v_listing.seller_id
      AND banned_at IS NULL
      AND shadow_banned = FALSE;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  v_college_active := college_badge_is_active(v_listing.seller_id);

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'storage_path', li.storage_path,
        'sort_order', li.sort_order
      )
      ORDER BY li.sort_order
    ),
    '[]'::json
  )
  INTO v_images
  FROM listing_images li
  WHERE li.listing_id = p_listing_id;

  SELECT home_location INTO v_user_point
  FROM user_prefs
  WHERE user_id = v_uid;

  IF v_user_point IS NOT NULL AND v_listing.location IS NOT NULL THEN
    v_distance := extensions.ST_Distance(v_listing.location, v_user_point) / 1609.344;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM favorites f
    WHERE f.user_id = v_uid AND f.listing_id = p_listing_id
  ) INTO v_favorited;

  RETURN json_build_object(
    'listing', json_build_object(
      'id', v_listing.id,
      'title', v_listing.title,
      'description', v_listing.description,
      'price', v_listing.price,
      'category', v_listing.category,
      'zip_code', v_listing.zip_code,
      'status', v_listing.status,
      'boosted_until', v_listing.boosted_until,
      'published_at', v_listing.published_at,
      'expires_at', v_listing.expires_at,
      'seller_id', v_listing.seller_id,
      'is_own', v_listing.seller_id = v_uid
    ),
    'seller', json_build_object(
      'id', v_seller.id,
      'username', v_seller.username,
      'display_name', v_seller.display_name,
      'avatar_url', v_seller.avatar_url,
      'rating_avg', v_seller.rating_avg,
      'rating_count', v_seller.rating_count,
      'college_badge_active', v_college_active
    ),
    'images', v_images,
    'distance_miles', v_distance,
    'is_favorited', v_favorited
  );
END;
$$;

REVOKE ALL ON FUNCTION get_listing_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_detail(uuid) TO authenticated;
