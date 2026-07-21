-- Full-audit pass (Phase 6 live testing): get_feed_listings only hid listings
-- from sellers *the viewer* had blocked (blocker_id = auth.uid()). It did not
-- account for the reverse direction — a seller blocking a problematic buyer
-- still left that seller's listings fully visible in the buyer's feed (the DM
-- system's users_are_blocked() has always been bidirectional; the feed filter
-- was not, which is inconsistent and weakens the point of blocking someone).
-- Fixes the filter to match users_are_blocked()'s bidirectional semantics.

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
        OR NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = l.seller_id)
             OR (b.blocker_id = l.seller_id AND b.blocked_id = auth.uid())
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
