-- Seller updates active listing metadata (re-geocode via client lat/lng)
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
