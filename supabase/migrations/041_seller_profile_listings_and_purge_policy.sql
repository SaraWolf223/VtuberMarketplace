-- Seller profile listings RPC + purge policy: non-active listings kept up to 1 year

-- Active listings must not be purged by purge_at while still active
CREATE OR REPLACE FUNCTION listings_set_lifecycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
    NEW.expires_at := NEW.published_at + INTERVAL '14 days';
    -- Far-future placeholder; real purge_at set when listing leaves active state
    NEW.purge_at := NEW.published_at + INTERVAL '100 years';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION listings_set_sold_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM 'sold') THEN
    NEW.sold_at = NOW();
    NEW.purge_at = NOW() + INTERVAL '1 year';
  END IF;

  IF NEW.status = 'expired' AND (OLD.status IS DISTINCT FROM 'expired') THEN
    NEW.purge_at = NOW() + INTERVAL '1 year';
  END IF;

  RETURN NEW;
END;
$$;

-- Repair rows affected by the old 21-day purge_at default
UPDATE listings
SET purge_at = GREATEST(
  purge_at,
  COALESCE(sold_at, updated_at, published_at) + INTERVAL '1 year'
)
WHERE status IN ('sold', 'expired');

UPDATE listings
SET purge_at = published_at + INTERVAL '100 years'
WHERE status IN ('active', 'paused_pending_review');

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
        'status', s.status,
        'expires_at', s.expires_at,
        'published_at', s.published_at,
        'boosted_until', s.boosted_until,
        'thumb_path', s.thumb_path
      )
      ORDER BY s.status_rank, s.expires_at ASC NULLS LAST, s.published_at DESC
    ),
    '[]'::json
  )
  INTO v_rows
  FROM (
    SELECT
      l.id,
      l.title,
      l.price::float8 AS price,
      l.category::text AS category,
      CASE
        WHEN l.status = 'paused_pending_review' THEN 'active'
        ELSE l.status::text
      END AS status,
      l.expires_at,
      l.published_at,
      l.boosted_until,
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
