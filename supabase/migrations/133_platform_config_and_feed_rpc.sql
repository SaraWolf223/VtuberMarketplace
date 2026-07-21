-- VtuberMarketplace: reseed public_app_config for the new domain (fee tiers,
-- Featured placement, grace period, strike settings; drop radius keys), and replace
-- the geo-based get_feed_listings/get_listing_detail/location-setup RPCs with
-- filter-based equivalents that have no geo dependency.

DELETE FROM public_app_config WHERE key IN ('feed_radius_options', 'max_radius_miles');

INSERT INTO public_app_config (key, value) VALUES
  ('app_display_name', '"VtuberMarketplace"'),
  ('platform_fee_bps_free', '1000'),
  ('platform_fee_bps_pro', '800'),
  ('featured_placement_duration_days', '7'),
  ('featured_placement_price_cents', '500'),
  ('link_health_grace_period_hours', '48'),
  ('strike_expiry_months', '12'),
  ('strike_ban_threshold', '3')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Drop geo-dependent functions that no longer have a home in this domain.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('current_max_radius_miles', 'upsert_user_prefs_location', 'get_feed_listings', 'get_listing_detail')
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

-- Lightweight replacement for the profile/prefs half of upsert_user_prefs_location —
-- no ZIP/geo step in this domain, just ensures a profile + user_prefs row exists after
-- first sign-in (any provider).
CREATE OR REPLACE FUNCTION ensure_profile_and_prefs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_provider text;
  v_name text;
  v_avatar text;
  v_username text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, raw_user_meta_data, raw_app_meta_data->>'provider'
  INTO v_email, v_meta, v_provider
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Account email missing';
  END IF;

  v_name := COALESCE(v_meta->>'full_name', v_meta->>'name', split_part(v_email, '@', 1), 'User');
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');
  v_username := 'user_' || substr(replace(v_uid::text, '-', ''), 1, 12);

  INSERT INTO profiles (id, email, username, display_name, avatar_url, auth_provider, last_active_at, updated_at)
  VALUES (v_uid, v_email, v_username, v_name, v_avatar, COALESCE(v_provider, 'email'), NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    last_active_at = NOW(),
    updated_at = NOW();

  INSERT INTO user_prefs (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION ensure_profile_and_prefs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_profile_and_prefs() TO authenticated;

-- --- Global, filter-based feed (no geo) ----------------------------------------------
CREATE OR REPLACE FUNCTION get_feed_listings(
  p_category text DEFAULT NULL,
  p_asset_type asset_type DEFAULT NULL,
  p_license_type license_type DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_compatible_software text DEFAULT NULL,
  p_has_customization boolean DEFAULT NULL,
  p_has_setup boolean DEFAULT NULL,
  p_support_duration support_duration_type DEFAULT NULL,
  p_is_mature boolean DEFAULT FALSE,
  p_status listing_status DEFAULT 'active',
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items json;
  v_next_cursor text;
  v_limit int;
  v_cursor_rank int;
  v_cursor_sort double precision;
  v_cursor_id uuid;
  v_search text;
  v_feed_count int;
BEGIN
  IF p_sort NOT IN ('newest', 'price_low', 'price_high', 'featured') THEN
    RAISE EXCEPTION 'Invalid p_sort';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_search := NULLIF(trim(p_search), '');

  IF p_cursor IS NOT NULL AND length(p_cursor) > 0 THEN
    BEGIN
      v_cursor_rank := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'b')::int;
      v_cursor_sort := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'s')::double precision;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'utf8')::json->>'i')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_cursor_rank := NULL;
      v_cursor_sort := NULL;
      v_cursor_id := NULL;
    END;
  END IF;

  WITH feed AS (
    SELECT
      l.id, l.title, l.price, l.category, l.asset_type, l.license_type, l.status,
      l.featured_until, l.published_at, l.image_count, l.seller_id, l.is_mature,
      (l.featured_until IS NOT NULL AND l.featured_until > NOW()) AS featured,
      EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'customization' AND a.active) AS has_customization,
      EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'setup' AND a.active) AS has_setup,
      COALESCE(p.is_pro_seller, FALSE) AS seller_is_pro_seller,
      (p.role = 'admin') AS seller_is_admin,
      CASE WHEN l.featured_until > NOW() THEN 0 ELSE 1 END AS feed_rank,
      CASE
        WHEN p_sort = 'price_low' THEN l.price::double precision
        WHEN p_sort = 'price_high' THEN -l.price::double precision
        WHEN p_sort = 'featured' THEN -EXTRACT(EPOCH FROM COALESCE(l.featured_until, l.published_at))
        ELSE -EXTRACT(EPOCH FROM l.published_at)
      END AS sort_value,
      p.display_name AS seller_display_name,
      p.username AS seller_username,
      p.avatar_url AS seller_avatar_url,
      (
        SELECT li.storage_path FROM listing_images li
        WHERE li.listing_id = l.id ORDER BY li.sort_order LIMIT 1
      ) AS thumb_path
    FROM listings l
    INNER JOIN profiles p ON p.id = l.seller_id
    WHERE l.status = COALESCE(p_status, 'active'::listing_status)
      AND (p_category IS NULL OR l.category = p_category)
      AND (p_asset_type IS NULL OR l.asset_type = p_asset_type)
      AND (p_license_type IS NULL OR l.license_type = p_license_type)
      AND (p_min_price IS NULL OR l.price >= p_min_price)
      AND (p_max_price IS NULL OR l.price <= p_max_price)
      AND (p_compatible_software IS NULL OR l.compatible_software @> ARRAY[p_compatible_software])
      AND (p_support_duration IS NULL OR l.support_duration = p_support_duration)
      AND (COALESCE(p_is_mature, FALSE) OR NOT l.is_mature)
      AND (
        p_has_customization IS NULL OR p_has_customization = FALSE OR
        EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'customization' AND a.active)
      )
      AND (
        p_has_setup IS NULL OR p_has_setup = FALSE OR
        EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'setup' AND a.active)
      )
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
      AND (
        auth.uid() IS NULL
        OR l.seller_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid())
      )
      AND (v_search IS NULL OR l.search_vector @@ plainto_tsquery('english', v_search))
      AND (
        v_cursor_id IS NULL
        OR (
          CASE WHEN l.featured_until > NOW() THEN 0 ELSE 1 END,
          CASE
            WHEN p_sort = 'price_low' THEN l.price::double precision
            WHEN p_sort = 'price_high' THEN -l.price::double precision
            WHEN p_sort = 'featured' THEN -EXTRACT(EPOCH FROM COALESCE(l.featured_until, l.published_at))
            ELSE -EXTRACT(EPOCH FROM l.published_at)
          END,
          l.id
        ) > (v_cursor_rank, v_cursor_sort, v_cursor_id)
      )
    ORDER BY feed_rank, sort_value, l.id
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE((
      SELECT json_agg(row_to_json(page_row))
      FROM (
        SELECT id, title, price, category, asset_type, license_type, status, featured,
               published_at, image_count, seller_id, is_mature, has_customization, has_setup,
               seller_display_name, seller_username, seller_avatar_url, seller_is_pro_seller,
               seller_is_admin, thumb_path
        FROM feed
        LIMIT v_limit
      ) page_row
    ), '[]'::json),
    (SELECT COUNT(*)::int FROM feed),
    (
      SELECT encode(convert_to(json_build_object('b', feed_rank, 's', sort_value, 'i', id)::text, 'utf8'), 'base64')
      FROM feed
      ORDER BY feed_rank, sort_value, id
      OFFSET v_limit
      LIMIT 1
    )
  INTO v_items, v_feed_count, v_next_cursor;

  RETURN json_build_object(
    'items', v_items,
    'next_cursor', CASE WHEN v_feed_count > v_limit THEN v_next_cursor ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION get_feed_listings FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_feed_listings TO authenticated, anon;

-- --- Listing detail (no geo/distance, adds addons + youtube + license) --------------
CREATE OR REPLACE FUNCTION get_listing_detail(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing listings%ROWTYPE;
  v_seller record;
  v_images json;
  v_addons json;
  v_favorited boolean := FALSE;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF (v_uid IS NULL OR v_listing.seller_id <> v_uid) AND v_listing.status NOT IN ('active', 'sold') THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_uid IS NOT NULL AND v_listing.seller_id <> v_uid AND EXISTS (
    SELECT 1 FROM blocks WHERE blocker_id = v_uid AND blocked_id = v_listing.seller_id
  ) THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  SELECT id, username, display_name, avatar_url, rating_avg, rating_count, is_pro_seller,
         connect_charges_enabled, shop_banner_url, shop_accent_color
  INTO v_seller
  FROM profiles
  WHERE id = v_listing.seller_id AND banned_at IS NULL AND shadow_banned = FALSE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  SELECT COALESCE(json_agg(json_build_object('storage_path', li.storage_path, 'sort_order', li.sort_order) ORDER BY li.sort_order), '[]'::json)
  INTO v_images
  FROM listing_images li
  WHERE li.listing_id = p_listing_id;

  SELECT COALESCE(json_agg(json_build_object(
    'id', a.id, 'kind', a.kind, 'name', a.name, 'description', a.description,
    'extra_fee_cents', a.extra_fee_cents, 'estimated_turnaround', a.estimated_turnaround
  ) ORDER BY a.kind, a.created_at), '[]'::json)
  INTO v_addons
  FROM listing_addon_options a
  WHERE a.listing_id = p_listing_id AND a.active;

  IF v_uid IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = v_uid AND f.listing_id = p_listing_id) INTO v_favorited;
  END IF;

  RETURN json_build_object(
    'listing', json_build_object(
      'id', v_listing.id, 'title', v_listing.title, 'description', v_listing.description,
      'price', v_listing.price, 'category', v_listing.category, 'asset_type', v_listing.asset_type,
      'license_type', v_listing.license_type, 'license_text', v_listing.license_text,
      'status', v_listing.status, 'featured_until', v_listing.featured_until,
      'published_at', v_listing.published_at, 'seller_id', v_listing.seller_id,
      'is_own', v_uid IS NOT NULL AND v_listing.seller_id = v_uid,
      'download_url', CASE WHEN v_uid = v_listing.seller_id THEN v_listing.download_url ELSE NULL END,
      'youtube_video_id', v_listing.youtube_video_id,
      'youtube_video_status', v_listing.youtube_video_status,
      'is_mature', v_listing.is_mature, 'support_duration', v_listing.support_duration,
      'compatible_software', v_listing.compatible_software, 'file_formats', v_listing.file_formats,
      'includes_source_files', v_listing.includes_source_files, 'credits_text', v_listing.credits_text,
      'changelog', v_listing.changelog,
      'cubism_version', v_listing.cubism_version, 'has_physics', v_listing.has_physics,
      'expression_count', v_listing.expression_count, 'parameter_notes', v_listing.parameter_notes,
      'includes_psd_source', v_listing.includes_psd_source,
      'platform_compatibility', v_listing.platform_compatibility,
      'triangle_count_pc', v_listing.triangle_count_pc, 'triangle_count_quest', v_listing.triangle_count_quest,
      'performance_rank', v_listing.performance_rank, 'rig_type', v_listing.rig_type,
      'supports_full_body_tracking', v_listing.supports_full_body_tracking,
      'toggle_list', v_listing.toggle_list, 'required_tools', v_listing.required_tools,
      'compatible_base_avatar', v_listing.compatible_base_avatar,
      'included_states', v_listing.included_states, 'setup_instructions', v_listing.setup_instructions
    ),
    'seller', json_build_object(
      'id', v_seller.id, 'username', v_seller.username, 'display_name', v_seller.display_name,
      'avatar_url', v_seller.avatar_url, 'rating_avg', v_seller.rating_avg, 'rating_count', v_seller.rating_count,
      'is_pro_seller', v_seller.is_pro_seller, 'connect_charges_enabled', v_seller.connect_charges_enabled,
      'shop_banner_url', v_seller.shop_banner_url, 'shop_accent_color', v_seller.shop_accent_color
    ),
    'images', v_images,
    'addons', v_addons,
    'is_favorited', v_favorited
  );
END;
$$;

REVOKE ALL ON FUNCTION get_listing_detail FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_listing_detail TO authenticated, anon;

-- --- Seller dashboard summary ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_seller_dashboard_summary()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
  v_open_orders int;
  v_active_strikes int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT connect_charges_enabled, connect_payouts_enabled, connect_details_submitted,
         phone_verified_at, is_pro_seller, pro_seller_until
  INTO v_profile
  FROM profiles WHERE id = v_uid;

  SELECT COUNT(*)::int INTO v_open_orders FROM orders WHERE seller_id = v_uid AND status = 'awaiting_fulfillment';
  v_active_strikes := active_strike_count(v_uid);

  RETURN json_build_object(
    'connect_charges_enabled', v_profile.connect_charges_enabled,
    'connect_payouts_enabled', v_profile.connect_payouts_enabled,
    'connect_details_submitted', v_profile.connect_details_submitted,
    'phone_verified', v_profile.phone_verified_at IS NOT NULL,
    'can_publish', v_profile.connect_charges_enabled AND v_profile.connect_payouts_enabled AND v_profile.phone_verified_at IS NOT NULL,
    'is_pro_seller', v_profile.is_pro_seller,
    'pro_seller_until', v_profile.pro_seller_until,
    'open_orders_awaiting_fulfillment', v_open_orders,
    'active_strike_count', v_active_strikes
  );
END;
$$;

REVOKE ALL ON FUNCTION get_seller_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_seller_dashboard_summary() TO authenticated;
