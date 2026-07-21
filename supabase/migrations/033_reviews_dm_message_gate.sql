-- Reviews unlock after 5 messages from buyer + 5 from seller in the listing DM thread

CREATE OR REPLACE FUNCTION listing_dm_message_counts(
  p_listing_id UUID,
  p_buyer_id UUID
)
RETURNS TABLE (buyer_messages INT, seller_messages INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE m.sender_id = c.buyer_id)::INT AS buyer_messages,
    COUNT(*) FILTER (WHERE m.sender_id = c.seller_id)::INT AS seller_messages
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.listing_id = p_listing_id
    AND c.buyer_id = p_buyer_id;
$$;

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
  v_buyer_messages int := 0;
  v_seller_messages int := 0;
  v_messages_required int := 5;
  v_dm_ready boolean;
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
      'is_own', true,
      'buyer_messages', 0,
      'seller_messages', 0,
      'messages_required', v_messages_required
    );
  END IF;

  SELECT buyer_messages, seller_messages
  INTO v_buyer_messages, v_seller_messages
  FROM listing_dm_message_counts(p_listing_id, v_uid);

  v_dm_ready := v_buyer_messages >= v_messages_required
    AND v_seller_messages >= v_messages_required;

  SELECT EXISTS (
    SELECT 1 FROM listing_interest li
    WHERE li.listing_id = p_listing_id AND li.buyer_id = v_uid
  ) INTO v_has_interest;

  IF v_dm_ready AND NOT v_has_interest THEN
    INSERT INTO listing_interest (listing_id, buyer_id)
    VALUES (p_listing_id, v_uid)
    ON CONFLICT (listing_id, buyer_id) DO NOTHING;
    v_has_interest := true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.listing_id = p_listing_id AND r.buyer_id = v_uid
  ) INTO v_has_review;

  RETURN json_build_object(
    'has_interest', v_has_interest,
    'has_review', v_has_review,
    'can_review', v_dm_ready AND NOT v_has_review,
    'is_own', false,
    'buyer_messages', v_buyer_messages,
    'seller_messages', v_seller_messages,
    'messages_required', v_messages_required
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
  v_buyer_messages int;
  v_seller_messages int;
  v_messages_required int := 5;
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

  SELECT buyer_messages, seller_messages
  INTO v_buyer_messages, v_seller_messages
  FROM listing_dm_message_counts(p_listing_id, v_uid);

  IF v_buyer_messages < v_messages_required OR v_seller_messages < v_messages_required THEN
    RETURN json_build_object('error', 'DM_MESSAGES_REQUIRED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.listing_id = p_listing_id AND r.buyer_id = v_uid
  ) THEN
    RETURN json_build_object('error', 'ALREADY_REVIEWED');
  END IF;

  INSERT INTO listing_interest (listing_id, buyer_id)
  VALUES (p_listing_id, v_uid)
  ON CONFLICT (listing_id, buyer_id) DO NOTHING;

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
