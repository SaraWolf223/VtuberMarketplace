-- Seed supply program ($1/listing) payout tracking with anti-farming guardrails.
-- Seed sellers are tagged via the existing Founding Seller flag and comped Premium
-- (so their listings get the 2-month window). This table tracks which of their
-- genuine listings an admin has approved for the $1 payout, with a per-person cap.

CREATE TABLE IF NOT EXISTS seed_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL UNIQUE REFERENCES listings (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  amount_cents INT NOT NULL DEFAULT 100,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles (id),
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles (id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seed_payouts_seller_idx ON seed_payouts (seller_id);
CREATE INDEX IF NOT EXISTS seed_payouts_approved_idx ON seed_payouts (approved, paid);

ALTER TABLE seed_payouts ENABLE ROW LEVEL SECURITY;

-- Staff can read the payout ledger; all writes go through the service-role
-- admin-action edge function (which enforces the per-person cap and logs).
DROP POLICY IF EXISTS seed_payouts_select_staff ON seed_payouts;
CREATE POLICY seed_payouts_select_staff ON seed_payouts
  FOR SELECT TO authenticated
  USING (is_app_staff());
