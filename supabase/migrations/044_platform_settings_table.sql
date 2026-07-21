-- Shared key/value table for admin-configurable platform settings (e.g. boost pricing).
-- Individual settings keys are inserted by the migrations that introduce the
-- feature that needs them (see 052_admin_promo_platform.sql for boost settings).

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
