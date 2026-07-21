-- Helper for edge create-listing: reliable PostGIS point insert
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

REVOKE ALL ON FUNCTION insert_draft_listing FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_draft_listing TO service_role;
