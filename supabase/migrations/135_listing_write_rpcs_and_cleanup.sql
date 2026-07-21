-- VtuberMarketplace: fix every remaining function that still referenced dropped
-- physical-marketplace columns (zip_code/location/expires_at/is_premium/college_*/
-- founding_seller), and rewrite the listing write path (insert_draft_listing/
-- update_listing) for the new digital-asset field set. `listings_no_direct_insert`
-- (migration 075) and `listings_protect_seller_direct_update` (migration 075) still
-- block raw client INSERT/UPDATE on `listings` — all writes go through these RPCs or
-- service-role edge functions, unchanged security model from the prior build.

-- --- Notification kinds for orders/strikes/pro-seller --------------------------------
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'order_paid';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'order_fulfilled';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'order_refunded';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'link_issue_warning';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'seller_strike_issued';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'pro_seller_activated';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'pro_seller_expiring';

-- --- 1. insert_draft_listing / update_listing: drop old geo-based overloads ----------
DROP FUNCTION IF EXISTS public.insert_draft_listing(uuid, text, text, numeric, text, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.update_listing(uuid, text, text, numeric, text, text, double precision, double precision);

CREATE OR REPLACE FUNCTION insert_draft_listing(
  p_seller_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_category TEXT,
  p_asset_type asset_type,
  p_license_type license_type,
  p_license_text TEXT,
  p_download_url TEXT,
  p_is_mature BOOLEAN DEFAULT FALSE,
  p_support_duration support_duration_type DEFAULT 'none',
  p_compatible_software TEXT[] DEFAULT '{}',
  p_file_formats TEXT[] DEFAULT '{}',
  p_includes_source_files BOOLEAN DEFAULT FALSE,
  p_credits_text TEXT DEFAULT NULL,
  p_asset_fields JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'NOT_OWNER';
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM listing_categories WHERE slug = p_category AND is_active) THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
  END IF;

  INSERT INTO listings (
    seller_id, title, description, price, category, asset_type, license_type,
    license_text, download_url, is_mature, support_duration, compatible_software,
    file_formats, includes_source_files, credits_text,
    cubism_version, has_physics, expression_count, parameter_notes, includes_psd_source,
    platform_compatibility, triangle_count_pc, triangle_count_quest, performance_rank,
    rig_type, supports_full_body_tracking, toggle_list, required_tools, compatible_base_avatar,
    included_states, setup_instructions,
    status, image_count
  )
  VALUES (
    p_seller_id, p_title, NULLIF(trim(p_description), ''), p_price, p_category, p_asset_type,
    p_license_type, COALESCE(p_license_text, ''), p_download_url, p_is_mature, p_support_duration,
    p_compatible_software, p_file_formats, p_includes_source_files, p_credits_text,
    p_asset_fields->>'cubism_version',
    (p_asset_fields->>'has_physics')::BOOLEAN,
    (p_asset_fields->>'expression_count')::INT,
    p_asset_fields->>'parameter_notes',
    (p_asset_fields->>'includes_psd_source')::BOOLEAN,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_asset_fields->'platform_compatibility', '[]'::jsonb)) x), '{}'),
    (p_asset_fields->>'triangle_count_pc')::INT,
    (p_asset_fields->>'triangle_count_quest')::INT,
    (p_asset_fields->>'performance_rank')::performance_rank_type,
    p_asset_fields->>'rig_type',
    (p_asset_fields->>'supports_full_body_tracking')::BOOLEAN,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_asset_fields->'toggle_list', '[]'::jsonb)) x), '{}'),
    p_asset_fields->>'required_tools',
    p_asset_fields->>'compatible_base_avatar',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_asset_fields->'included_states', '[]'::jsonb)) x), '{}'),
    p_asset_fields->>'setup_instructions',
    'draft', 0
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION insert_draft_listing FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_draft_listing TO authenticated;

CREATE OR REPLACE FUNCTION update_listing(
  p_listing_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_category TEXT,
  p_license_text TEXT,
  p_download_url TEXT,
  p_is_mature BOOLEAN DEFAULT FALSE,
  p_support_duration support_duration_type DEFAULT 'none',
  p_compatible_software TEXT[] DEFAULT '{}',
  p_file_formats TEXT[] DEFAULT '{}',
  p_includes_source_files BOOLEAN DEFAULT FALSE,
  p_credits_text TEXT DEFAULT NULL,
  p_asset_fields JSONB DEFAULT '{}'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row listings%ROWTYPE;
  v_banned TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM listings WHERE id = p_listing_id AND seller_id = v_uid;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_row.status NOT IN ('active', 'draft', 'paused_pending_review') THEN
    RETURN json_build_object('error', 'NOT_EDITABLE');
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM listing_categories WHERE slug = p_category AND is_active) THEN
    RETURN json_build_object('error', 'INVALID_CATEGORY');
  END IF;

  IF char_length(p_title) < 1 OR char_length(p_title) > 80 THEN
    RAISE EXCEPTION 'Invalid title length';
  END IF;

  IF p_description IS NOT NULL AND char_length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description too long';
  END IF;

  IF p_license_text IS NULL OR char_length(trim(p_license_text)) < 1 THEN
    RETURN json_build_object('error', 'LICENSE_TEXT_REQUIRED');
  END IF;

  v_banned := find_banned_keyword_in_text(
    trim(p_title) || ' ' || COALESCE(trim(p_description), '')
  );
  IF v_banned IS NOT NULL THEN
    RETURN json_build_object('error', 'BANNED_KEYWORD', 'keyword', v_banned);
  END IF;

  UPDATE listings
  SET
    title = p_title,
    description = NULLIF(trim(p_description), ''),
    price = p_price,
    category = p_category,
    license_text = p_license_text,
    download_url = p_download_url,
    is_mature = COALESCE(p_is_mature, FALSE),
    support_duration = COALESCE(p_support_duration, 'none'),
    compatible_software = COALESCE(p_compatible_software, '{}'),
    file_formats = COALESCE(p_file_formats, '{}'),
    includes_source_files = COALESCE(p_includes_source_files, FALSE),
    credits_text = p_credits_text,
    cubism_version = COALESCE(p_asset_fields->>'cubism_version', cubism_version),
    has_physics = COALESCE((p_asset_fields->>'has_physics')::BOOLEAN, has_physics),
    expression_count = COALESCE((p_asset_fields->>'expression_count')::INT, expression_count),
    parameter_notes = COALESCE(p_asset_fields->>'parameter_notes', parameter_notes),
    includes_psd_source = COALESCE((p_asset_fields->>'includes_psd_source')::BOOLEAN, includes_psd_source),
    platform_compatibility = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_asset_fields->'platform_compatibility') x),
      platform_compatibility
    ),
    triangle_count_pc = COALESCE((p_asset_fields->>'triangle_count_pc')::INT, triangle_count_pc),
    triangle_count_quest = COALESCE((p_asset_fields->>'triangle_count_quest')::INT, triangle_count_quest),
    performance_rank = COALESCE((p_asset_fields->>'performance_rank')::performance_rank_type, performance_rank),
    rig_type = COALESCE(p_asset_fields->>'rig_type', rig_type),
    supports_full_body_tracking = COALESCE((p_asset_fields->>'supports_full_body_tracking')::BOOLEAN, supports_full_body_tracking),
    toggle_list = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_asset_fields->'toggle_list') x),
      toggle_list
    ),
    required_tools = COALESCE(p_asset_fields->>'required_tools', required_tools),
    compatible_base_avatar = COALESCE(p_asset_fields->>'compatible_base_avatar', compatible_base_avatar),
    included_states = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_asset_fields->'included_states') x),
      included_states
    ),
    setup_instructions = COALESCE(p_asset_fields->>'setup_instructions', setup_instructions),
    updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN json_build_object('id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION update_listing FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_listing TO authenticated;

-- --- 2. Publish-time gate: image count + YouTube + license, then flip to active -----
CREATE OR REPLACE FUNCTION publish_listing(p_listing_id UUID)
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

  IF v_row.status NOT IN ('draft', 'paused_pending_review') THEN
    RETURN json_build_object('error', 'NOT_DRAFT');
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

  UPDATE listings
  SET status = 'active', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN json_build_object('ok', TRUE, 'id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION publish_listing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_listing(UUID) TO authenticated;

-- --- 3. Profile INSERT guard: drop dead columns, add new trust-sensitive ones --------
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
    NEW.banned_at := NULL;
    NEW.shadow_banned := FALSE;
    NEW.phone_verified_at := NULL;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.listing_count := 0;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_connect_account_id := NULL;
    NEW.connect_charges_enabled := FALSE;
    NEW.connect_payouts_enabled := FALSE;
    NEW.connect_details_submitted := FALSE;
    NEW.is_pro_seller := FALSE;
    NEW.pro_seller_until := NULL;
    NEW.terms_accepted_at := NULL;
    NEW.terms_version := NULL;
    IF NEW.auth_provider IS NULL OR NEW.auth_provider = '' THEN
      NEW.auth_provider := 'email';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- --- 4. Staff-visible profile: swap is_premium for is_pro_seller --------------------
CREATE OR REPLACE FUNCTION get_staff_visible_profile(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, username, display_name, avatar_url, rating_avg, rating_count, listing_count,
         is_pro_seller, created_at
  INTO v_row
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'display_name', v_row.display_name,
    'avatar_url', v_row.avatar_url,
    'rating_avg', v_row.rating_avg,
    'rating_count', v_row.rating_count,
    'listing_count', v_row.listing_count,
    'is_pro_seller', v_row.is_pro_seller,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION get_staff_visible_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_staff_visible_profile(uuid) TO authenticated;

-- --- 5. College-student directory: feature removed entirely -------------------------
DROP FUNCTION IF EXISTS list_college_students() CASCADE;

-- --- 6. Seller-profile listings card: expires_at -> published_at, boosted->featured -
CREATE OR REPLACE FUNCTION get_seller_profile_listings(p_seller_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE blocker_id = v_uid AND blocked_id = p_seller_id
  ) THEN
    RETURN '[]'::json;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_seller_id
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
  ) THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', s.id,
        'title', s.title,
        'price', s.price,
        'category', s.category,
        'asset_type', s.asset_type,
        'status', s.status,
        'published_at', s.published_at,
        'featured_until', s.featured_until,
        'thumb_path', s.thumb_path
      )
      ORDER BY s.status_rank, s.published_at DESC
    ),
    '[]'::json
  )
  INTO v_rows
  FROM (
    SELECT
      l.id, l.title, l.price::float8 AS price, l.category::text AS category,
      l.asset_type,
      CASE WHEN l.status = 'paused_pending_review' THEN 'active' ELSE l.status::text END AS status,
      l.published_at,
      l.featured_until,
      CASE WHEN l.status IN ('active', 'paused_pending_review') THEN 0 ELSE 1 END AS status_rank,
      (
        SELECT COALESCE(li.thumb_path, li.storage_path)
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.sort_order
        LIMIT 1
      ) AS thumb_path
    FROM listings l
    WHERE l.seller_id = p_seller_id
      AND l.status IN ('active', 'sold', 'paused_pending_review')
  ) s;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION get_seller_profile_listings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_seller_profile_listings(uuid) TO authenticated;

-- --- 7. Retire fixed-expiry cron + its notification (no expiry in this domain) ------
DROP FUNCTION IF EXISTS expire_due_listings() CASCADE;
DROP FUNCTION IF EXISTS notify_listings_expiring_soon() CASCADE;

-- --- 8. Orphaned notification trigger function (table dropped via CASCADE already) --
DROP FUNCTION IF EXISTS notify_on_contact_agreement_change() CASCADE;
