-- Local Marketplace: listing images
CREATE TABLE listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumb_path TEXT NOT NULL,
  sort_order INT NOT NULL CHECK (sort_order >= 0 AND sort_order < 5),
  byte_size INT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, sort_order)
);

CREATE INDEX listing_images_listing_idx ON listing_images (listing_id);

-- Storage bucket (public read for MVP)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', TRUE)
ON CONFLICT (id) DO NOTHING;
