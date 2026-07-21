-- Restore 21-day purge schedule; seller may mark listing sold from chat anytime (no deal gate)

CREATE OR REPLACE FUNCTION listings_set_lifecycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
    NEW.expires_at := NEW.published_at + INTERVAL '14 days';
    NEW.purge_at := NEW.published_at + INTERVAL '21 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION listings_set_sold_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM 'sold') THEN
    NEW.sold_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

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

  PERFORM create_notification(
    v_conv.buyer_id,
    'listing_sold',
    'Listing marked sold',
    'The seller marked "' || COALESCE(v_title, 'this listing') || '" as sold. Your chat was closed.',
    v_conv.listing_id,
    NULL,
    v_uid
  );

  UPDATE listings
  SET status = 'sold', updated_at = NOW()
  WHERE id = v_conv.listing_id;

  DELETE FROM conversations WHERE id = p_conversation_id;

  RETURN json_build_object('ok', true, 'listing_id', v_conv.listing_id);
END;
$$;
