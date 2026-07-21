-- Convert `listings.category` from the fixed `listing_category` enum to a
-- TEXT column with a foreign key into the new admin-editable
-- `listing_categories` table (see 109_listing_categories_table.sql).

-- Normalize any lingering legacy value before adding the FK constraint.
UPDATE listings SET category = 'miscellaneous' WHERE category::text = 'clothing';

ALTER TABLE listings ALTER COLUMN category TYPE TEXT USING category::text;
ALTER TABLE listings
  ADD CONSTRAINT listings_category_fkey
  FOREIGN KEY (category) REFERENCES listing_categories(slug);

-- ---------------------------------------------------------------------------
-- Re-create every RPC that took a `listing_category` parameter as TEXT,
-- validating against the new table instead of relying on the enum. Bodies
-- are copied from the latest prior definition (096_remove_price_cap.sql for
-- insert_draft_listing/update_listing, 081_feed_founding_seller.sql for
-- get_feed_listings) with only the category type/validation changed.
--
-- `CREATE OR REPLACE FUNCTION` cannot change a parameter's type — it only
-- replaces a function with the *same* signature. Since the old overloads
-- take `p_category listing_category`, they must be dropped explicitly
-- (before `DROP TYPE`, which needs every dependent function gone first).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.insert_draft_listing(
  uuid, text, text, numeric, public.listing_category, text, double precision, double precision
);
DROP FUNCTION IF EXISTS public.update_listing(
  uuid, text, text, numeric, public.listing_category, text, double precision, double precision
);

CREATE OR REPLACE FUNCTION insert_draft_listing(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category text,
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
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM listing_categories WHERE slug = p_category AND is_active) THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
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

CREATE OR REPLACE FUNCTION update_listing(
  p_listing_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category text,
  p_zip_code text,
  p_lat double precision,
  p_lng double precision
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
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

  IF v_row.status <> 'active' THEN
    RETURN json_build_object('error', 'NOT_EDITABLE');
  END IF;

  IF p_price <= 0 THEN
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

  IF p_zip_code !~ '^\d{5}$' THEN
    RAISE EXCEPTION 'Invalid ZIP';
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
    zip_code = p_zip_code,
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN json_build_object('id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION update_listing FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_listing TO authenticated;

-- get_feed_listings: drop the old signature (enum param) and recreate with TEXT.
DROP FUNCTION IF EXISTS public.get_feed_listings(
  double precision,
  double precision,
  numeric,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer,
  boolean
);

CREATE OR REPLACE FUNCTION get_feed_listings(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles numeric DEFAULT 10,
  p_category text DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_status listing_status DEFAULT 'active',
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_college_students_only boolean DEFAULT FALSE
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_point extensions.geography;
  v_radius_meters double precision;
  v_items json;
  v_next_cursor text;
  v_limit int;
  v_cursor_rank int;
  v_cursor_sort double precision;
  v_cursor_id uuid;
  v_search text;
  v_feed_count int;
BEGIN
  IF p_radius_miles NOT IN (0.5, 1, 2, 5, 10, 25, 50) THEN
    RAISE EXCEPTION 'p_radius_miles must be 0.5, 1, 2, 5, 10, 25, or 50';
  END IF;

  IF p_sort NOT IN ('newest', 'closest', 'lowest_price') THEN
    RAISE EXCEPTION 'Invalid p_sort';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_user_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius_meters := p_radius_miles::double precision * 1609.344;
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
      l.id,
      l.title,
      l.price,
      l.category,
      l.zip_code,
      l.status,
      l.boosted_until,
      l.published_at,
      l.image_count,
      l.seller_id,
      (l.boosted_until IS NOT NULL AND l.boosted_until > NOW()) AS is_boosted,
      (
        p.is_premium = TRUE
        AND (p.premium_until IS NULL OR p.premium_until > NOW())
      ) AS seller_is_premium,
      COALESCE(p.is_founding_seller, FALSE) AS seller_is_founding_seller,
      (p.role = 'admin') AS seller_is_admin,
      CASE
        WHEN l.boosted_until > NOW()
          AND p.is_premium = TRUE
          AND (p.premium_until IS NULL OR p.premium_until > NOW())
        THEN 0
        WHEN l.boosted_until > NOW() THEN 1
        ELSE 2
      END AS feed_rank,
      extensions.ST_Distance(l.location, v_user_point) / 1609.344 AS distance_miles,
      CASE
        WHEN p_sort = 'closest' THEN extensions.ST_Distance(l.location, v_user_point) / 1609.344
        WHEN p_sort = 'lowest_price' THEN l.price::double precision
        ELSE -EXTRACT(EPOCH FROM l.published_at)
      END AS sort_value,
      p.display_name AS seller_display_name,
      p.username AS seller_username,
      p.avatar_url AS seller_avatar_url,
      (
        SELECT li.storage_path
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.sort_order
        LIMIT 1
      ) AS thumb_path
    FROM listings l
    INNER JOIN profiles p ON p.id = l.seller_id
    WHERE l.status = COALESCE(p_status, 'active'::listing_status)
      AND (p_category IS NULL OR l.category = p_category)
      AND (p_max_price IS NULL OR l.price <= p_max_price)
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
      AND (
        NOT COALESCE(p_college_students_only, FALSE)
        OR (
          p.college_badge_expires_at IS NOT NULL
          AND p.college_badge_expires_at > NOW()
        )
      )
      AND (
        auth.uid() IS NULL
        OR l.seller_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
        )
      )
      AND extensions.ST_DWithin(l.location, v_user_point, v_radius_meters)
      AND (
        v_search IS NULL
        OR l.search_vector @@ plainto_tsquery('english', v_search)
      )
      AND (
        v_cursor_id IS NULL
        OR (
          CASE
            WHEN l.boosted_until > NOW()
              AND p.is_premium = TRUE
              AND (p.premium_until IS NULL OR p.premium_until > NOW())
            THEN 0
            WHEN l.boosted_until > NOW() THEN 1
            ELSE 2
          END,
          CASE
            WHEN p_sort = 'closest' THEN extensions.ST_Distance(l.location, v_user_point) / 1609.344
            WHEN p_sort = 'lowest_price' THEN l.price::double precision
            ELSE -EXTRACT(EPOCH FROM l.published_at)
          END,
          l.id
        ) > (v_cursor_rank, v_cursor_sort, v_cursor_id)
      )
    ORDER BY
      feed_rank,
      sort_value,
      l.id
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE(
      (
        SELECT json_agg(row_to_json(page_row))
        FROM (
          SELECT
            id,
            title,
            price,
            category,
            zip_code,
            status,
            boosted_until,
            published_at,
            image_count,
            seller_id,
            is_boosted,
            distance_miles,
            seller_display_name,
            seller_username,
            seller_avatar_url,
            seller_is_premium,
            seller_is_founding_seller,
            seller_is_admin,
            thumb_path
          FROM feed
          LIMIT v_limit
        ) page_row
      ),
      '[]'::json
    ),
    (SELECT COUNT(*)::int FROM feed),
    (
      SELECT encode(
        convert_to(
          json_build_object('b', feed_rank, 's', sort_value, 'i', id)::text,
          'utf8'
        ),
        'base64'
      )
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

REVOKE ALL ON FUNCTION public.get_feed_listings(
  double precision, double precision, numeric, text, numeric,
  public.listing_status, text, text, text, integer, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_feed_listings(
  double precision, double precision, numeric, text, numeric,
  public.listing_status, text, text, text, integer, boolean
) TO authenticated, anon;

-- Every function that referenced the enum has now been dropped or
-- recreated with a TEXT parameter, and no column uses it — safe to drop.
DROP TYPE IF EXISTS listing_category;
