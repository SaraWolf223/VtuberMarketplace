-- Full-audit pass (Phase 6 live testing): reviews are gated by either a mutual
-- 'deal' contact agreement OR 5+ messages each way (listing_review_eligible),
-- both of which live on `conversations` / `conversation_contact_agreements` /
-- `messages`. mark_listing_sold_and_end_chat hard-deletes the conversation row
-- (by design — sellers are warned this permanently deletes all messages), and
-- conversation_contact_agreements + messages both CASCADE off conversations.
-- That means the instant a seller marks a listing sold, the buyer permanently
-- loses the ability to leave a review — even though marking sold is the exact
-- moment the deal was confirmed. Race: if the seller marks sold before the
-- buyer's review lands, the review becomes unobtainable forever.
--
-- Fix: snapshot a durable "this buyer is deal-review-eligible for this
-- listing" marker at the one point we already know it's true (right before
-- the destructive delete), and let listing_review_eligible honor it. This is
-- deliberately a NEW table rather than reusing listing_interest, since
-- listing_interest is also written just from viewing a listing detail page
-- (022_listing_detail_rpc.sql) — folding review eligibility into it would
-- undo the anti-spam tightening from migrations 033/035.

CREATE TABLE IF NOT EXISTS deal_review_unlocks (
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, buyer_id)
);

ALTER TABLE deal_review_unlocks ENABLE ROW LEVEL SECURITY;

-- RPC-only writes (mirrors listing_interest_no_direct_insert from migration 076).
CREATE POLICY deal_review_unlocks_select_own ON deal_review_unlocks
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

REVOKE ALL ON deal_review_unlocks FROM PUBLIC, authenticated, anon;
GRANT SELECT ON deal_review_unlocks TO authenticated;

CREATE OR REPLACE FUNCTION listing_review_eligible(p_listing_id UUID, p_buyer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM conversations c
      INNER JOIN conversation_contact_agreements a ON a.conversation_id = c.id
      WHERE c.listing_id = p_listing_id
        AND c.buyer_id = p_buyer_id
        AND a.agreement_type = 'deal'
        AND a.buyer_accepted_at IS NOT NULL
        AND a.seller_accepted_at IS NOT NULL
    )
    OR (
      (SELECT buyer_messages FROM listing_dm_message_counts(p_listing_id, p_buyer_id)) >= 5
      AND (SELECT seller_messages FROM listing_dm_message_counts(p_listing_id, p_buyer_id)) >= 5
    )
    OR EXISTS (
      SELECT 1 FROM deal_review_unlocks u
      WHERE u.listing_id = p_listing_id AND u.buyer_id = p_buyer_id
    );
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

  -- Snapshot review eligibility before the CASCADE delete below wipes out the
  -- agreement/messages that listing_review_eligible would otherwise rely on.
  INSERT INTO deal_review_unlocks (listing_id, buyer_id)
  VALUES (v_conv.listing_id, v_conv.buyer_id)
  ON CONFLICT (listing_id, buyer_id) DO NOTHING;

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
