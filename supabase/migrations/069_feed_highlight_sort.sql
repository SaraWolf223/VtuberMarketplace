-- Feed sort: premium+boost > free boost > rest. Expose seller_is_admin for avatar rings.

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
  college_badge_is_active(id) AS college_badge_active,
  (role = 'admin') AS is_admin
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_feed_listings(
  double precision,
  double precision,
  numeric,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer,
  boolean
);

CREATE OR REPLACE FUNCTION get_feed_listings(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles numeric DEFAULT 10,
  p_category listing_category DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_status listing_status DEFAULT 'active',
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_college_students_only boolean DEFAULT FALSE
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_point extensions.geography;
  v_radius_meters double precision;
  v_items json;
  v_next_cursor text;
  v_limit int;
  v_cursor_rank int;
  v_cursor_sort double precision;
  v_cursor_id uuid;
  v_search text;
  v_feed_count int;
BEGIN
  IF p_radius_miles NOT IN (0.5, 1, 2, 5, 10, 25, 50) THEN
    RAISE EXCEPTION 'p_radius_miles must be 0.5, 1, 2, 5, 10, 25, or 50';
  END IF;

  IF p_sort NOT IN ('newest', 'closest', 'lowest_price') THEN
    RAISE EXCEPTION 'Invalid p_sort';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_user_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius_meters := p_radius_miles::double precision * 1609.344;
  v_search := NULLIF(trim(p_search), '');

  IF p_cursor IS NOT NULL AND length(p_cursor) > 0 THEN
    BEGIN
      v_cursor_rank := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'b')::int;
      v_cursor_sort := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'s')::double precision;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'i')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_cursor_rank := NULL;
      v_cursor_sort := NULL;
      v_cursor_id := NULL;
    END;
  END IF;

  WITH feed AS (
    SELECT
      l.id,
      l.title,
      l.price,
      l.category,
      l.zip_code,
      l.status,
      l.boosted_until,
      l.published_at,
      l.image_count,
      l.seller_id,
      (l.boosted_until IS NOT NULL AND l.boosted_until > NOW()) AS is_boosted,
      (
        p.is_premium = TRUE
        AND (p.premium_until IS NULL OR p.premium_until > NOW())
      ) AS seller_is_premium,
      (p.role = 'admin') AS seller_is_admin,
      CASE
        WHEN l.boosted_until > NOW()
          AND p.is_premium = TRUE
          AND (p.premium_until IS NULL OR p.premium_until > NOW())
        THEN 0
        WHEN l.boosted_until > NOW() THEN 1
        ELSE 2
      END AS feed_rank,
      extensions.ST_Distance(l.location, v_user_point) / 1609.344 AS distance_miles,
      CASE
        WHEN p_sort = 'closest' THEN extensions.ST_Distance(l.location, v_user_point) / 1609.344
        WHEN p_sort = 'lowest_price' THEN l.price::double precision
        ELSE -EXTRACT(EPOCH FROM l.published_at)
      END AS sort_value,
      p.display_name AS seller_display_name,
      p.username AS seller_username,
      p.avatar_url AS seller_avatar_url,
      (
        SELECT li.storage_path
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.sort_order
        LIMIT 1
      ) AS thumb_path
    FROM listings l
    INNER JOIN profiles p ON p.id = l.seller_id
    WHERE l.status = COALESCE(p_status, 'active'::listing_status)
      AND (p_category IS NULL OR l.category = p_category)
      AND (p_max_price IS NULL OR l.price <= p_max_price)
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
      AND (
        NOT COALESCE(p_college_students_only, FALSE)
        OR (
          p.college_badge_expires_at IS NOT NULL
          AND p.college_badge_expires_at > NOW()
        )
      )
      AND (
        auth.uid() IS NULL
        OR l.seller_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
        )
      )
      AND extensions.ST_DWithin(l.location, v_user_point, v_radius_meters)
      AND (
        v_search IS NULL
        OR l.search_vector @@ plainto_tsquery('english', v_search)
      )
      AND (
        v_cursor_id IS NULL
        OR (
          CASE
            WHEN l.boosted_until > NOW()
              AND p.is_premium = TRUE
              AND (p.premium_until IS NULL OR p.premium_until > NOW())
            THEN 0
            WHEN l.boosted_until > NOW() THEN 1
            ELSE 2
          END,
          CASE
            WHEN p_sort = 'closest' THEN extensions.ST_Distance(l.location, v_user_point) / 1609.344
            WHEN p_sort = 'lowest_price' THEN l.price::double precision
            ELSE -EXTRACT(EPOCH FROM l.published_at)
          END,
          l.id
        ) > (v_cursor_rank, v_cursor_sort, v_cursor_id)
      )
    ORDER BY
      feed_rank,
      sort_value,
      l.id
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE(
      (
        SELECT json_agg(row_to_json(page_row))
        FROM (
          SELECT
            id,
            title,
            price,
            category,
            zip_code,
            status,
            boosted_until,
            published_at,
            image_count,
            seller_id,
            is_boosted,
            distance_miles,
            seller_display_name,
            seller_username,
            seller_avatar_url,
            seller_is_premium,
            seller_is_admin,
            thumb_path
          FROM feed
          LIMIT v_limit
        ) page_row
      ),
      '[]'::json
    ),
    (SELECT COUNT(*)::int FROM feed),
    (
      SELECT encode(
        convert_to(
          json_build_object('b', feed_rank, 's', sort_value, 'i', id)::text,
          'utf8'
        ),
        'base64'
      )
      FROM feed
      ORDER BY feed_rank, sort_value, id
      OFFSET v_limit
      LIMIT 1
    )
  INTO v_items, v_feed_count, v_next_cursor;

  RETURN json_build_object(
    'items', v_items,
    'next_cursor', CASE WHEN v_feed_count > v_limit THEN v_next_cursor ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed_listings(
  double precision,
  double precision,
  numeric,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer,
  boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_feed_listings(
  double precision,
  double precision,
  numeric,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer,
  boolean
) TO authenticated, anon;

-- Listing detail seller: premium + admin flags for avatar ring
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
  v_seller_premium boolean := FALSE;
  v_seller_admin boolean := FALSE;
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
      rating_count,
      is_premium,
      premium_until,
      role
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
      rating_count,
      is_premium,
      premium_until,
      role
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
  v_seller_premium := v_seller.is_premium = TRUE
    AND (v_seller.premium_until IS NULL OR v_seller.premium_until > NOW());
  v_seller_admin := v_seller.role = 'admin';

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
      'college_badge_active', v_college_active,
      'is_premium', v_seller_premium,
      'is_admin', v_seller_admin
    ),
    'images', v_images,
    'distance_miles', v_distance,
    'is_favorited', v_favorited
  );
END;
$$;

REVOKE ALL ON FUNCTION get_listing_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_detail(uuid) TO authenticated;
