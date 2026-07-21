-- Local Marketplace: profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'google',
  username_changed_at TIMESTAMPTZ,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'user',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INT NOT NULL DEFAULT 0,
  listing_count INT NOT NULL DEFAULT 0,
  banned_at TIMESTAMPTZ,
  shadow_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  CONSTRAINT profiles_username_len CHECK (char_length(username) BETWEEN 3 AND 24),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

CREATE UNIQUE INDEX profiles_username_lower_idx ON profiles (LOWER(username));
CREATE INDEX profiles_id_idx ON profiles (id);

CREATE VIEW profiles_public AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  rating_avg,
  rating_count,
  listing_count,
  is_premium,
  created_at
FROM profiles
WHERE banned_at IS NULL
  AND shadow_banned = FALSE;

GRANT SELECT ON profiles_public TO anon, authenticated;
