-- Timed listing sale periods (Pro Seller only) + Pro Seller gate on seller-scoped promo codes.

CREATE TABLE listing_sale_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  percent_off INT CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off < 100)),
  sale_price_cents INT CHECK (sale_price_cents IS NULL OR sale_price_cents > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_sale_periods_discount_xor CHECK (
    (percent_off IS NOT NULL AND sale_price_cents IS NULL)
    OR (percent_off IS NULL AND sale_price_cents IS NOT NULL)
  ),
  CONSTRAINT listing_sale_periods_window CHECK (ends_at > starts_at)
);

CREATE INDEX listing_sale_periods_listing_idx ON listing_sale_periods (listing_id);
CREATE INDEX listing_sale_periods_active_window_idx
  ON listing_sale_periods (listing_id, starts_at, ends_at)
  WHERE active;

CREATE TRIGGER listing_sale_periods_set_updated_at
  BEFORE UPDATE ON listing_sale_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE listing_sale_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_sale_periods_select_public ON listing_sale_periods
  FOR SELECT TO anon, authenticated
  USING (
    active
    AND starts_at <= NOW()
    AND ends_at > NOW()
  );

CREATE POLICY listing_sale_periods_select_owner ON listing_sale_periods
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR is_app_staff());

CREATE OR REPLACE FUNCTION listing_effective_price_cents(p_listing_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price NUMERIC;
  v_sale listing_sale_periods%ROWTYPE;
  v_cents INT;
BEGIN
  SELECT price INTO v_price FROM listings WHERE id = p_listing_id;
  IF v_price IS NULL THEN
    RETURN NULL;
  END IF;

  v_cents := ROUND(v_price * 100)::INT;

  SELECT * INTO v_sale
  FROM listing_sale_periods
  WHERE listing_id = p_listing_id
    AND active
    AND starts_at <= NOW()
    AND ends_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_sale.sale_price_cents IS NOT NULL THEN
      RETURN LEAST(v_sale.sale_price_cents, v_cents);
    END IF;
    RETURN GREATEST(1, ROUND(v_cents * (100 - v_sale.percent_off) / 100.0)::INT);
  END IF;

  RETURN v_cents;
END;
$$;

REVOKE ALL ON FUNCTION listing_effective_price_cents(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION listing_effective_price_cents(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION upsert_listing_sale_period(
  p_listing_id UUID,
  p_percent_off INT DEFAULT NULL,
  p_sale_price_cents INT DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_sale_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_seller UUID;
  v_id UUID;
  v_starts TIMESTAMPTZ := COALESCE(p_starts_at, NOW());
  v_ends TIMESTAMPTZ := p_ends_at;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT profile_pro_seller_active(v_uid) THEN
    RETURN json_build_object('error', 'PRO_SELLER_REQUIRED');
  END IF;

  SELECT seller_id INTO v_seller FROM listings WHERE id = p_listing_id;
  IF v_seller IS NULL OR v_seller <> v_uid THEN
    RETURN json_build_object('error', 'NOT_OWNER');
  END IF;

  IF v_ends IS NULL OR v_ends <= v_starts THEN
    RETURN json_build_object('error', 'INVALID_WINDOW');
  END IF;

  IF (p_percent_off IS NULL) = (p_sale_price_cents IS NULL) THEN
    RETURN json_build_object('error', 'NEED_ONE_DISCOUNT_TYPE');
  END IF;

  -- Deactivate overlapping active sales on this listing.
  UPDATE listing_sale_periods
  SET active = FALSE, updated_at = NOW()
  WHERE listing_id = p_listing_id AND active AND (p_sale_id IS NULL OR id <> p_sale_id);

  IF p_sale_id IS NOT NULL THEN
    UPDATE listing_sale_periods
    SET
      percent_off = p_percent_off,
      sale_price_cents = p_sale_price_cents,
      starts_at = v_starts,
      ends_at = v_ends,
      active = TRUE,
      updated_at = NOW()
    WHERE id = p_sale_id AND seller_id = v_uid
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RETURN json_build_object('error', 'NOT_FOUND');
    END IF;
  ELSE
    INSERT INTO listing_sale_periods (
      listing_id, seller_id, percent_off, sale_price_cents, starts_at, ends_at, active
    )
    VALUES (
      p_listing_id, v_uid, p_percent_off, p_sale_price_cents, v_starts, v_ends, TRUE
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN json_build_object(
    'ok', TRUE,
    'sale_id', v_id,
    'effective_price_cents', listing_effective_price_cents(p_listing_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION upsert_listing_sale_period(UUID, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_listing_sale_period(UUID, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION deactivate_listing_sale_period(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE listing_sale_periods
  SET active = FALSE, updated_at = NOW()
  WHERE id = p_sale_id AND seller_id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN json_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION deactivate_listing_sale_period(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deactivate_listing_sale_period(UUID) TO authenticated;

-- Seller-scoped promo codes: Pro Seller only (create helper + tighten validate).
CREATE OR REPLACE FUNCTION create_seller_promo_code(
  p_code TEXT,
  p_type TEXT,
  p_value INT,
  p_max_redemptions INT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(p_code));
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT profile_pro_seller_active(v_uid) THEN
    RETURN json_build_object('error', 'PRO_SELLER_REQUIRED');
  END IF;

  IF v_code IS NULL OR v_code !~ '^[A-Z0-9_-]{4,32}$' THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF p_type NOT IN ('percent_off', 'flat_off_cents') THEN
    RETURN json_build_object('error', 'INVALID_TYPE');
  END IF;

  IF p_value IS NULL OR p_value <= 0 THEN
    RETURN json_build_object('error', 'INVALID_VALUE');
  END IF;

  IF p_type = 'percent_off' AND p_value > 90 THEN
    RETURN json_build_object('error', 'PERCENT_TOO_HIGH');
  END IF;

  INSERT INTO promo_codes (
    code, type, value, active, scope, seller_id, max_redemptions, expires_at
  )
  VALUES (
    v_code, p_type::promo_code_type, p_value, TRUE, 'seller', v_uid, p_max_redemptions, p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', TRUE, 'promo_code_id', v_id, 'code', v_code);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('error', 'CODE_EXISTS');
END;
$$;

REVOKE ALL ON FUNCTION create_seller_promo_code(TEXT, TEXT, INT, INT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_seller_promo_code(TEXT, TEXT, INT, INT, TIMESTAMPTZ) TO authenticated;

-- Tighten validate_promo_code: seller-scoped codes require active Pro Seller.
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
  v_base INT;
BEGIN
  IF v_code IS NULL OR v_code = '' OR v_code !~ '^[A-Z0-9_-]{4,32}$' THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  SELECT seller_id INTO v_seller_id FROM listings WHERE id = p_listing_id;
  IF v_seller_id IS NULL THEN
    RETURN json_build_object('error', 'LISTING_NOT_FOUND');
  END IF;

  -- Prefer effective (sale) price when caller passes raw listing price.
  v_base := COALESCE(NULLIF(p_base_price_cents, 0), listing_effective_price_cents(p_listing_id));

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

  IF v_promo.scope = 'seller' THEN
    IF v_promo.seller_id IS DISTINCT FROM v_seller_id THEN
      RETURN json_build_object('error', 'NOT_APPLICABLE');
    END IF;
    IF NOT profile_pro_seller_active(v_promo.seller_id) THEN
      RETURN json_build_object('error', 'NOT_APPLICABLE');
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM promo_redemptions r
    WHERE r.promo_code_id = v_promo.id AND r.user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'ALREADY_REDEEMED');
  END IF;

  IF v_promo.type = 'percent_off' THEN
    v_discount_cents := (v_base * v_promo.value / 100)::INT;
  ELSE
    v_discount_cents := LEAST(v_promo.value, v_base);
  END IF;

  RETURN json_build_object(
    'promo_code_id', v_promo.id,
    'type', v_promo.type,
    'value', v_promo.value,
    'discount_cents', v_discount_cents,
    'base_price_cents', v_base
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_promo_code(TEXT, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT, UUID, INT) TO authenticated, service_role;
