-- VtuberMarketplace: seller-defined customization/setup fee add-ons, stackable per
-- listing. A buyer may select any combination of active rows at checkout (see
-- order_addons in migration 127).

CREATE TABLE listing_addon_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  kind addon_kind NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  extra_fee_cents INT NOT NULL CHECK (extra_fee_cents > 0),
  estimated_turnaround TEXT CHECK (estimated_turnaround IS NULL OR char_length(estimated_turnaround) <= 60),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX listing_addon_options_listing_idx ON listing_addon_options (listing_id);
CREATE INDEX listing_addon_options_active_idx ON listing_addon_options (listing_id, kind) WHERE active;

CREATE TRIGGER listing_addon_options_set_updated_at
  BEFORE UPDATE ON listing_addon_options
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE listing_addon_options ENABLE ROW LEVEL SECURITY;

-- Public can see active add-ons on any listing they could otherwise see (visibility
-- mirrors the listing's own visibility rules — not blocked/banned seller, listing
-- not soft-deleted). Inactive rows and rows on non-visible listings stay hidden.
CREATE POLICY listing_addon_options_select_visible ON listing_addon_options
  FOR SELECT
  TO anon, authenticated
  USING (
    active
    AND EXISTS (
      SELECT 1 FROM listings l
      JOIN profiles p ON p.id = l.seller_id
      WHERE l.id = listing_addon_options.listing_id
        AND l.status IN ('active', 'sold')
        AND p.banned_at IS NULL
        AND p.shadow_banned = FALSE
    )
  );

CREATE POLICY listing_addon_options_select_own ON listing_addon_options
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_addon_options.listing_id AND l.seller_id = auth.uid())
  );

CREATE POLICY listing_addon_options_owner_write ON listing_addon_options
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_addon_options.listing_id AND l.seller_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_addon_options.listing_id AND l.seller_id = auth.uid())
  );
