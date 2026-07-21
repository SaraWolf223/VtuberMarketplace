-- Per-listing model-support subscriptions (purchasers of eligible listings only).
-- Eligible: asset_type IN (live2d_2d, model_3d) OR category = 'vrchat'.

CREATE TYPE support_subscription_status AS ENUM (
  'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
);

CREATE TYPE support_quote_status AS ENUM (
  'draft', 'pending_buyer', 'accepted', 'paid', 'declined', 'cancelled', 'expired'
);

ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'support_subscription';
ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'support_quote';

ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'support_subscription_started';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'support_quote_received';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'support_quote_accepted';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'support_quote_paid';

CREATE OR REPLACE FUNCTION listing_supports_support_plan(p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = p_listing_id
      AND (l.asset_type IN ('live2d_2d', 'model_3d') OR l.category = 'vrchat')
  );
$$;

CREATE TABLE listing_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL UNIQUE REFERENCES listings (id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  price_cents_month INT NOT NULL CHECK (price_cents_month > 0),
  offerings_text TEXT NOT NULL CHECK (char_length(offerings_text) BETWEEN 1 AND 2000),
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER listing_support_plans_set_updated_at
  BEFORE UPDATE ON listing_support_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE listing_support_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES listing_support_plans (id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status support_subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_support_subscriptions_parties_diff CHECK (buyer_id <> seller_id)
);

CREATE UNIQUE INDEX listing_support_subscriptions_active_buyer_listing
  ON listing_support_subscriptions (listing_id, buyer_id)
  WHERE status = 'active';

CREATE INDEX listing_support_subscriptions_seller_idx
  ON listing_support_subscriptions (seller_id, created_at DESC);
CREATE INDEX listing_support_subscriptions_buyer_idx
  ON listing_support_subscriptions (buyer_id, created_at DESC);

CREATE TRIGGER listing_support_subscriptions_set_updated_at
  BEFORE UPDATE ON listing_support_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE support_work_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES listing_support_subscriptions (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  status support_quote_status NOT NULL DEFAULT 'draft',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_work_quotes_subscription_idx ON support_work_quotes (subscription_id);
CREATE INDEX support_work_quotes_buyer_idx ON support_work_quotes (buyer_id, created_at DESC);
CREATE INDEX support_work_quotes_seller_idx ON support_work_quotes (seller_id, created_at DESC);

CREATE TRIGGER support_work_quotes_set_updated_at
  BEFORE UPDATE ON support_work_quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE listing_support_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_support_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_work_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_support_plans_select_public ON listing_support_plans
  FOR SELECT TO anon, authenticated
  USING (
    active
    AND EXISTS (
      SELECT 1 FROM listings l
      JOIN profiles p ON p.id = l.seller_id
      WHERE l.id = listing_support_plans.listing_id
        AND l.status IN ('active', 'sold')
        AND p.banned_at IS NULL AND p.shadow_banned = FALSE
    )
  );

CREATE POLICY listing_support_plans_select_owner ON listing_support_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_support_plans.listing_id AND l.seller_id = auth.uid())
  );

CREATE POLICY listing_support_plans_owner_write ON listing_support_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_support_plans.listing_id AND l.seller_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_support_plans.listing_id AND l.seller_id = auth.uid())
    AND listing_supports_support_plan(listing_id)
  );

CREATE POLICY listing_support_subscriptions_select_party ON listing_support_subscriptions
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR is_app_staff());

CREATE POLICY support_work_quotes_select_party ON support_work_quotes
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR is_app_staff());

-- Writes for subscriptions/quotes go through service-role edge functions.

CREATE OR REPLACE FUNCTION can_subscribe_to_listing_support(p_listing_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_listing listings%ROWTYPE;
  v_plan listing_support_plans%ROWTYPE;
  v_order_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'NOT_FOUND');
  END IF;

  IF v_listing.seller_id = v_uid THEN
    RETURN json_build_object('ok', FALSE, 'error', 'OWN_LISTING');
  END IF;

  IF NOT listing_supports_support_plan(p_listing_id) THEN
    RETURN json_build_object('ok', FALSE, 'error', 'LISTING_NOT_ELIGIBLE');
  END IF;

  SELECT * INTO v_plan FROM listing_support_plans WHERE listing_id = p_listing_id AND active;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'NO_ACTIVE_PLAN');
  END IF;

  SELECT id INTO v_order_id
  FROM orders
  WHERE listing_id = p_listing_id AND buyer_id = v_uid AND status = 'fulfilled'
  ORDER BY fulfilled_at DESC
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN json_build_object('ok', FALSE, 'error', 'NO_FULFILLED_ORDER');
  END IF;

  IF EXISTS (
    SELECT 1 FROM listing_support_subscriptions
    WHERE listing_id = p_listing_id AND buyer_id = v_uid AND status = 'active'
  ) THEN
    RETURN json_build_object('ok', FALSE, 'error', 'ALREADY_SUBSCRIBED');
  END IF;

  RETURN json_build_object(
    'ok', TRUE,
    'order_id', v_order_id,
    'plan_id', v_plan.id,
    'price_cents_month', v_plan.price_cents_month,
    'offerings_text', v_plan.offerings_text
  );
END;
$$;

REVOKE ALL ON FUNCTION can_subscribe_to_listing_support(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_subscribe_to_listing_support(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION create_support_work_quote(
  p_subscription_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_amount_cents INT,
  p_expires_hours INT DEFAULT 72
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sub listing_support_subscriptions%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_sub FROM listing_support_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;
  IF v_sub.seller_id <> v_uid THEN
    RETURN json_build_object('error', 'NOT_OWNER');
  END IF;
  IF v_sub.status <> 'active' THEN
    RETURN json_build_object('error', 'SUBSCRIPTION_NOT_ACTIVE');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('error', 'INVALID_AMOUNT');
  END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) < 1 THEN
    RETURN json_build_object('error', 'TITLE_REQUIRED');
  END IF;

  INSERT INTO support_work_quotes (
    subscription_id, seller_id, buyer_id, title, description, amount_cents, status, expires_at
  )
  VALUES (
    p_subscription_id, v_uid, v_sub.buyer_id, trim(p_title), NULLIF(trim(p_description), ''),
    p_amount_cents, 'pending_buyer',
    NOW() + (GREATEST(COALESCE(p_expires_hours, 72), 1) || ' hours')::INTERVAL
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', TRUE, 'quote_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION create_support_work_quote(UUID, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_support_work_quote(UUID, TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION respond_support_work_quote(
  p_quote_id UUID,
  p_accept BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_quote support_work_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_quote FROM support_work_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;
  IF v_quote.buyer_id <> v_uid THEN
    RETURN json_build_object('error', 'NOT_BUYER');
  END IF;
  IF v_quote.status <> 'pending_buyer' THEN
    RETURN json_build_object('error', 'NOT_PENDING');
  END IF;
  IF v_quote.expires_at IS NOT NULL AND v_quote.expires_at < NOW() THEN
    UPDATE support_work_quotes SET status = 'expired', updated_at = NOW() WHERE id = p_quote_id;
    RETURN json_build_object('error', 'EXPIRED');
  END IF;

  IF p_accept THEN
    UPDATE support_work_quotes SET status = 'accepted', updated_at = NOW() WHERE id = p_quote_id;
    RETURN json_build_object('ok', TRUE, 'status', 'accepted', 'quote_id', p_quote_id);
  END IF;

  UPDATE support_work_quotes SET status = 'declined', updated_at = NOW() WHERE id = p_quote_id;
  RETURN json_build_object('ok', TRUE, 'status', 'declined', 'quote_id', p_quote_id);
END;
$$;

REVOKE ALL ON FUNCTION respond_support_work_quote(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION respond_support_work_quote(UUID, BOOLEAN) TO authenticated;
