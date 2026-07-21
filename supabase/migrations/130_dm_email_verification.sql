-- VtuberMarketplace: DM sending gate switches from phone verification to email
-- verification. Phone verification is retained but repurposed as a seller
-- Stripe Connect payout/publish gate (see migration 124/edge functions), not a
-- messaging gate — there is no meetup/phone-reveal concept in a remote marketplace.

CREATE OR REPLACE FUNCTION is_email_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email_confirmed_at IS NOT NULL
  FROM auth.users au
  WHERE au.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION is_email_verified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_email_verified(UUID) TO authenticated, service_role;

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

  IF NOT is_email_verified(v_sender) THEN
    RAISE EXCEPTION 'Email verification required to send messages';
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

GRANT EXECUTE ON FUNCTION send_conversation_message(UUID, TEXT) TO authenticated;

-- mark_phone_verified_stub / dev-mark-phone-verified stay as-is (repurposed for the
-- seller Connect-publish gate's phone step, still useful in dev/testing).
