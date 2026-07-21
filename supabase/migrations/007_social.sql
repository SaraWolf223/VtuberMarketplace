-- Local Marketplace: favorites, interest, reviews, blocks
CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX favorites_user_idx ON favorites (user_id);
CREATE INDEX favorites_listing_idx ON favorites (listing_id);

CREATE TABLE listing_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX listing_interest_buyer_idx ON listing_interest (buyer_id);
CREATE INDEX listing_interest_listing_idx ON listing_interest (listing_id);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, listing_id)
);

CREATE INDEX reviews_seller_idx ON reviews (seller_id);

CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocker_idx ON blocks (blocker_id);
CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);
