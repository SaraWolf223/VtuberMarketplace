-- Audit fixes: phone stub lockdown, banned keywords on edit.

-- ---------------------------------------------------------------------------
-- 1. Dev phone stub: not callable from client JWT (edge/service_role only)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION mark_phone_verified_stub(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_phone_verified_stub(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_phone_verified_stub(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Banned keywords on listing update + missing seed terms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_banned_keyword_in_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bk.keyword
  FROM banned_keywords bk
  WHERE bk.active = TRUE
    AND strpos(lower(COALESCE(p_text, '')), lower(bk.keyword)) > 0
  ORDER BY char_length(bk.keyword) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_banned_keyword_in_text(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_banned_keyword_in_text(TEXT) TO authenticated;

INSERT INTO banned_keywords (keyword) VALUES
  ('viagra'),
  ('paypal fee'),
  ('wire transfer'),
  ('gift card code')
ON CONFLICT (keyword) DO NOTHING;

CREATE OR REPLACE FUNCTION update_listing(
  p_listing_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category listing_category,
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

  IF p_price <= 0 OR p_price > 20 THEN
    RAISE EXCEPTION 'Price must be between 0 and 20';
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

-- ---------------------------------------------------------------------------
-- 3. Cron schedule reference (enable pg_cron in Supabase dashboard first)
-- ---------------------------------------------------------------------------
-- SELECT cron.schedule('expire-listings-daily', '0 4 * * *', $$SELECT expire_due_listings()$$);
-- Edge cron (Authorization: Bearer CRON_SECRET): purge-expired-listings, purge-expired-college-badges
