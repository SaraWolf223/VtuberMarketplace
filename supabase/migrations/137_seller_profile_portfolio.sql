-- Seller profile socials, required portfolio URL, and showcase gallery.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT
    CHECK (website_url IS NULL OR website_url ~ '^https?://'),
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT
    CHECK (portfolio_url IS NULL OR portfolio_url ~ '^https?://'),
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN profiles.portfolio_url IS
  'Required https URL before a seller may publish listings. External portfolio/home page.';
COMMENT ON COLUMN profiles.social_links IS
  'Optional map of social URLs: twitter, youtube, twitch, discord, booth, other.';

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
  shop_banner_url,
  shop_accent_color,
  website_url,
  portfolio_url,
  social_links,
  created_at,
  (role = 'admin') AS is_admin
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;

CREATE TABLE seller_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  image_storage_path TEXT NOT NULL,
  caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
  sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order < 6),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, sort_order)
);

CREATE INDEX seller_portfolio_items_seller_idx ON seller_portfolio_items (seller_id);

CREATE TRIGGER seller_portfolio_items_set_updated_at
  BEFORE UPDATE ON seller_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE seller_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_portfolio_items_select_public ON seller_portfolio_items
  FOR SELECT TO anon, authenticated
  USING (
    active
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = seller_portfolio_items.seller_id
        AND p.banned_at IS NULL AND p.shadow_banned = FALSE
    )
  );

CREATE POLICY seller_portfolio_items_owner_all ON seller_portfolio_items
  FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Cap at 6 active showcase images per seller.
CREATE OR REPLACE FUNCTION seller_portfolio_items_enforce_max()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.active THEN
    SELECT COUNT(*)::INT INTO v_count
    FROM seller_portfolio_items
    WHERE seller_id = NEW.seller_id AND active AND id IS DISTINCT FROM NEW.id;
    IF v_count >= 6 THEN
      RAISE EXCEPTION 'PORTFOLIO_MAX_ITEMS';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seller_portfolio_items_max_check
  BEFORE INSERT OR UPDATE ON seller_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION seller_portfolio_items_enforce_max();

-- Storage bucket for portfolio showcase images (public read; owner write via edge/RPC path).
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-portfolio', 'seller-portfolio', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS seller_portfolio_storage_public_read ON storage.objects;
CREATE POLICY seller_portfolio_storage_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'seller-portfolio');

-- Direct client writes blocked; uploads go through upload-portfolio-image edge function.
DROP POLICY IF EXISTS seller_portfolio_storage_no_direct_insert ON storage.objects;
CREATE POLICY seller_portfolio_storage_no_direct_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

-- Strengthen publish_listing: require portfolio_url on seller profile.
CREATE OR REPLACE FUNCTION publish_listing(p_listing_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row listings%ROWTYPE;
  v_portfolio TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM listings WHERE id = p_listing_id AND seller_id = v_uid;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_row.status NOT IN ('draft', 'paused_pending_review') THEN
    RETURN json_build_object('error', 'NOT_DRAFT');
  END IF;

  SELECT portfolio_url INTO v_portfolio FROM profiles WHERE id = v_uid;
  IF v_portfolio IS NULL OR v_portfolio !~ '^https?://' THEN
    RETURN json_build_object('error', 'PORTFOLIO_URL_REQUIRED');
  END IF;

  IF v_row.image_count < 3 THEN
    RETURN json_build_object('error', 'NEED_MORE_PHOTOS', 'min', 3);
  END IF;

  IF v_row.youtube_video_id IS NULL OR v_row.youtube_video_status <> 'valid' THEN
    RETURN json_build_object('error', 'YOUTUBE_VIDEO_REQUIRED');
  END IF;

  IF v_row.download_url IS NULL OR v_row.download_url !~ '^https?://' THEN
    RETURN json_build_object('error', 'DOWNLOAD_URL_REQUIRED');
  END IF;

  IF char_length(trim(v_row.license_text)) < 1 THEN
    RETURN json_build_object('error', 'LICENSE_TEXT_REQUIRED');
  END IF;

  -- feed_thumbnail_path may not exist yet until migration 140; guarded dynamically below
  -- if the column is present (140 runs after this). Re-asserted in 140.

  UPDATE listings
  SET status = 'active', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN json_build_object('ok', TRUE, 'id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION publish_listing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_listing(UUID) TO authenticated;
