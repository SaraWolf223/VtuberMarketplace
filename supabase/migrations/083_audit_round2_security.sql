-- Audit round 2: profile INSERT founding/terms guard, block listing_images DELETE, draft price cap.

-- ---------------------------------------------------------------------------
-- 1. Profile INSERT — also block self-granted founding seller + terms bypass
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_profile_trusted_fields_on_self_insert()
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

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
    NEW.role := 'user';
    NEW.is_premium := FALSE;
    NEW.premium_until := NULL;
    NEW.banned_at := NULL;
    NEW.shadow_banned := FALSE;
    NEW.phone_verified_at := NULL;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.listing_count := 0;
    NEW.stripe_customer_id := NULL;
    NEW.college_edu_email := NULL;
    NEW.college_badge_verified_at := NULL;
    NEW.college_badge_expires_at := NULL;
    NEW.is_founding_seller := FALSE;
    NEW.founding_seller_at := NULL;
    NEW.terms_accepted_at := NULL;
    NEW.terms_version := NULL;
    IF NEW.auth_provider IS NULL OR NEW.auth_provider = '' THEN
      NEW.auth_provider := 'google';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Block client DELETE on listing_images (finalize-listing-images / edge only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS listing_images_delete_own ON listing_images;
CREATE POLICY listing_images_no_direct_delete ON listing_images
  FOR DELETE TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 3. Defense in depth: price cap on draft insert RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_draft_listing(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category listing_category,
  p_zip_code text,
  p_lng double precision,
  p_lat double precision
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_price IS NULL OR p_price <= 0 OR p_price > 20 THEN
    RAISE EXCEPTION 'PRICE_TOO_HIGH';
  END IF;

  INSERT INTO listings (
    seller_id,
    title,
    description,
    price,
    category,
    zip_code,
    location,
    status,
    image_count
  )
  VALUES (
    p_seller_id,
    p_title,
    p_description,
    p_price,
    p_category,
    p_zip_code,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    'draft',
    0
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
