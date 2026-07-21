-- Prompt 17: expanded categories, sub-mile radius options, 2MB image cap alignment

-- New listing categories
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'womens_clothing';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'mens_clothing';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'college_school';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'books';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'bikes';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'decorations';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'food_beverage';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'carpool';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'hobby';
ALTER TYPE listing_category ADD VALUE IF NOT EXISTS 'delivery';

UPDATE listings
SET category = 'miscellaneous'
WHERE category = 'clothing';

-- Radius: support 0.5, 1, 2, 5, 10, 25, 50 miles
ALTER TABLE user_prefs
  ALTER COLUMN radius_miles TYPE numeric(4, 1) USING radius_miles::numeric(4, 1);

ALTER TABLE user_prefs DROP CONSTRAINT IF EXISTS user_prefs_radius_miles_check;

ALTER TABLE user_prefs
  ADD CONSTRAINT user_prefs_radius_miles_check
  CHECK (radius_miles IN (0.5, 1, 2, 5, 10, 25, 50));

CREATE OR REPLACE FUNCTION upsert_user_prefs_location(
  p_home_zip text,
  p_lng double precision,
  p_lat double precision,
  p_radius_miles numeric DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_name text;
  v_avatar text;
  v_username text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_radius_miles NOT IN (0.5, 1, 2, 5, 10, 25, 50) THEN
    RAISE EXCEPTION 'Invalid radius';
  END IF;

  IF char_length(p_home_zip) <> 5 OR p_home_zip !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ZIP';
  END IF;

  SELECT email, raw_user_meta_data
  INTO v_email, v_meta
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Account email missing';
  END IF;

  v_name := COALESCE(
    v_meta->>'full_name',
    v_meta->>'name',
    split_part(v_email, '@', 1),
    'User'
  );
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');
  v_username := 'user_' || substr(replace(v_uid::text, '-', ''), 1, 12);

  INSERT INTO profiles (
    id,
    email,
    username,
    display_name,
    avatar_url,
    auth_provider,
    last_active_at,
    updated_at
  )
  VALUES (
    v_uid,
    v_email,
    v_username,
    v_name,
    v_avatar,
    'google',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    auth_provider = 'google',
    last_active_at = NOW(),
    updated_at = NOW();

  INSERT INTO user_prefs (user_id, home_zip, home_location, radius_miles)
  VALUES (
    v_uid,
    p_home_zip,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_miles
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    home_zip = EXCLUDED.home_zip,
    home_location = EXCLUDED.home_location,
    radius_miles = EXCLUDED.radius_miles,
    updated_at = NOW();
END;
$$;

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
  p_limit int DEFAULT 20
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
  v_cursor_boost int;
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
      v_cursor_boost := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'b')::int;
      v_cursor_sort := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'s')::double precision;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'i')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_cursor_boost := NULL;
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
      CASE WHEN l.boosted_until > NOW() THEN 0 ELSE 1 END AS boost_sort,
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
        p.is_premium = TRUE
        AND (p.premium_until IS NULL OR p.premium_until > NOW())
      ) AS seller_is_premium,
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
          CASE WHEN l.boosted_until > NOW() THEN 0 ELSE 1 END,
          CASE
            WHEN p_sort = 'closest' THEN extensions.ST_Distance(l.location, v_user_point) / 1609.344
            WHEN p_sort = 'lowest_price' THEN l.price::double precision
            ELSE -EXTRACT(EPOCH FROM l.published_at)
          END,
          l.id
        ) > (v_cursor_boost, v_cursor_sort, v_cursor_id)
      )
    ORDER BY
      boost_sort,
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
          json_build_object('b', boost_sort, 's', sort_value, 'i', id)::text,
          'utf8'
        ),
        'base64'
      )
      FROM feed
      ORDER BY boost_sort, sort_value, id
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
