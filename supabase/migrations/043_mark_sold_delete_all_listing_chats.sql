-- Mark sold: remove every conversation (and messages) tied to the listing, not only the current thread

CREATE OR REPLACE FUNCTION mark_listing_sold_and_end_chat(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conv conversations%ROWTYPE;
  v_title TEXT;
  v_buyer UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_conv
  FROM conversations c
  WHERE c.id = p_conversation_id
    AND c.seller_id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = v_conv.listing_id
      AND l.seller_id = v_uid
      AND l.status IN ('active', 'paused_pending_review')
  ) THEN
    RETURN json_build_object('error', 'LISTING_NOT_ACTIVE');
  END IF;

  SELECT title INTO v_title FROM listings WHERE id = v_conv.listing_id;

  FOR v_buyer IN
    SELECT DISTINCT c.buyer_id
    FROM conversations c
    WHERE c.listing_id = v_conv.listing_id
  LOOP
    PERFORM create_notification(
      v_buyer,
      'listing_sold',
      'Listing marked sold',
      'The seller marked "' || COALESCE(v_title, 'this listing') || '" as sold. All related chats were closed.',
      v_conv.listing_id,
      NULL,
      v_uid
    );
  END LOOP;

  UPDATE listings
  SET status = 'sold', updated_at = NOW()
  WHERE id = v_conv.listing_id;

  DELETE FROM conversations
  WHERE listing_id = v_conv.listing_id;

  RETURN json_build_object('ok', true, 'listing_id', v_conv.listing_id);
END;
$$;
