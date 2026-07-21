-- VtuberMarketplace domain conversion: rework `listings` for digital VTuber assets.
-- Drops geo + fixed-expiry columns, adds asset_type/license/delivery/media fields and
-- the asset-type-specific structured fields described in docs/03-Database_Schemas.md.

-- The old lifecycle trigger writes to expires_at/purge_at, which this migration drops —
-- remove the trigger + function first so nothing references the soon-to-be-gone columns.
DROP TRIGGER IF EXISTS listings_lifecycle_dates ON listings;
DROP FUNCTION IF EXISTS listings_set_lifecycle_dates() CASCADE;

DROP INDEX IF EXISTS listings_location_idx;
DROP INDEX IF EXISTS listings_active_geo_idx;
DROP INDEX IF EXISTS listings_status_expires_idx;
DROP INDEX IF EXISTS listings_boosted_idx;

ALTER TABLE listings
  DROP COLUMN IF EXISTS zip_code,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS purge_at;

ALTER TABLE listings RENAME COLUMN boosted_until TO featured_until;

-- Photos: raise the floor from 1 to 3 (max stays 5, unchanged).
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_image_count_check;
ALTER TABLE listings
  ALTER COLUMN image_count SET DEFAULT 0,
  ADD CONSTRAINT listings_image_count_range CHECK (image_count >= 0 AND image_count <= 5);
-- NOTE: the *publish-time* minimum of 3 is enforced in the create-listing/publish-listing
-- edge function (drafts may legitimately have 0-2 images mid-upload), not as a blanket
-- DB CHECK — a hard DB CHECK of >=3 would also block image re-ordering/replacement flows
-- that briefly delete-then-reinsert rows within a transaction.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS asset_type asset_type NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS license_type license_type NOT NULL DEFAULT 'p2u',
  ADD COLUMN IF NOT EXISTS license_text TEXT NOT NULL DEFAULT '' CHECK (char_length(license_text) <= 4000),
  ADD COLUMN IF NOT EXISTS download_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (youtube_video_status IN ('unchecked', 'valid', 'invalid', 'removed')),
  ADD COLUMN IF NOT EXISTS is_mature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS support_duration support_duration_type NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS compatible_software TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS file_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS includes_source_files BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credits_text TEXT CHECK (credits_text IS NULL OR char_length(credits_text) <= 1000),
  ADD COLUMN IF NOT EXISTS changelog JSONB NOT NULL DEFAULT '[]',
  -- Live2D (2D)
  ADD COLUMN IF NOT EXISTS cubism_version TEXT,
  ADD COLUMN IF NOT EXISTS has_physics BOOLEAN,
  ADD COLUMN IF NOT EXISTS expression_count INT CHECK (expression_count IS NULL OR expression_count >= 0),
  ADD COLUMN IF NOT EXISTS parameter_notes TEXT CHECK (parameter_notes IS NULL OR char_length(parameter_notes) <= 1000),
  ADD COLUMN IF NOT EXISTS includes_psd_source BOOLEAN,
  -- 3D models/accessories
  ADD COLUMN IF NOT EXISTS platform_compatibility TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS triangle_count_pc INT CHECK (triangle_count_pc IS NULL OR triangle_count_pc >= 0),
  ADD COLUMN IF NOT EXISTS triangle_count_quest INT CHECK (triangle_count_quest IS NULL OR triangle_count_quest >= 0),
  ADD COLUMN IF NOT EXISTS performance_rank performance_rank_type,
  ADD COLUMN IF NOT EXISTS rig_type TEXT CHECK (rig_type IS NULL OR rig_type IN ('physbones', 'dynamic_bones', 'other')),
  ADD COLUMN IF NOT EXISTS supports_full_body_tracking BOOLEAN,
  ADD COLUMN IF NOT EXISTS toggle_list TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_tools TEXT CHECK (required_tools IS NULL OR char_length(required_tools) <= 500),
  ADD COLUMN IF NOT EXISTS compatible_base_avatar TEXT,
  -- PNGtuber
  ADD COLUMN IF NOT EXISTS included_states TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS setup_instructions TEXT CHECK (setup_instructions IS NULL OR char_length(setup_instructions) <= 2000);

CREATE INDEX IF NOT EXISTS listings_asset_type_idx ON listings (asset_type);
CREATE INDEX IF NOT EXISTS listings_license_type_idx ON listings (license_type);
CREATE INDEX IF NOT EXISTS listings_featured_idx ON listings (featured_until DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS listings_compatible_software_idx ON listings USING GIN (compatible_software);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);

-- Draft cleanup no longer keys off purge_at; use created_at directly (unchanged table).
CREATE INDEX IF NOT EXISTS listings_draft_created_idx ON listings (created_at) WHERE status = 'draft';

COMMENT ON COLUMN listings.download_url IS
  'Seller-hosted link to the sold asset file. The platform never stores or proxies this file.';
COMMENT ON COLUMN listings.license_text IS
  'Seller-authored OTU/P2U license terms, required before publish. Never platform-mandated copy.';
