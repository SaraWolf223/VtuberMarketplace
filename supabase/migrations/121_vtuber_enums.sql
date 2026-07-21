-- VtuberMarketplace domain conversion: new enum types.
-- Additive — does not touch existing enums except two narrow ALTER TYPE ADD VALUE calls.

CREATE TYPE asset_type AS ENUM (
  'live2d_2d', 'model_3d', 'pngtuber', 'accessory_prop',
  'background_overlay', 'base_model', 'other'
);

CREATE TYPE license_type AS ENUM ('otu', 'p2u');

CREATE TYPE addon_kind AS ENUM ('customization', 'setup');

CREATE TYPE support_duration_type AS ENUM ('none', '30_days', '90_days', 'lifetime');

CREATE TYPE order_status AS ENUM (
  'pending_payment', 'awaiting_fulfillment', 'fulfilled', 'refunded', 'cancelled'
);

CREATE TYPE strike_source AS ENUM ('automated_check', 'buyer_report');

CREATE TYPE performance_rank_type AS ENUM ('excellent', 'good', 'medium', 'poor');

-- Reuse the existing 'paused_pending_review' listing_status value (migration 029) for
-- link-health/strike auto-pause too, rather than inventing a parallel 'paused' state.
-- 'expired' stays in the enum for historical rows but is no longer a reachable state
-- for new listings (no fixed expiry in this domain).

-- New moderation report reasons for the digital marketplace.
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'ai_generated_content';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'download_link_not_working';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'stolen_content';

-- report_target_type gains an order-scoped path for "download link not working" reports.
ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'order';
