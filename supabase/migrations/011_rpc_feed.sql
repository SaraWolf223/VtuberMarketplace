-- Local Marketplace: feed RPC (skeleton — geo/boost logic expanded in prompt 06)
CREATE OR REPLACE FUNCTION get_feed_listings(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_miles INT DEFAULT 10,
  p_category listing_category DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_status listing_status DEFAULT 'active',
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'newest',
  p_cursor TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_point extensions.geography;
  v_radius_meters DOUBLE PRECISION;
  v_items JSON;
BEGIN
  IF p_radius_miles NOT IN (5, 10, 25, 50) THEN
    RAISE EXCEPTION 'p_radius_miles must be 5, 10, 25, or 50';
  END IF;

  v_user_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius_meters := p_radius_miles * 1609.34;

  SELECT COALESCE(json_agg(row_to_json(feed_row)), '[]'::json)
  INTO v_items
  FROM (
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
      extensions.ST_Distance(l.location, v_user_point) / 1609.34 AS distance_miles
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
    ORDER BY
      CASE WHEN l.boosted_until > NOW() THEN 0 ELSE 1 END,
      l.published_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 50)
  ) AS feed_row;

  RETURN json_build_object(
    'items', v_items,
    'next_cursor', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION get_feed_listings FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_feed_listings TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_listings TO anon;
