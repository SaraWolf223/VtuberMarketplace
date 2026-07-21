-- VtuberMarketplace domain conversion: seller Stripe Connect + Pro Seller fields on
-- profiles; drop the old Premium fields (replaced by is_pro_seller/pro_seller_until)
-- and all geo columns (no ZIP/radius discovery in this domain).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS connect_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS connect_details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_pro_seller BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pro_seller_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shop_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS shop_accent_color TEXT
    CHECK (shop_accent_color IS NULL OR shop_accent_color ~ '^#[0-9a-fA-F]{6}$');

-- Old Premium fields — replaced by is_pro_seller/pro_seller_until above.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS is_premium,
  DROP COLUMN IF EXISTS premium_until,
  DROP COLUMN IF EXISTS premium_source;

-- --- Drop geo columns (no ZIP/radius discovery in this domain) --------------------
DROP INDEX IF EXISTS user_prefs_location_idx;

ALTER TABLE user_prefs
  DROP COLUMN IF EXISTS home_zip,
  DROP COLUMN IF EXISTS home_location,
  DROP COLUMN IF EXISTS radius_miles;

ALTER TABLE user_prefs
  RENAME COLUMN notify_expiry TO notify_link_issues;

ALTER TABLE user_prefs
  RENAME COLUMN notify_boost_deals TO notify_order_updates;

-- profiles_public view: swap college-badge/premium/founding-seller columns for the
-- new Connect/Pro-Seller ones (safe to expose to buyers as trust signals).
DROP VIEW IF EXISTS profiles_public;

CREATE VIEW profiles_public AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  rating_avg,
  rating_count,
  listing_count,
  is_pro_seller,
  connect_charges_enabled,
  connect_payouts_enabled,
  created_at,
  (role = 'admin') AS is_admin
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;

-- protect_profile_trusted_fields_on_self_update() referenced now-dropped columns
-- (is_premium/premium_until/is_founding_seller/founding_seller_at/college_*); redefine
-- to guard the new trust-sensitive fields instead. Same guard shape/intent as before.
CREATE OR REPLACE FUNCTION protect_profile_trusted_fields_on_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce(auth.jwt()->>'role', '');
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF is_app_admin() AND auth.uid() IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      NEW.role := OLD.role;
    END IF;
    IF OLD.banned_at IS DISTINCT FROM NEW.banned_at THEN
      NEW.banned_at := OLD.banned_at;
    END IF;
    IF OLD.shadow_banned IS DISTINCT FROM NEW.shadow_banned THEN
      NEW.shadow_banned := OLD.shadow_banned;
    END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      NEW.phone := OLD.phone;
    END IF;
    IF OLD.phone_verified_at IS DISTINCT FROM NEW.phone_verified_at THEN
      NEW.phone_verified_at := OLD.phone_verified_at;
    END IF;
    IF OLD.stripe_connect_account_id IS DISTINCT FROM NEW.stripe_connect_account_id THEN
      NEW.stripe_connect_account_id := OLD.stripe_connect_account_id;
    END IF;
    IF OLD.connect_charges_enabled IS DISTINCT FROM NEW.connect_charges_enabled THEN
      NEW.connect_charges_enabled := OLD.connect_charges_enabled;
    END IF;
    IF OLD.connect_payouts_enabled IS DISTINCT FROM NEW.connect_payouts_enabled THEN
      NEW.connect_payouts_enabled := OLD.connect_payouts_enabled;
    END IF;
    IF OLD.connect_details_submitted IS DISTINCT FROM NEW.connect_details_submitted THEN
      NEW.connect_details_submitted := OLD.connect_details_submitted;
    END IF;
    IF OLD.is_pro_seller IS DISTINCT FROM NEW.is_pro_seller THEN
      NEW.is_pro_seller := OLD.is_pro_seller;
    END IF;
    IF OLD.pro_seller_until IS DISTINCT FROM NEW.pro_seller_until THEN
      NEW.pro_seller_until := OLD.pro_seller_until;
    END IF;
    IF OLD.rating_avg IS DISTINCT FROM NEW.rating_avg THEN
      NEW.rating_avg := OLD.rating_avg;
    END IF;
    IF OLD.rating_count IS DISTINCT FROM NEW.rating_count THEN
      NEW.rating_count := OLD.rating_count;
    END IF;
    IF OLD.listing_count IS DISTINCT FROM NEW.listing_count THEN
      NEW.listing_count := OLD.listing_count;
    END IF;
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      NEW.stripe_customer_id := OLD.stripe_customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
