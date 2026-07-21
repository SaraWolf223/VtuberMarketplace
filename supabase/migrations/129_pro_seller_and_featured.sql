-- VtuberMarketplace: Pro Seller subscription (replaces premium_subscriptions) +
-- Featured Listing credits/purchases (replaces premium_boost_credits/boost_purchases).

CREATE TABLE pro_seller_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX pro_seller_subscriptions_active_user
  ON pro_seller_subscriptions (user_id)
  WHERE status = 'active';

CREATE TRIGGER pro_seller_subscriptions_set_updated_at
  BEFORE UPDATE ON pro_seller_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE featured_listing_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  credits_total INT NOT NULL DEFAULT 4,
  credits_used INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_start)
);

CREATE INDEX featured_listing_credits_user_idx ON featured_listing_credits (user_id);

CREATE TABLE featured_listing_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount_cents INT NOT NULL,
  duration_days INT NOT NULL DEFAULT 7,
  source TEXT NOT NULL DEFAULT 'paid' CHECK (source IN ('paid', 'pro_seller_credit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX featured_listing_purchases_user_idx ON featured_listing_purchases (user_id);
CREATE INDEX featured_listing_purchases_listing_idx ON featured_listing_purchases (listing_id);

ALTER TABLE pro_seller_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_listing_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_listing_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY pro_seller_subscriptions_select_own ON pro_seller_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY featured_listing_credits_select_own ON featured_listing_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY featured_listing_purchases_select_own ON featured_listing_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Pro Seller status check (mirrors the old profile_premium_active shape).
CREATE OR REPLACE FUNCTION profile_pro_seller_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_pro_seller AND (p.pro_seller_until IS NULL OR p.pro_seller_until > NOW())
      FROM profiles p
      WHERE p.id = p_user_id
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION profile_pro_seller_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profile_pro_seller_active(UUID) TO authenticated, service_role;

-- Current platform commission (basis points) for a seller — reads admin-configurable
-- public_app_config, never hardcoded. 1000 bps = 10%, 800 bps = 8%.
CREATE OR REPLACE FUNCTION current_platform_fee_bps(p_seller_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free INT;
  v_pro INT;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1000) INTO v_free
  FROM public_app_config WHERE key = 'platform_fee_bps_free';
  SELECT COALESCE((value #>> '{}')::INT, 800) INTO v_pro
  FROM public_app_config WHERE key = 'platform_fee_bps_pro';

  IF profile_pro_seller_active(p_seller_id) THEN
    RETURN COALESCE(v_pro, 800);
  END IF;
  RETURN COALESCE(v_free, 1000);
END;
$$;

REVOKE ALL ON FUNCTION current_platform_fee_bps(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_platform_fee_bps(UUID) TO authenticated, service_role;

-- Apply a Featured placement (paid or from a Pro Seller monthly credit).
CREATE OR REPLACE FUNCTION apply_featured_placement(
  p_user_id UUID,
  p_listing_id UUID,
  p_source TEXT,
  p_amount_cents INT DEFAULT 0,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration_days INT;
  v_period_start DATE := date_trunc('month', NOW() AT TIME ZONE 'UTC')::date;
  v_credit featured_listing_credits%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM listings WHERE id = p_listing_id AND seller_id = p_user_id) THEN
    RAISE EXCEPTION 'NOT_OWNER';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 7) INTO v_duration_days
  FROM public_app_config WHERE key = 'featured_placement_duration_days';
  v_duration_days := COALESCE(v_duration_days, 7);

  IF p_source = 'pro_seller_credit' THEN
    SELECT * INTO v_credit FROM featured_listing_credits
    WHERE user_id = p_user_id AND period_start = v_period_start
    FOR UPDATE;

    IF NOT FOUND OR v_credit.credits_used >= v_credit.credits_total THEN
      RAISE EXCEPTION 'NO_CREDITS_REMAINING';
    END IF;

    UPDATE featured_listing_credits
    SET credits_used = credits_used + 1
    WHERE id = v_credit.id;
  END IF;

  INSERT INTO featured_listing_purchases (user_id, listing_id, stripe_payment_intent_id, amount_cents, duration_days, source)
  VALUES (p_user_id, p_listing_id, p_stripe_payment_intent_id, p_amount_cents, v_duration_days, p_source);

  UPDATE listings
  SET featured_until = GREATEST(COALESCE(featured_until, NOW()), NOW()) + (v_duration_days || ' days')::INTERVAL
  WHERE id = p_listing_id;

  RETURN json_build_object('ok', TRUE, 'listing_id', p_listing_id, 'duration_days', v_duration_days);
END;
$$;

REVOKE ALL ON FUNCTION apply_featured_placement(UUID, UUID, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_featured_placement(UUID, UUID, TEXT, INT, TEXT) TO service_role;
