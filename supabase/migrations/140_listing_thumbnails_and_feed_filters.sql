-- Dedicated feed thumbnail + date/rating feed filters; effective sale price in feed.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS feed_thumbnail_path TEXT;

COMMENT ON COLUMN listings.feed_thumbnail_path IS
  'Dedicated feed-card thumbnail in listing-images bucket; required to publish (separate from gallery photos).';

-- Drop prior get_feed_listings overloads so the new signature is unambiguous.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'get_feed_listings'
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

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
  p_limit int DEFAULT 20,
  p_published_after timestamptz DEFAULT NULL,
  p_published_before timestamptz DEFAULT NULL,
  p_min_seller_rating numeric DEFAULT NULL
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

  WITH priced AS (
    SELECT
      l.*,
      (listing_effective_price_cents(l.id)::numeric / 100.0) AS effective_price
    FROM listings l
  ),
  feed AS (
    SELECT
      l.id, l.title, l.price, l.effective_price, l.category, l.asset_type, l.license_type, l.status,
      l.featured_until, l.published_at, l.image_count, l.seller_id, l.is_mature,
      (l.featured_until IS NOT NULL AND l.featured_until > NOW()) AS featured,
      (l.effective_price < l.price) AS on_sale,
      EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'customization' AND a.active) AS has_customization,
      EXISTS (SELECT 1 FROM listing_addon_options a WHERE a.listing_id = l.id AND a.kind = 'setup' AND a.active) AS has_setup,
      EXISTS (SELECT 1 FROM listing_support_plans sp WHERE sp.listing_id = l.id AND sp.active) AS has_support_plan,
      COALESCE(p.is_pro_seller, FALSE) AS seller_is_pro_seller,
      p.rating_avg AS seller_rating_avg,
      p.rating_count AS seller_rating_count,
      (p.role = 'admin') AS seller_is_admin,
      CASE WHEN l.featured_until > NOW() THEN 0 ELSE 1 END AS feed_rank,
      CASE
        WHEN p_sort = 'price_low' THEN l.effective_price::double precision
        WHEN p_sort = 'price_high' THEN -l.effective_price::double precision
        WHEN p_sort = 'featured' THEN -EXTRACT(EPOCH FROM COALESCE(l.featured_until, l.published_at))
        ELSE -EXTRACT(EPOCH FROM l.published_at)
      END AS sort_value,
      p.display_name AS seller_display_name,
      p.username AS seller_username,
      p.avatar_url AS seller_avatar_url,
      COALESCE(
        l.feed_thumbnail_path,
        (
          SELECT li.storage_path FROM listing_images li
          WHERE li.listing_id = l.id ORDER BY li.sort_order LIMIT 1
        )
      ) AS thumb_path
    FROM priced l
    INNER JOIN profiles p ON p.id = l.seller_id
    WHERE l.status = COALESCE(p_status, 'active'::listing_status)
      AND (p_category IS NULL OR l.category = p_category)
      AND (p_asset_type IS NULL OR l.asset_type = p_asset_type)
      AND (p_license_type IS NULL OR l.license_type = p_license_type)
      AND (p_min_price IS NULL OR l.effective_price >= p_min_price)
      AND (p_max_price IS NULL OR l.effective_price <= p_max_price)
      AND (p_compatible_software IS NULL OR l.compatible_software @> ARRAY[p_compatible_software])
      AND (p_support_duration IS NULL OR l.support_duration = p_support_duration)
      AND (COALESCE(p_is_mature, FALSE) OR NOT l.is_mature)
      AND (p_published_after IS NULL OR l.published_at >= p_published_after)
      AND (p_published_before IS NULL OR l.published_at <= p_published_before)
      AND (p_min_seller_rating IS NULL OR p.rating_avg >= p_min_seller_rating)
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
            WHEN p_sort = 'price_low' THEN l.effective_price::double precision
            WHEN p_sort = 'price_high' THEN -l.effective_price::double precision
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
        SELECT id, title, price, effective_price, on_sale, category, asset_type, license_type, status, featured,
               published_at, image_count, seller_id, is_mature, has_customization, has_setup, has_support_plan,
               seller_display_name, seller_username, seller_avatar_url, seller_is_pro_seller,
               seller_rating_avg, seller_rating_count, seller_is_admin, thumb_path
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

-- Publish requires dedicated feed thumbnail + portfolio URL (from 137).
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

  IF v_row.feed_thumbnail_path IS NULL OR btrim(v_row.feed_thumbnail_path) = '' THEN
    RETURN json_build_object('error', 'FEED_THUMBNAIL_REQUIRED');
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

CREATE OR REPLACE FUNCTION set_listing_feed_thumbnail(
  p_listing_id UUID,
  p_storage_path TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_path TEXT := btrim(p_storage_path);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_path IS NULL OR v_path = '' THEN
    RETURN json_build_object('error', 'INVALID_PATH');
  END IF;

  UPDATE listings
  SET feed_thumbnail_path = v_path, updated_at = NOW()
  WHERE id = p_listing_id AND seller_id = v_uid
    AND status IN ('draft', 'active', 'paused_pending_review');

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN json_build_object('ok', TRUE, 'feed_thumbnail_path', v_path);
END;
$$;

REVOKE ALL ON FUNCTION set_listing_feed_thumbnail(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_listing_feed_thumbnail(UUID, TEXT) TO authenticated;
