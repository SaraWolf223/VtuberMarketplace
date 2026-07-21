-- Local Marketplace: reports, moderation, banned keywords
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  listing_id UUID REFERENCES listings (id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  status report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles (id),
  CONSTRAINT reports_target_check CHECK (
    (target_type = 'listing' AND listing_id IS NOT NULL)
    OR (target_type = 'user' AND reported_user_id IS NOT NULL)
  )
);

CREATE INDEX reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX reports_reporter_idx ON reports (reporter_id);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles (id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles (id),
  listing_id UUID REFERENCES listings (id),
  report_id UUID REFERENCES reports (id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE banned_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
