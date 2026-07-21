-- Local Marketplace: user location preferences
CREATE TABLE user_prefs (
  user_id UUID PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  home_zip CHAR(5) NOT NULL,
  home_location extensions.geography (POINT, 4326) NOT NULL,
  radius_miles INT NOT NULL DEFAULT 10 CHECK (radius_miles IN (5, 10, 25, 50)),
  push_token TEXT,
  notify_expiry BOOLEAN NOT NULL DEFAULT TRUE,
  notify_boost_deals BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_prefs_location_idx ON user_prefs USING GIST (home_location);
CREATE INDEX user_prefs_user_id_idx ON user_prefs (user_id);
