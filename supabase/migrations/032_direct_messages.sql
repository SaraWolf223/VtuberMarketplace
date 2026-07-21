-- Local Marketplace: in-app direct messages (prompt 15)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_buyer_seller_diff CHECK (buyer_id <> seller_id),
  CONSTRAINT conversations_listing_buyer_unique UNIQUE (listing_id, buyer_id)
);

CREATE INDEX conversations_buyer_updated_idx ON conversations (buyer_id, updated_at DESC);
CREATE INDEX conversations_seller_updated_idx ON conversations (seller_id, updated_at DESC);
CREATE INDEX conversations_listing_idx ON conversations (listing_id);

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at ASC);
CREATE INDEX messages_sender_created_idx ON messages (sender_id, created_at DESC);

-- Bump conversation.updated_at when a message is sent
CREATE OR REPLACE FUNCTION touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_conversation_on_message();

-- Helpers
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION users_are_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM blocks
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$;

CREATE OR REPLACE FUNCTION is_phone_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_verified_at IS NOT NULL
  FROM profiles
  WHERE id = p_user_id;
$$;

-- Open or create a listing thread (buyer = auth.uid())
CREATE OR REPLACE FUNCTION get_or_create_listing_conversation(p_listing_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer UUID := auth.uid();
  v_seller UUID;
  v_status listing_status;
  v_conv UUID;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT seller_id, status
  INTO v_seller, v_status
  FROM listings
  WHERE id = p_listing_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Listing is not available for messages';
  END IF;

  IF v_seller = v_buyer THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;

  IF users_are_blocked(v_buyer, v_seller) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  SELECT id INTO v_conv
  FROM conversations
  WHERE listing_id = p_listing_id
    AND buyer_id = v_buyer;

  IF v_conv IS NULL THEN
    INSERT INTO conversations (listing_id, buyer_id, seller_id)
    VALUES (p_listing_id, v_buyer, v_seller)
    RETURNING id INTO v_conv;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_buyer), (v_conv, v_seller);
  END IF;

  RETURN v_conv;
END;
$$;

-- Send a message (phone-verified senders only; rate limited)
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

  IF NOT is_phone_verified(v_sender) THEN
    RAISE EXCEPTION 'Phone verification required to send messages';
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

-- Inbox list for current user
CREATE OR REPLACE FUNCTION list_my_conversations(p_limit INT DEFAULT 50)
RETURNS TABLE (
  conversation_id UUID,
  listing_id UUID,
  listing_title TEXT,
  listing_price NUMERIC,
  other_user_id UUID,
  other_display_name TEXT,
  other_username TEXT,
  other_avatar_url TEXT,
  last_message_body TEXT,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT c.*
    FROM conversations c
    WHERE c.buyer_id = auth.uid() OR c.seller_id = auth.uid()
    ORDER BY c.updated_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.body,
      m.created_at
    FROM messages m
    INNER JOIN mine ON mine.id = m.conversation_id
    ORDER BY m.conversation_id, m.created_at DESC
  )
  SELECT
    mine.id AS conversation_id,
    mine.listing_id,
    l.title AS listing_title,
    l.price AS listing_price,
    CASE
      WHEN mine.buyer_id = auth.uid() THEN mine.seller_id
      ELSE mine.buyer_id
    END AS other_user_id,
    p.display_name AS other_display_name,
    p.username AS other_username,
    p.avatar_url AS other_avatar_url,
    lm.body AS last_message_body,
    lm.created_at AS last_message_at,
    mine.updated_at
  FROM mine
  INNER JOIN listings l ON l.id = mine.listing_id
  INNER JOIN profiles p ON p.id = CASE
    WHEN mine.buyer_id = auth.uid() THEN mine.seller_id
    ELSE mine.buyer_id
  END
  LEFT JOIN last_msg lm ON lm.conversation_id = mine.id
  ORDER BY mine.updated_at DESC;
$$;

-- Thread header + listing context
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

-- Dev/testing: mark phone verified (Prompt 16 will replace with real OTP)
CREATE OR REPLACE FUNCTION mark_phone_verified_stub(p_phone TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE profiles
  SET
    phone = COALESCE(NULLIF(btrim(p_phone), ''), phone, '+10000000000'),
    phone_verified_at = COALESCE(phone_verified_at, NOW()),
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_listing_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_conversation_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_my_conversations(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_phone_verified_stub(TEXT) TO authenticated;

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_participant ON conversations
  FOR SELECT TO authenticated
  USING (is_conversation_participant(id, auth.uid()));

CREATE POLICY conversation_participants_select_own ON conversation_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY messages_select_participant ON messages
  FOR SELECT TO authenticated
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- Inserts only via SECURITY DEFINER RPCs
CREATE POLICY messages_no_direct_insert ON messages
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

-- Realtime (3s poll fallback in client if unavailable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
