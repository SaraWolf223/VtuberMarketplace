-- Delete DM threads (both parties) and mark listing sold from chat after deal agreed

CREATE OR REPLACE FUNCTION delete_conversation(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_conversation_participant(p_conversation_id, v_uid) THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  DELETE FROM conversations WHERE id = p_conversation_id;

  RETURN json_build_object('ok', true);
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

  IF NOT conversation_contact_unlocked(p_conversation_id) THEN
    RETURN json_build_object('error', 'DEAL_NOT_AGREED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM conversation_contact_agreements a
    WHERE a.conversation_id = p_conversation_id
      AND a.agreement_type = 'deal'
  ) THEN
    RETURN json_build_object('error', 'DEAL_NOT_AGREED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = v_conv.listing_id
      AND l.seller_id = v_uid
      AND l.status = 'active'
  ) THEN
    RETURN json_build_object('error', 'LISTING_NOT_ACTIVE');
  END IF;

  UPDATE listings
  SET status = 'sold', updated_at = NOW()
  WHERE id = v_conv.listing_id;

  DELETE FROM conversations WHERE id = p_conversation_id;

  RETURN json_build_object('ok', true, 'listing_id', v_conv.listing_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_conversation_detail(p_conversation_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  listing_id UUID,
  listing_title TEXT,
  listing_price NUMERIC,
  listing_status listing_status,
  buyer_id UUID,
  seller_id UUID,
  other_user_id UUID,
  other_display_name TEXT,
  other_username TEXT,
  other_avatar_url TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    c.listing_id,
    l.title AS listing_title,
    l.price AS listing_price,
    l.status AS listing_status,
    c.buyer_id,
    c.seller_id,
    CASE
      WHEN c.buyer_id = auth.uid() THEN c.seller_id
      ELSE c.buyer_id
    END AS other_user_id,
    p.display_name AS other_display_name,
    p.username AS other_username,
    p.avatar_url AS other_avatar_url,
    c.updated_at
  FROM conversations c
  INNER JOIN listings l ON l.id = c.listing_id
  INNER JOIN profiles p ON p.id = CASE
    WHEN c.buyer_id = auth.uid() THEN c.seller_id
    ELSE c.buyer_id
  END
  WHERE c.id = p_conversation_id
    AND is_conversation_participant(p_conversation_id, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_listing_sold_and_end_chat(UUID) TO authenticated;
