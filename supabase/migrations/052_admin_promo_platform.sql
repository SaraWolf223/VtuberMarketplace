-- Admin panel: promo codes, platform boost settings, admin RLS

ALTER TYPE boost_source ADD VALUE IF NOT EXISTS 'promo';

CREATE TYPE promo_code_type AS ENUM ('free_boosts', 'free_premium_month');

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  type promo_code_type NOT NULL,
  value INT NOT NULL DEFAULT 1 CHECK (value > 0),
  max_redemptions INT CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count INT NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_codes_code_format CHECK (code ~ '^[A-Z0-9_-]{4,32}$')
);

CREATE UNIQUE INDEX promo_codes_code_lower_idx ON promo_codes (LOWER(code));

CREATE TABLE promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  boosts_remaining INT CHECK (boosts_remaining IS NULL OR boosts_remaining >= 0),
  premium_until TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, user_id)
);

CREATE INDEX promo_redemptions_user_idx ON promo_redemptions (user_id, redeemed_at DESC);

INSERT INTO platform_settings (key, value) VALUES
  ('boost_duration_hours', '24'::jsonb),
  ('boost_base_cents', '100'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_admin_select ON platform_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_codes_admin_select ON promo_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_redemptions_own_select ON promo_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY promo_redemptions_admin_select ON promo_redemptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE TRIGGER promo_codes_set_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Promo boost balance for current user (used by boost checkout UI)
CREATE OR REPLACE FUNCTION get_my_promo_boost_balance()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(r.boosts_remaining), 0)::int
  FROM promo_redemptions r
  WHERE r.user_id = auth.uid()
    AND r.boosts_remaining IS NOT NULL
    AND r.boosts_remaining > 0;
$$;

REVOKE ALL ON FUNCTION get_my_promo_boost_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_promo_boost_balance() TO authenticated;
