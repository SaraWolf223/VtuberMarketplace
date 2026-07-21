-- Full-audit pass (role-flow QA): get_listing_review_status has been marked
-- STABLE since 033_reviews_dm_message_gate.sql, but its body conditionally
-- INSERTs into listing_interest (to snapshot "buyer showed interest" the
-- first time they become DM-message-eligible without ever having viewed the
-- listing detail page, e.g. a thread opened another way). Postgres allows
-- CREATE OR REPLACE to declare this, but running it raises "INSERT is not
-- allowed in a non-volatile function" the moment that branch executes —
-- i.e. exactly when a buyer who just crossed the 5-messages-each-way
-- threshold checks their review status. Fix: redeclare as VOLATILE
-- (the default — just drop STABLE) since the function legitimately writes.

CREATE OR REPLACE FUNCTION get_listing_review_status(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
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
  v_eligible boolean;
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

  v_eligible := listing_review_eligible(p_listing_id, v_uid);

  SELECT EXISTS (
    SELECT 1 FROM listing_interest li
    WHERE li.listing_id = p_listing_id AND li.buyer_id = v_uid
  ) INTO v_has_interest;

  IF v_eligible AND NOT v_has_interest THEN
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
    'can_review', v_eligible AND NOT v_has_review,
    'is_own', false,
    'buyer_messages', v_buyer_messages,
    'seller_messages', v_seller_messages,
    'messages_required', v_messages_required
  );
END;
$$;
