-- VtuberMarketplace: link-health-check + strike pipeline for seller-hosted download
-- links. See docs/11-Storage_and_Deletion_System.md for the full grace-period flow.

CREATE TABLE link_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings (id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_status_code INT,
  issue_open BOOLEAN NOT NULL DEFAULT FALSE,
  grace_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT link_health_checks_target_check CHECK (
    (listing_id IS NOT NULL AND order_id IS NULL) OR (listing_id IS NULL AND order_id IS NOT NULL)
  )
);

CREATE INDEX link_health_checks_open_idx ON link_health_checks (issue_open) WHERE issue_open;
CREATE UNIQUE INDEX link_health_checks_listing_idx ON link_health_checks (listing_id) WHERE listing_id IS NOT NULL;
CREATE UNIQUE INDEX link_health_checks_order_idx ON link_health_checks (order_id) WHERE order_id IS NOT NULL;

CREATE TRIGGER link_health_checks_set_updated_at
  BEFORE UPDATE ON link_health_checks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE seller_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings (id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  source strike_source NOT NULL,
  confirmed_by UUID NOT NULL REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX seller_strikes_seller_idx ON seller_strikes (seller_id, created_at DESC);
CREATE INDEX seller_strikes_active_idx ON seller_strikes (seller_id, expires_at);

ALTER TABLE link_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY link_health_checks_select_seller ON link_health_checks
  FOR SELECT TO authenticated
  USING (
    is_app_staff()
    OR EXISTS (SELECT 1 FROM listings l WHERE l.id = link_health_checks.listing_id AND l.seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM orders o WHERE o.id = link_health_checks.order_id AND o.seller_id = auth.uid())
  );

CREATE POLICY seller_strikes_select_own ON seller_strikes
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR is_app_staff());

-- Active strike count for a seller (non-expired rows only).
CREATE OR REPLACE FUNCTION active_strike_count(p_seller_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM seller_strikes
  WHERE seller_id = p_seller_id AND expires_at > NOW();
$$;

REVOKE ALL ON FUNCTION active_strike_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION active_strike_count(UUID) TO authenticated, service_role;

-- Confirm a strike (admin-only edge-function-backed action) — writes the row, and
-- auto-bans the seller once they hit the configured threshold (default 3).
CREATE OR REPLACE FUNCTION confirm_seller_strike(
  p_seller_id UUID,
  p_listing_id UUID,
  p_reason TEXT,
  p_source strike_source,
  p_confirmed_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expiry_months INT;
  v_ban_threshold INT;
  v_strike_id UUID;
  v_active_count INT;
  v_banned BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 12) INTO v_expiry_months
  FROM public_app_config WHERE key = 'strike_expiry_months';
  v_expiry_months := COALESCE(v_expiry_months, 12);

  SELECT COALESCE((value #>> '{}')::INT, 3) INTO v_ban_threshold
  FROM public_app_config WHERE key = 'strike_ban_threshold';
  v_ban_threshold := COALESCE(v_ban_threshold, 3);

  INSERT INTO seller_strikes (seller_id, listing_id, reason, source, confirmed_by, expires_at)
  VALUES (
    p_seller_id, p_listing_id, p_reason, p_source, p_confirmed_by,
    NOW() + (v_expiry_months || ' months')::INTERVAL
  )
  RETURNING id INTO v_strike_id;

  v_active_count := active_strike_count(p_seller_id);

  IF v_active_count >= v_ban_threshold THEN
    UPDATE profiles SET banned_at = NOW() WHERE id = p_seller_id AND banned_at IS NULL;
    v_banned := TRUE;
  END IF;

  RETURN json_build_object(
    'strike_id', v_strike_id,
    'active_strike_count', v_active_count,
    'banned', v_banned
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_seller_strike(UUID, UUID, TEXT, strike_source, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_seller_strike(UUID, UUID, TEXT, strike_source, UUID) TO service_role;
