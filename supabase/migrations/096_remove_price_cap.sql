-- Remove the fixed listing price cap (triple-layer: table CHECK + insert/update RPCs).
-- Only a lower bound remains: price must be greater than $0. No upper bound.

-- ---------------------------------------------------------------------------
-- 1. Table CHECK constraint: drop any upper bound, keep price > 0.
--    Robustly drop whatever the original inline price-cap check is named.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'listings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%price%'
  LOOP
    EXECUTE format('ALTER TABLE listings DROP CONSTRAINT %I', v_conname);
  END LOOP;
END $$;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_price_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_price_check CHECK (price > 0);

-- ---------------------------------------------------------------------------
-- 2. insert_draft_listing RPC (latest body from migration 083) — no price cap
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
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
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

-- ---------------------------------------------------------------------------
-- 3. update_listing RPC (latest body from migration 074) — no price cap
-- ---------------------------------------------------------------------------
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

  IF p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than 0';
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
