-- VtuberMarketplace: real item payments via Stripe Connect. `orders` replaces the
-- absence of item-payment processing in the physical-marketplace prototype.

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  license_type license_type NOT NULL,
  license_snapshot TEXT NOT NULL,
  base_price_cents INT NOT NULL CHECK (base_price_cents > 0),
  addon_total_cents INT NOT NULL DEFAULT 0 CHECK (addon_total_cents >= 0),
  total_cents INT NOT NULL CHECK (total_cents = base_price_cents + addon_total_cents),
  platform_fee_cents INT NOT NULL CHECK (platform_fee_cents >= 0),
  fee_bps_applied INT NOT NULL CHECK (fee_bps_applied >= 0 AND fee_bps_applied <= 10000),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  promo_code_id UUID REFERENCES promo_codes (id) ON DELETE SET NULL,
  discount_cents_applied INT NOT NULL DEFAULT 0 CHECK (discount_cents_applied >= 0),
  status order_status NOT NULL DEFAULT 'pending_payment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_buyer_seller_diff CHECK (buyer_id <> seller_id)
);

CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE INDEX orders_listing_idx ON orders (listing_id);
CREATE INDEX orders_status_idx ON orders (status);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  addon_option_id UUID NOT NULL REFERENCES listing_addon_options (id) ON DELETE RESTRICT,
  kind addon_kind NOT NULL,
  name_snapshot TEXT NOT NULL,
  fee_cents_snapshot INT NOT NULL CHECK (fee_cents_snapshot > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_addons_order_idx ON order_addons (order_id);

CREATE TABLE order_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
  deliverable_url TEXT NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  delivered_by UUID NOT NULL REFERENCES profiles (id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- RLS -----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_party ON orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR is_app_staff()
  );

-- All writes go through service-role edge functions (create-order-checkout,
-- stripe-webhook, submit-order-deliverable) — no direct client INSERT/UPDATE.

CREATE POLICY order_addons_select_party ON order_addons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_addons.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR is_app_staff())
    )
  );

CREATE POLICY order_deliverables_select_party ON order_deliverables
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_deliverables.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR is_app_staff())
    )
  );

-- --- Seller fulfillment RPC ----------------------------------------------------------
-- Lets a seller submit the deliverable link for their own awaiting_fulfillment order
-- without needing a service-role edge function for the common case (still callable
-- from submit-order-deliverable edge function too, which adds notification side effects).
CREATE OR REPLACE FUNCTION submit_order_deliverable(
  p_order_id UUID,
  p_deliverable_url TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order orders%ROWTYPE;
  v_url TEXT := btrim(p_deliverable_url);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_url !~ '^https?://' THEN
    RETURN json_build_object('error', 'INVALID_URL');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_order.seller_id <> v_uid THEN
    RETURN json_build_object('error', 'NOT_OWNER');
  END IF;

  IF v_order.status <> 'awaiting_fulfillment' THEN
    RETURN json_build_object('error', 'ORDER_NOT_FULFILLABLE');
  END IF;

  INSERT INTO order_deliverables (order_id, deliverable_url, note, delivered_by)
  VALUES (p_order_id, v_url, NULLIF(btrim(p_note), ''), v_uid)
  ON CONFLICT (order_id) DO UPDATE SET
    deliverable_url = EXCLUDED.deliverable_url,
    note = EXCLUDED.note,
    delivered_by = EXCLUDED.delivered_by,
    delivered_at = NOW();

  UPDATE orders
  SET status = 'fulfilled', fulfilled_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  RETURN json_build_object('ok', TRUE, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_order_deliverable(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_order_deliverable(UUID, TEXT, TEXT) TO authenticated;

-- --- OTU auto-sold trigger -----------------------------------------------------------
-- When an OTU order reaches fulfilled, mark the listing sold + delist.
CREATE OR REPLACE FUNCTION orders_mark_otu_listing_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled' AND (OLD.status IS DISTINCT FROM 'fulfilled') AND NEW.license_type = 'otu' THEN
    UPDATE listings
    SET status = 'sold', sold_at = NOW(), updated_at = NOW()
    WHERE id = NEW.listing_id AND status IN ('active', 'paused_pending_review');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_otu_sold
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_mark_otu_listing_sold();
