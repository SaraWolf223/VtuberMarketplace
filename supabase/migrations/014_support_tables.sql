-- Local Marketplace: webhook idempotency + listing rate limit log
CREATE TABLE webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only

CREATE TABLE listing_create_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX listing_create_log_user_time_idx ON listing_create_log (user_id, created_at DESC);

ALTER TABLE listing_create_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_create_log_select_own ON listing_create_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY listing_create_log_insert_own ON listing_create_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
