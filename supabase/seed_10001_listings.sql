-- One-time dev seed: 50 active listings near ZIP 10001 (example area — change to your own test ZIP)
-- Requires at least one row in profiles (sign in once with Google first).
-- Run: npx supabase db execute --file supabase/seed_10001_listings.sql --linked

DO $$
DECLARE
  v_seller uuid;
  v_sellers uuid[];
  v_seller_count int;
  v_lat double precision := 40.7506;
  v_lng double precision := -73.9972;
  v_i int;
  v_title text;
  v_price numeric;
  v_cat listing_category;
  v_categories listing_category[] := ARRAY[
    'electronics', 'gaming', 'furniture', 'home', 'collectibles',
    'toys', 'automotive', 'sports_outdoors', 'miscellaneous', 'clothing'
  ]::listing_category[];
  v_dlat double precision;
  v_dlng double precision;
BEGIN
  SELECT array_agg(id ORDER BY created_at)
  INTO v_sellers
  FROM profiles
  WHERE banned_at IS NULL
  LIMIT 5;

  v_seller_count := coalesce(array_length(v_sellers, 1), 0);
  IF v_seller_count = 0 THEN
    RAISE EXCEPTION 'No profiles found. Sign in to Local Marketplace once, then re-run this seed.';
  END IF;

  FOR v_i IN 1..50 LOOP
    v_seller := v_sellers[1 + ((v_i - 1) % v_seller_count)];
    v_cat := v_categories[1 + floor(random() * array_length(v_categories, 1))::int];
    v_price := (ARRAY[1, 2, 3, 5, 7, 8, 10, 12, 15, 18, 20])[1 + floor(random() * 11)::int];
    v_title := 'Test item #' || v_i || ' near ' || '10001';
    v_dlat := (random() - 0.5) * 0.12;
    v_dlng := (random() - 0.5) * 0.12;

    INSERT INTO listings (
      seller_id,
      title,
      description,
      price,
      category,
      zip_code,
      location,
      status,
      image_count,
      published_at
    )
    VALUES (
      v_seller,
      v_title,
      'Seed listing for local feed testing (ZIP 10001).',
      v_price,
      v_cat,
      '10001',
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(v_lng + v_dlng, v_lat + v_dlat),
        4326
      )::extensions.geography,
      'active',
      0,
      NOW() - (random() * interval '7 days')
    );
  END LOOP;

  RAISE NOTICE 'Inserted 50 active listings for ZIP 10001 using % seller(s).', v_seller_count;
END $$;
