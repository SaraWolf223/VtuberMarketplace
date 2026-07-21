-- Prompt 21: shared edge rate-limit buckets.

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_created_idx
  ON rate_limit_events (bucket_key, created_at DESC);

ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Service role only (edges use admin client).
