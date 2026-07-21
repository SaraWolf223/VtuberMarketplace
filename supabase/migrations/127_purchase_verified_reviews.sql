-- VtuberMarketplace: reviews become purchase-verified only. Replaces the
-- listing_interest/deal-agreement/DM-count eligibility paths (already dropped in
-- migration 122) with a `fulfilled` order requirement.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders (id) ON DELETE CASCADE;

-- Backfill is not possible (no historical orders exist for pre-conversion reviews);
-- existing rows, if any, keep order_id NULL. New reviews always require it.
CREATE INDEX IF NOT EXISTS reviews_order_idx ON reviews (order_id);

DROP FUNCTION IF EXISTS get_listing_review_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS create_review(uuid, int, text) CASCADE;

CREATE OR REPLACE FUNCTION get_listing_review_status(p_listing_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_listing listings%ROWTYPE;
  v_order_id UUID;
  v_has_review BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_listing.seller_id = v_uid THEN
    RETURN json_build_object('has_order', false, 'has_review', false, 'can_review', false, 'is_own', true);
  END IF;

  SELECT id INTO v_order_id
  FROM orders
  WHERE listing_id = p_listing_id AND buyer_id = v_uid AND status = 'fulfilled'
  ORDER BY fulfilled_at DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM reviews r WHERE r.listing_id = p_listing_id AND r.buyer_id = v_uid
  ) INTO v_has_review;

  RETURN json_build_object(
    'has_order', v_order_id IS NOT NULL,
    'order_id', v_order_id,
    'has_review', v_has_review,
    'can_review', v_order_id IS NOT NULL AND NOT v_has_review,
    'is_own', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_review(
  p_order_id UUID,
  p_rating INT,
  p_body TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order orders%ROWTYPE;
  v_review_id UUID;
  v_body TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('error', 'INVALID_RATING');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_order.buyer_id <> v_uid THEN
    RETURN json_build_object('error', 'NOT_BUYER');
  END IF;

  IF v_order.status <> 'fulfilled' THEN
    RETURN json_build_object('error', 'ORDER_NOT_FULFILLED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM reviews r WHERE r.listing_id = v_order.listing_id AND r.buyer_id = v_uid
  ) THEN
    RETURN json_build_object('error', 'ALREADY_REVIEWED');
  END IF;

  v_body := NULLIF(trim(p_body), '');
  IF v_body IS NOT NULL AND char_length(v_body) > 300 THEN
    RETURN json_build_object('error', 'BODY_TOO_LONG');
  END IF;

  INSERT INTO reviews (seller_id, buyer_id, listing_id, order_id, rating, body)
  VALUES (v_order.seller_id, v_uid, v_order.listing_id, p_order_id, p_rating, v_body)
  RETURNING id INTO v_review_id;

  RETURN json_build_object('id', v_review_id);
END;
$$;

REVOKE ALL ON FUNCTION get_listing_review_status FROM PUBLIC;
REVOKE ALL ON FUNCTION create_review FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_review_status TO authenticated;
GRANT EXECUTE ON FUNCTION create_review TO authenticated;
