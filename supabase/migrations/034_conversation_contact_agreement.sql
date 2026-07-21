-- Mutual meet/deal acceptance before call, text, or phone reveal in DMs

CREATE TYPE contact_agreement_type AS ENUM ('meet', 'deal');

CREATE TABLE conversation_contact_agreements (
  conversation_id UUID PRIMARY KEY REFERENCES conversations (id) ON DELETE CASCADE,
  agreement_type contact_agreement_type NOT NULL,
  proposed_by UUID NOT NULL REFERENCES profiles (id),
  buyer_accepted_at TIMESTAMPTZ,
  seller_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversation_contact_agreements_proposed_by_idx
  ON conversation_contact_agreements (proposed_by);

CREATE OR REPLACE FUNCTION conversation_contact_unlocked(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    buyer_accepted_at IS NOT NULL
    AND seller_accepted_at IS NOT NULL
  FROM conversation_contact_agreements
  WHERE conversation_id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION get_conversation_contact_agreement(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conv conversations%ROWTYPE;
  v_row conversation_contact_agreements%ROWTYPE;
  v_is_buyer BOOLEAN;
  v_my_accepted BOOLEAN;
  v_other_accepted BOOLEAN;
  v_unlocked BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_conv
  FROM conversations c
  WHERE c.id = p_conversation_id
    AND is_conversation_participant(p_conversation_id, v_uid);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  v_is_buyer := v_conv.buyer_id = v_uid;

  SELECT * INTO v_row
  FROM conversation_contact_agreements
  WHERE conversation_id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'has_agreement', false,
      'contact_unlocked', false,
      'agreement_type', NULL,
      'proposed_by', NULL,
      'my_accepted', false,
      'other_accepted', false,
      'is_buyer', v_is_buyer
    );
  END IF;

  IF v_is_buyer THEN
    v_my_accepted := v_row.buyer_accepted_at IS NOT NULL;
    v_other_accepted := v_row.seller_accepted_at IS NOT NULL;
  ELSE
    v_my_accepted := v_row.seller_accepted_at IS NOT NULL;
    v_other_accepted := v_row.buyer_accepted_at IS NOT NULL;
  END IF;

  v_unlocked := v_my_accepted AND v_other_accepted;

  RETURN json_build_object(
    'has_agreement', true,
    'contact_unlocked', v_unlocked,
    'agreement_type', v_row.agreement_type,
    'proposed_by', v_row.proposed_by,
    'my_accepted', v_my_accepted,
    'other_accepted', v_other_accepted,
    'is_buyer', v_is_buyer,
    'buyer_accepted_at', v_row.buyer_accepted_at,
    'seller_accepted_at', v_row.seller_accepted_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION propose_contact_agreement(
  p_conversation_id UUID,
  p_agreement_type contact_agreement_type
)
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
    AND is_conversation_participant(p_conversation_id, v_uid);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF users_are_blocked(v_conv.buyer_id, v_conv.seller_id) THEN
    RETURN json_build_object('error', 'BLOCKED');
  END IF;

  INSERT INTO conversation_contact_agreements (
    conversation_id,
    agreement_type,
    proposed_by,
    buyer_accepted_at,
    seller_accepted_at,
    updated_at
  )
  VALUES (
    p_conversation_id,
    p_agreement_type,
    v_uid,
    CASE WHEN v_conv.buyer_id = v_uid THEN NOW() ELSE NULL END,
    CASE WHEN v_conv.seller_id = v_uid THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (conversation_id) DO UPDATE SET
    agreement_type = EXCLUDED.agreement_type,
    proposed_by = EXCLUDED.proposed_by,
    buyer_accepted_at = EXCLUDED.buyer_accepted_at,
    seller_accepted_at = EXCLUDED.seller_accepted_at,
    updated_at = NOW();

  RETURN get_conversation_contact_agreement(p_conversation_id);
END;
$$;

CREATE OR REPLACE FUNCTION accept_contact_agreement(p_conversation_id UUID)
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
    AND is_conversation_participant(p_conversation_id, v_uid);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM conversation_contact_agreements WHERE conversation_id = p_conversation_id
  ) THEN
    RETURN json_build_object('error', 'NO_AGREEMENT');
  END IF;

  UPDATE conversation_contact_agreements
  SET
    buyer_accepted_at = CASE
      WHEN v_conv.buyer_id = v_uid THEN COALESCE(buyer_accepted_at, NOW())
      ELSE buyer_accepted_at
    END,
    seller_accepted_at = CASE
      WHEN v_conv.seller_id = v_uid THEN COALESCE(seller_accepted_at, NOW())
      ELSE seller_accepted_at
    END,
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id;

  RETURN get_conversation_contact_agreement(p_conversation_id);
END;
$$;

CREATE OR REPLACE FUNCTION reveal_conversation_phones(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conv conversations%ROWTYPE;
  v_other_id UUID;
  v_my_phone TEXT;
  v_other_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_conv
  FROM conversations c
  WHERE c.id = p_conversation_id
    AND is_conversation_participant(p_conversation_id, v_uid);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF NOT conversation_contact_unlocked(p_conversation_id) THEN
    RETURN json_build_object('error', 'CONTACT_NOT_UNLOCKED');
  END IF;

  v_other_id := CASE
    WHEN v_conv.buyer_id = v_uid THEN v_conv.seller_id
    ELSE v_conv.buyer_id
  END;

  INSERT INTO listing_interest (listing_id, buyer_id)
  VALUES (v_conv.listing_id, v_conv.buyer_id)
  ON CONFLICT (listing_id, buyer_id) DO NOTHING;

  SELECT phone INTO v_my_phone FROM profiles WHERE id = v_uid;
  SELECT phone INTO v_other_phone FROM profiles WHERE id = v_other_id;

  RETURN json_build_object(
    'my_phone', v_my_phone,
    'other_phone', v_other_phone,
    'other_user_id', v_other_id
  );
END;
$$;

-- Listing-only reveal stays disabled unless DM agreement exists for that buyer/seller pair
CREATE OR REPLACE FUNCTION reveal_seller_phone(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing listings%ROWTYPE;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;

  IF NOT FOUND OR v_listing.status <> 'active' OR v_listing.seller_id = v_uid THEN
    RETURN json_build_object('phone', null, 'error', 'NOT_AVAILABLE');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM conversations c
    INNER JOIN conversation_contact_agreements a ON a.conversation_id = c.id
    WHERE c.listing_id = p_listing_id
      AND c.buyer_id = v_uid
      AND c.seller_id = v_listing.seller_id
      AND a.buyer_accepted_at IS NOT NULL
      AND a.seller_accepted_at IS NOT NULL
  ) THEN
    RETURN json_build_object('phone', null, 'error', 'CONTACT_NOT_UNLOCKED');
  END IF;

  INSERT INTO listing_interest (listing_id, buyer_id)
  VALUES (p_listing_id, v_uid)
  ON CONFLICT (listing_id, buyer_id) DO NOTHING;

  SELECT phone INTO v_phone FROM profiles WHERE id = v_listing.seller_id;

  RETURN json_build_object('phone', v_phone);
END;
$$;

ALTER TABLE conversation_contact_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_contact_agreements_select_participant
  ON conversation_contact_agreements
  FOR SELECT TO authenticated
  USING (is_conversation_participant(conversation_id, auth.uid()));

GRANT EXECUTE ON FUNCTION get_conversation_contact_agreement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION propose_contact_agreement(UUID, contact_agreement_type) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_contact_agreement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reveal_conversation_phones(UUID) TO authenticated;
