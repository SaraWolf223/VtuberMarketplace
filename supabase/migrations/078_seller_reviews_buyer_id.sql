-- Expose buyer_id in get_seller_reviews for in-app profile navigation.

CREATE OR REPLACE FUNCTION get_seller_reviews(p_seller_id uuid, p_limit int DEFAULT 20)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'rating', t.rating,
        'body', t.body,
        'created_at', t.created_at,
        'listing_id', t.listing_id,
        'buyer_id', t.buyer_id,
        'buyer_display_name', t.buyer_display_name,
        'buyer_username', t.buyer_username,
        'buyer_avatar_url', t.buyer_avatar_url
      )
    ),
    '[]'::json
  )
  INTO v_result
  FROM (
    SELECT
      r.id,
      r.rating,
      r.body,
      r.created_at,
      r.listing_id,
      r.buyer_id,
      p.display_name AS buyer_display_name,
      p.username AS buyer_username,
      p.avatar_url AS buyer_avatar_url
    FROM reviews r
    JOIN profiles p ON p.id = r.buyer_id
    WHERE r.seller_id = p_seller_id
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
    ORDER BY r.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 20)
  ) t;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_seller_reviews(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_seller_reviews(uuid, int) TO authenticated;
