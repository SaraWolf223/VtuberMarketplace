-- Local Marketplace: listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0 AND price <= 20.00),
  category listing_category NOT NULL,
  zip_code CHAR(5) NOT NULL,
  location extensions.geography (POINT, 4326) NOT NULL,
  status listing_status NOT NULL DEFAULT 'active',
  image_count INT NOT NULL DEFAULT 0 CHECK (image_count >= 0 AND image_count <= 5),
  boosted_until TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  sold_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  purge_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE INDEX listings_location_idx ON listings USING GIST (location);
CREATE INDEX listings_status_expires_idx ON listings (status, expires_at);
CREATE INDEX listings_seller_idx ON listings (seller_id);
CREATE INDEX listings_search_idx ON listings USING GIN (search_vector);
CREATE INDEX listings_boosted_idx ON listings (boosted_until DESC NULLS LAST);
CREATE INDEX listings_active_geo_idx ON listings USING GIST (location)
WHERE status = 'active';
