-- Enhanced feed RPC: geo, blocks, boost, search, sorts, cursor pagination, seller + thumb
CREATE OR REPLACE FUNCTION get_feed_listings(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles int DEFAULT 10,
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
STABLE
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
  v_last_boost int;
  v_last_sort double precision;
  v_last_id uuid;
  v_has_more boolean;
BEGIN
  IF p_radius_miles NOT IN (5, 10, 25, 50) THEN
    RAISE EXCEPTION 'p_radius_miles must be 5, 10, 25, or 50';
  END IF;

  IF p_sort NOT IN ('newest', 'closest', 'lowest_price') THEN
    RAISE EXCEPTION 'Invalid p_sort';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_user_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius_meters := p_radius_miles * 1609.344;
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

  CREATE TEMP TABLE _feed_page ON COMMIT DROP AS
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
  LIMIT v_limit + 1;

  SELECT EXISTS (SELECT 1 FROM _feed_page OFFSET v_limit LIMIT 1) INTO v_has_more;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_items
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
      thumb_path
    FROM _feed_page
    LIMIT v_limit
  ) t;

  IF v_has_more THEN
    SELECT boost_sort, sort_value, id
    INTO v_last_boost, v_last_sort, v_last_id
    FROM _feed_page
    ORDER BY boost_sort, sort_value, id
    OFFSET v_limit - 1
    LIMIT 1;

    v_next_cursor := encode(
      convert_to(
        json_build_object('b', v_last_boost, 's', v_last_sort, 'i', v_last_id)::text,
        'utf8'
      ),
      'base64'
    );
  END IF;

  RETURN json_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor
  );
END;
$$;
