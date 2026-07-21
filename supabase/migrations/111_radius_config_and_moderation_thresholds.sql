-- Move the feed radius cap from a hardcoded fixed-list check to an
-- admin-editable value in `public_app_config` (key `max_radius_miles`,
-- seeded in migration 107). Also drop the old `user_prefs.radius_miles`
-- CHECK constraint (039_categories_radius_2mb.sql) in favor of RPC-level
-- validation — same pattern used to remove the listing price cap
-- (096_remove_price_cap.sql).

ALTER TABLE user_prefs DROP CONSTRAINT IF EXISTS user_prefs_radius_miles_check;
ALTER TABLE user_prefs ADD CONSTRAINT user_prefs_radius_miles_check CHECK (radius_miles > 0);

CREATE OR REPLACE FUNCTION current_max_radius_miles()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::numeric FROM public_app_config WHERE key = 'max_radius_miles'),
    50
  );
$$;

REVOKE ALL ON FUNCTION current_max_radius_miles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_max_radius_miles() TO authenticated, anon;

-- upsert_user_prefs_location: same body as 093_preserve_custom_avatar.sql,
-- radius check now dynamic.
CREATE OR REPLACE FUNCTION upsert_user_prefs_location(
  p_home_zip text,
  p_lng double precision,
  p_lat double precision,
  p_radius_miles numeric DEFAULT 10,
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL
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
  v_state text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_radius_miles IS NULL OR p_radius_miles <= 0 OR p_radius_miles > current_max_radius_miles() THEN
    RAISE EXCEPTION 'Invalid radius';
  END IF;

  IF char_length(p_home_zip) <> 5 OR p_home_zip !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ZIP';
  END IF;

  v_state := NULLIF(UPPER(TRIM(COALESCE(p_state, ''))), '');
  IF v_state IS NOT NULL AND v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid state code';
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
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
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

  IF v_state IS NOT NULL THEN
    INSERT INTO zip_centroids (zip_code, lng, lat, city, state, updated_at)
    VALUES (
      p_home_zip,
      p_lng,
      p_lat,
      NULLIF(TRIM(COALESCE(p_city, '')), ''),
      v_state,
      NOW()
    )
    ON CONFLICT (zip_code) DO UPDATE
    SET
      lng = EXCLUDED.lng,
      lat = EXCLUDED.lat,
      city = COALESCE(EXCLUDED.city, zip_centroids.city),
      state = EXCLUDED.state,
      updated_at = NOW();
  END IF;
END;
$$;

-- get_feed_listings: same body as 110_listings_category_to_text.sql, radius check now dynamic.
CREATE OR REPLACE FUNCTION get_feed_listings(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles numeric DEFAULT 10,
  p_category text DEFAULT NULL,
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
  IF p_radius_miles IS NULL OR p_radius_miles <= 0 OR p_radius_miles > current_max_radius_miles() THEN
    RAISE EXCEPTION 'Invalid p_radius_miles';
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
      COALESCE(p.is_founding_seller, FALSE) AS seller_is_founding_seller,
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
            seller_is_founding_seller,
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

-- New admin-editable moderation auto-pause thresholds (platform_settings —
-- see supabase/functions/_shared/platform-settings.ts and submit-report).
INSERT INTO platform_settings (key, value) VALUES
  ('reports_per_hour', '5'),
  ('pause_reports_24h', '10'),
  ('pause_reports_lifetime', '50')
ON CONFLICT (key) DO NOTHING;
