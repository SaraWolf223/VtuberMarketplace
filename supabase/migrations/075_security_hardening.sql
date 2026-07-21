-- Security hardening: protect trusted profile/listing fields, RPC-only writes for reviews/listings insert.

-- ---------------------------------------------------------------------------
-- 1. Profile: block self-service writes to monetization / trust fields
-- ---------------------------------------------------------------------------
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
    IF OLD.is_premium IS DISTINCT FROM NEW.is_premium THEN
      NEW.is_premium := OLD.is_premium;
    END IF;
    IF OLD.premium_until IS DISTINCT FROM NEW.premium_until THEN
      NEW.premium_until := OLD.premium_until;
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
    IF OLD.college_edu_email IS DISTINCT FROM NEW.college_edu_email THEN
      NEW.college_edu_email := OLD.college_edu_email;
    END IF;
    IF OLD.college_badge_verified_at IS DISTINCT FROM NEW.college_badge_verified_at THEN
      NEW.college_badge_verified_at := OLD.college_badge_verified_at;
    END IF;
    IF OLD.college_badge_expires_at IS DISTINCT FROM NEW.college_badge_expires_at THEN
      NEW.college_badge_expires_at := OLD.college_badge_expires_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_moderation_fields ON profiles;
DROP TRIGGER IF EXISTS profiles_protect_role ON profiles;
DROP TRIGGER IF EXISTS profiles_protect_trusted_fields ON profiles;
CREATE TRIGGER profiles_protect_trusted_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_trusted_fields_on_self_update();

-- ---------------------------------------------------------------------------
-- 2. Listings: no direct INSERT; seller UPDATE only via SECURITY DEFINER RPCs / edge
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS listings_insert_own ON listings;
CREATE POLICY listings_no_direct_insert ON listings
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

CREATE OR REPLACE FUNCTION protect_listing_fields_on_seller_update()
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
  IF is_app_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.seller_id THEN
    RAISE EXCEPTION 'Listing changes must use server functions (edit, mark sold, boost, delete)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_protect_seller_direct_update ON listings;
CREATE TRIGGER listings_protect_seller_direct_update
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION protect_listing_fields_on_seller_update();

CREATE OR REPLACE FUNCTION seller_mark_listing_sold(p_listing_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row listings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM listings WHERE id = p_listing_id AND seller_id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_row.status NOT IN ('active', 'paused_pending_review') THEN
    RETURN json_build_object('error', 'NOT_ACTIVE');
  END IF;

  UPDATE listings
  SET
    status = 'sold',
    sold_at = COALESCE(sold_at, NOW()),
    updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN json_build_object('ok', true, 'id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION seller_mark_listing_sold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seller_mark_listing_sold(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reviews: RPC-only insert (create_review)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reviews_insert_own ON reviews;
CREATE POLICY reviews_no_direct_insert ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

-- ---------------------------------------------------------------------------
-- 4. Banned keyword oracle: internal to definer RPCs only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION find_banned_keyword_in_text(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION find_banned_keyword_in_text(TEXT) FROM PUBLIC;
