-- ZIP geocode cache (Mapbox results via geocode-zip edge function)
CREATE TABLE zip_centroids (
  zip_code text PRIMARY KEY CHECK (char_length(zip_code) = 5 AND zip_code ~ '^[0-9]{5}$'),
  lng double precision NOT NULL,
  lat double precision NOT NULL,
  city text,
  state text,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX zip_centroids_updated_at_idx ON zip_centroids (updated_at);

ALTER TABLE zip_centroids ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users; writes via service role in edge function
CREATE POLICY zip_centroids_select_authenticated ON zip_centroids
  FOR SELECT
  TO authenticated
  USING (true);
