-- Preserve user-uploaded avatars.
--
-- upsert_user_prefs_location runs on app launch, onboarding, and whenever the
-- user changes their location. Its ON CONFLICT clause set
--   avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)
-- where EXCLUDED.avatar_url is the Google picture (always non-null), so every
-- call clobbered a custom avatar (set via the upload-profile-avatar function)
-- back to the Google photo.
--
-- Fix: prefer the EXISTING profile avatar and only fall back to the Google
-- picture when the profile has none (e.g. first insert handles the initial
-- value via the INSERT branch). display_name continues to track Google.

CREATE OR REPLACE FUNCTION upsert_user_prefs_location(
  p_home_zip text,
  p_lng double precision,
  p_lat double precision,
  p_radius_miles numeric DEFAULT 10,
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_name text;
  v_avatar text;
  v_username text;
  v_state text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_radius_miles NOT IN (0.5, 1, 2, 5, 10, 25, 50) THEN
    RAISE EXCEPTION 'Invalid radius';
  END IF;

  IF char_length(p_home_zip) <> 5 OR p_home_zip !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ZIP';
  END IF;

  v_state := NULLIF(UPPER(TRIM(COALESCE(p_state, ''))), '');
  IF v_state IS NOT NULL AND v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid state code';
  END IF;

  SELECT email, raw_user_meta_data
  INTO v_email, v_meta
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Account email missing';
  END IF;

  v_name := COALESCE(
    v_meta->>'full_name',
    v_meta->>'name',
    split_part(v_email, '@', 1),
    'User'
  );
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');
  v_username := 'user_' || substr(replace(v_uid::text, '-', ''), 1, 12);

  INSERT INTO profiles (
    id,
    email,
    username,
    display_name,
    avatar_url,
    auth_provider,
    last_active_at,
    updated_at
  )
  VALUES (
    v_uid,
    v_email,
    v_username,
    v_name,
    v_avatar,
    'google',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    auth_provider = 'google',
    last_active_at = NOW(),
    updated_at = NOW();

  INSERT INTO user_prefs (user_id, home_zip, home_location, radius_miles)
  VALUES (
    v_uid,
    p_home_zip,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_miles
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    home_zip = EXCLUDED.home_zip,
    home_location = EXCLUDED.home_location,
    radius_miles = EXCLUDED.radius_miles,
    updated_at = NOW();

  IF v_state IS NOT NULL THEN
    INSERT INTO zip_centroids (zip_code, lng, lat, city, state, updated_at)
    VALUES (
      p_home_zip,
      p_lng,
      p_lat,
      NULLIF(TRIM(COALESCE(p_city, '')), ''),
      v_state,
      NOW()
    )
    ON CONFLICT (zip_code) DO UPDATE
    SET
      lng = EXCLUDED.lng,
      lat = EXCLUDED.lat,
      city = COALESCE(EXCLUDED.city, zip_centroids.city),
      state = EXCLUDED.state,
      updated_at = NOW();
  END IF;
END;
$$;
