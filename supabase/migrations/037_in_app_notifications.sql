-- In-app notification center for messages, deals, reviews, and listing events

CREATE TYPE notification_kind AS ENUM (
  'dm_message',
  'dm_started',
  'deal_proposed',
  'deal_accepted',
  'deal_unlocked',
  'review_received',
  'review_eligible',
  'listing_sold',
  'listing_expiring',
  'listing_expired',
  'listing_paused'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  kind notification_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  listing_id UUID REFERENCES listings (id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Insert notification (triggers + SECURITY DEFINER RPCs only)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_kind notification_kind,
  p_title TEXT,
  p_body TEXT,
  p_listing_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_user_id = p_actor_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (
    user_id,
    kind,
    title,
    body,
    listing_id,
    conversation_id,
    actor_user_id
  )
  VALUES (
    p_user_id,
    p_kind,
    p_title,
    p_body,
    p_listing_id,
    p_conversation_id,
    p_actor_user_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_notification FROM PUBLIC;

-- New DM to recipient
CREATE OR REPLACE FUNCTION notify_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_recipient UUID;
  v_sender_name TEXT;
  v_listing_title TEXT;
  v_preview TEXT;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_recipient := CASE
    WHEN v_conv.buyer_id = NEW.sender_id THEN v_conv.seller_id
    ELSE v_conv.buyer_id
  END;

  SELECT display_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_listing_title FROM listings WHERE id = v_conv.listing_id;

  v_preview := left(NEW.body, 120);
  IF char_length(NEW.body) > 120 THEN
    v_preview := v_preview || '…';
  END IF;

  PERFORM create_notification(
    v_recipient,
    'dm_message',
    COALESCE(v_sender_name, 'Someone') || ' messaged you',
    v_preview || ' · ' || COALESCE(v_listing_title, 'Listing'),
    v_conv.listing_id,
    NEW.conversation_id,
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_create_notification
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_message_insert();

-- Buyer opened a conversation — notify seller
CREATE OR REPLACE FUNCTION notify_on_conversation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name TEXT;
  v_listing_title TEXT;
BEGIN
  SELECT display_name INTO v_buyer_name FROM profiles WHERE id = NEW.buyer_id;
  SELECT title INTO v_listing_title FROM listings WHERE id = NEW.listing_id;

  PERFORM create_notification(
    NEW.seller_id,
    'dm_started',
    'New message request',
    COALESCE(v_buyer_name, 'A buyer') || ' wants to chat about "' || COALESCE(v_listing_title, 'your listing') || '"',
    NEW.listing_id,
    NEW.id,
    NEW.buyer_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_create_notification
  AFTER INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_conversation_insert();

-- Deal propose / accept / unlock
CREATE OR REPLACE FUNCTION notify_on_contact_agreement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_actor_name TEXT;
  v_listing_title TEXT;
  v_other_id UUID;
  v_was_unlocked BOOLEAN;
  v_now_unlocked BOOLEAN;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_listing_title FROM listings WHERE id = v_conv.listing_id;

  IF TG_OP = 'INSERT' THEN
    v_other_id := CASE
      WHEN NEW.proposed_by = v_conv.buyer_id THEN v_conv.seller_id
      ELSE v_conv.buyer_id
    END;

    SELECT display_name INTO v_actor_name FROM profiles WHERE id = NEW.proposed_by;

    PERFORM create_notification(
      v_other_id,
      'deal_proposed',
      'Deal proposed',
      COALESCE(v_actor_name, 'The other party') || ' proposed a deal on "' || COALESCE(v_listing_title, 'your listing') || '"',
      v_conv.listing_id,
      NEW.conversation_id,
      NEW.proposed_by
    );

    RETURN NEW;
  END IF;

  v_was_unlocked := OLD.buyer_accepted_at IS NOT NULL AND OLD.seller_accepted_at IS NOT NULL;
  v_now_unlocked := NEW.buyer_accepted_at IS NOT NULL AND NEW.seller_accepted_at IS NOT NULL;

  IF v_now_unlocked AND NOT v_was_unlocked THEN
    PERFORM create_notification(
      v_conv.buyer_id,
      'deal_unlocked',
      'Deal agreed',
      'You both agreed to a deal on "' || COALESCE(v_listing_title, 'this listing') || '". Contact is unlocked.',
      v_conv.listing_id,
      NEW.conversation_id,
      NULL
    );
    PERFORM create_notification(
      v_conv.seller_id,
      'deal_unlocked',
      'Deal agreed',
      'You both agreed to a deal on "' || COALESCE(v_listing_title, 'this listing') || '". Contact is unlocked.',
      v_conv.listing_id,
      NEW.conversation_id,
      NULL
    );
    PERFORM create_notification(
      v_conv.buyer_id,
      'review_eligible',
      'Leave a review',
      'You can now rate your experience for "' || COALESCE(v_listing_title, 'this listing') || '"',
      v_conv.listing_id,
      NEW.conversation_id,
      NULL
    );
    RETURN NEW;
  END IF;

  IF NEW.buyer_accepted_at IS NOT NULL AND (OLD.buyer_accepted_at IS NULL) AND NOT v_now_unlocked THEN
    v_other_id := v_conv.seller_id;
    SELECT display_name INTO v_actor_name FROM profiles WHERE id = v_conv.buyer_id;
    PERFORM create_notification(
      v_other_id,
      'deal_accepted',
      'Deal accepted',
      COALESCE(v_actor_name, 'The buyer') || ' accepted your deal on "' || COALESCE(v_listing_title, 'this listing') || '"',
      v_conv.listing_id,
      NEW.conversation_id,
      v_conv.buyer_id
    );
  END IF;

  IF NEW.seller_accepted_at IS NOT NULL AND (OLD.seller_accepted_at IS NULL) AND NOT v_now_unlocked THEN
    v_other_id := v_conv.buyer_id;
    SELECT display_name INTO v_actor_name FROM profiles WHERE id = v_conv.seller_id;
    PERFORM create_notification(
      v_other_id,
      'deal_accepted',
      'Deal accepted',
      COALESCE(v_actor_name, 'The seller') || ' accepted your deal on "' || COALESCE(v_listing_title, 'this listing') || '"',
      v_conv.listing_id,
      NEW.conversation_id,
      v_conv.seller_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contact_agreements_notify
  AFTER INSERT OR UPDATE ON conversation_contact_agreements
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_contact_agreement_change();

-- New review for seller
CREATE OR REPLACE FUNCTION notify_on_review_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name TEXT;
  v_listing_title TEXT;
BEGIN
  SELECT display_name INTO v_buyer_name FROM profiles WHERE id = NEW.buyer_id;
  SELECT title INTO v_listing_title FROM listings WHERE id = NEW.listing_id;

  PERFORM create_notification(
    NEW.seller_id,
    'review_received',
    'New ' || NEW.rating::TEXT || '-star review',
    COALESCE(v_buyer_name, 'A buyer') || ' reviewed you for "' || COALESCE(v_listing_title, 'a listing') || '"',
    NEW.listing_id,
    NULL,
    NEW.buyer_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_create_notification
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_review_insert();

-- Listing status changes (paused, expired, sold from my-listings)
CREATE OR REPLACE FUNCTION notify_on_listing_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paused_pending_review' AND OLD.status IS DISTINCT FROM 'paused_pending_review' THEN
    PERFORM create_notification(
      NEW.seller_id,
      'listing_paused',
      'Listing under review',
      '"' || NEW.title || '" was paused while our team reviews a report.',
      NEW.id,
      NULL,
      NULL
    );
  ELSIF NEW.status = 'expired' AND OLD.status IN ('active', 'paused_pending_review') THEN
    PERFORM create_notification(
      NEW.seller_id,
      'listing_expired',
      'Listing expired',
      '"' || NEW.title || '" has expired and is hidden from the feed.',
      NEW.id,
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_status_notification
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_listing_status_change();

-- Notify buyer when seller marks sold from chat (before thread delete)
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

-- Expiring-soon reminders (run daily via cron / edge)
CREATE OR REPLACE FUNCTION notify_listings_expiring_soon()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT l.id, l.seller_id, l.title
    FROM listings l
    WHERE l.status = 'active'
      AND l.expires_at > NOW()
      AND l.expires_at <= NOW() + INTERVAL '2 days'
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.user_id = l.seller_id
          AND n.kind = 'listing_expiring'
          AND n.listing_id = l.id
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
  LOOP
    PERFORM create_notification(
      v_row.seller_id,
      'listing_expiring',
      'Listing expiring soon',
      '"' || v_row.title || '" expires in about 2 days. Renew or edit it in My listings.',
      v_row.id,
      NULL,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION notify_listings_expiring_soon FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notify_listings_expiring_soon TO service_role;

-- Client RPCs
CREATE OR REPLACE FUNCTION list_my_notifications(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_unread_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  kind notification_kind,
  title TEXT,
  body TEXT,
  listing_id UUID,
  conversation_id UUID,
  actor_user_id UUID,
  actor_display_name TEXT,
  actor_avatar_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.kind,
    n.title,
    n.body,
    n.listing_id,
    n.conversation_id,
    n.actor_user_id,
    p.display_name AS actor_display_name,
    p.avatar_url AS actor_avatar_url,
    n.read_at,
    n.created_at
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_user_id
  WHERE n.user_id = auth.uid()
    AND (NOT p_unread_only OR n.read_at IS NULL)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM notifications
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE notifications
  SET read_at = COALESCE(read_at, NOW())
  WHERE id = p_notification_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;

  RETURN json_build_object('ok', true);
END;
$$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT EXECUTE ON FUNCTION list_my_notifications(INT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;

-- Realtime for live badge updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
