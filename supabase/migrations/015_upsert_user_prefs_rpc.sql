-- Save user ZIP + coordinates (PostGIS) server-side — avoids client geography format issues
CREATE OR REPLACE FUNCTION upsert_user_prefs_location(
  p_home_zip text,
  p_lng double precision,
  p_lat double precision,
  p_radius_miles int DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_radius_miles NOT IN (5, 10, 25, 50) THEN
    RAISE EXCEPTION 'Invalid radius';
  END IF;

  IF char_length(p_home_zip) <> 5 OR p_home_zip !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ZIP';
  END IF;

  INSERT INTO user_prefs (user_id, home_zip, home_location, radius_miles)
  VALUES (
    v_uid,
    p_home_zip,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_miles
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    home_zip = EXCLUDED.home_zip,
    home_location = EXCLUDED.home_location,
    radius_miles = EXCLUDED.radius_miles,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION upsert_user_prefs_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_user_prefs_location TO authenticated;
