-- Security audit follow-up: direct messages (032_direct_messages.sql) never ran
-- message bodies through the banned-keyword filter that listings already use
-- (074_audit_fixes.sql, 096_remove_price_cap.sql, 110_listings_category_to_text.sql).
-- This closes that gap so spam/scam phrases (e.g. "wire transfer", "gift card code")
-- are blocked in DMs the same way they're blocked in listing titles/descriptions.

CREATE OR REPLACE FUNCTION send_conversation_message(
  p_conversation_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_trimmed TEXT;
  v_other UUID;
  v_recent INT;
  v_banned TEXT;
  v_msg_id UUID;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trimmed := btrim(p_body);
  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 2000 THEN
    RAISE EXCEPTION 'Message must be 1–2000 characters';
  END IF;

  IF NOT is_conversation_participant(p_conversation_id, v_sender) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  IF NOT is_phone_verified(v_sender) THEN
    RAISE EXCEPTION 'Phone verification required to send messages';
  END IF;

  v_banned := find_banned_keyword_in_text(v_trimmed);
  IF v_banned IS NOT NULL THEN
    RAISE EXCEPTION 'BANNED_KEYWORD';
  END IF;

  SELECT CASE
    WHEN c.buyer_id = v_sender THEN c.seller_id
    ELSE c.buyer_id
  END
  INTO v_other
  FROM conversations c
  WHERE c.id = p_conversation_id;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF users_are_blocked(v_sender, v_other) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  SELECT count(*)::INT INTO v_recent
  FROM messages
  WHERE conversation_id = p_conversation_id
    AND sender_id = v_sender
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_recent >= 15 THEN
    RAISE EXCEPTION 'Too many messages — wait a moment and try again';
  END IF;

  INSERT INTO messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_sender, v_trimmed)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;
