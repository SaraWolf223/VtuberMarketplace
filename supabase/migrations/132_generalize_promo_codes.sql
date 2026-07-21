-- VtuberMarketplace: generalize promo_codes into generic order-checkout discount codes,
-- decoupled from the removed founding-seller/boost/premium concepts. Platform-wide
-- codes (scope='platform') or seller-scoped codes (scope='seller', usable only on that
-- seller's own listings — a Pro Seller perk, see docs/10-Monetization_System.md).

ALTER TYPE promo_code_type ADD VALUE IF NOT EXISTS 'percent_off';
ALTER TYPE promo_code_type ADD VALUE IF NOT EXISTS 'flat_off_cents';

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform', 'seller')),
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES profiles (id) ON DELETE CASCADE,
  ADD CONSTRAINT promo_codes_seller_scope_check CHECK (
    (scope = 'platform' AND seller_id IS NULL) OR (scope = 'seller' AND seller_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS promo_codes_seller_idx ON promo_codes (seller_id) WHERE seller_id IS NOT NULL;

-- Old boost/premium/founding-seller redemption function no longer applies to this
-- domain's checkout flow (order discounts are applied inline in create-order-checkout,
-- a service-role edge function, not a client RPC) — drop it.
DROP FUNCTION IF EXISTS apply_promo_redemption(UUID, TEXT) CASCADE;

-- promo_redemptions.boosts_remaining / premium_until columns are now unused by new
-- code paths; keep them nullable for historical rows rather than a destructive drop.
ALTER TABLE promo_redemptions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_cents_applied INT CHECK (discount_cents_applied IS NULL OR discount_cents_applied >= 0);

-- Validates a promo code for a given buyer + listing at checkout time. Read-only —
-- the actual redemption row is inserted by create-order-checkout (service role) once
-- payment succeeds, so an abandoned checkout never burns a redemption.
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code TEXT,
  p_listing_id UUID,
  p_base_price_cents INT
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(p_code));
  v_promo promo_codes%ROWTYPE;
  v_seller_id UUID;
  v_discount_cents INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_code IS NULL OR v_code = '' OR v_code !~ '^[A-Z0-9_-]{4,32}$' THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  SELECT seller_id INTO v_seller_id FROM listings WHERE id = p_listing_id;
  IF v_seller_id IS NULL THEN
    RETURN json_build_object('error', 'LISTING_NOT_FOUND');
  END IF;

  SELECT * INTO v_promo FROM promo_codes WHERE LOWER(code) = LOWER(v_code);
  IF NOT FOUND OR NOT v_promo.active THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF v_promo.type NOT IN ('percent_off', 'flat_off_cents') THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= v_now THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redemption_count >= v_promo.max_redemptions THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF v_promo.scope = 'seller' AND v_promo.seller_id IS DISTINCT FROM v_seller_id THEN
    RETURN json_build_object('error', 'NOT_APPLICABLE');
  END IF;

  IF EXISTS (SELECT 1 FROM promo_redemptions r WHERE r.promo_code_id = v_promo.id AND r.user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'ALREADY_REDEEMED');
  END IF;

  IF v_promo.type = 'percent_off' THEN
    v_discount_cents := (p_base_price_cents * v_promo.value / 100)::INT;
  ELSE
    v_discount_cents := LEAST(v_promo.value, p_base_price_cents);
  END IF;

  RETURN json_build_object(
    'promo_code_id', v_promo.id,
    'type', v_promo.type,
    'value', v_promo.value,
    'discount_cents', v_discount_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_promo_code(TEXT, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT, UUID, INT) TO authenticated, service_role;
