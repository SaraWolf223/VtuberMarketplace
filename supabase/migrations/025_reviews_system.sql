-- Seller rating aggregate + review RPCs (interest gate, one review per listing)

CREATE OR REPLACE FUNCTION reviews_refresh_seller_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    rating_count = (SELECT COUNT(*)::int FROM reviews WHERE seller_id = NEW.seller_id),
    rating_avg = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE seller_id = NEW.seller_id),
      0
    )
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_refresh_seller_rating ON reviews;
CREATE TRIGGER reviews_refresh_seller_rating
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION reviews_refresh_seller_rating();

CREATE OR REPLACE FUNCTION get_listing_review_status(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing listings%ROWTYPE;
  v_has_interest boolean;
  v_has_review boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_listing.seller_id = v_uid THEN
    RETURN json_build_object(
      'has_interest', false,
      'has_review', false,
      'can_review', false,
      'is_own', true
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM listing_interest li
    WHERE li.listing_id = p_listing_id AND li.buyer_id = v_uid
  ) INTO v_has_interest;

  SELECT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.listing_id = p_listing_id AND r.buyer_id = v_uid
  ) INTO v_has_review;

  RETURN json_build_object(
    'has_interest', v_has_interest,
    'has_review', v_has_review,
    'can_review', v_has_interest AND NOT v_has_review,
    'is_own', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_review(
  p_listing_id uuid,
  p_rating int,
  p_body text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing listings%ROWTYPE;
  v_review_id uuid;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('error', 'INVALID_RATING');
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_listing.seller_id = v_uid THEN
    RETURN json_build_object('error', 'OWN_LISTING');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM listing_interest li
    WHERE li.listing_id = p_listing_id AND li.buyer_id = v_uid
  ) THEN
    RETURN json_build_object('error', 'NO_INTEREST');
  END IF;

  IF EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.listing_id = p_listing_id AND r.buyer_id = v_uid
  ) THEN
    RETURN json_build_object('error', 'ALREADY_REVIEWED');
  END IF;

  v_body := NULLIF(trim(p_body), '');
  IF v_body IS NOT NULL AND char_length(v_body) > 300 THEN
    RETURN json_build_object('error', 'BODY_TOO_LONG');
  END IF;

  INSERT INTO reviews (seller_id, buyer_id, listing_id, rating, body)
  VALUES (v_listing.seller_id, v_uid, p_listing_id, p_rating, v_body)
  RETURNING id INTO v_review_id;

  RETURN json_build_object('id', v_review_id);
END;
$$;

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

REVOKE ALL ON FUNCTION get_listing_review_status FROM PUBLIC;
REVOKE ALL ON FUNCTION create_review FROM PUBLIC;
REVOKE ALL ON FUNCTION get_seller_reviews FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_review_status TO authenticated;
GRANT EXECUTE ON FUNCTION create_review TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_reviews TO authenticated;
