-- Admin-only bulk email campaigns (waitlist + registered users). Managers cannot send.

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  audience TEXT NOT NULL CHECK (audience IN ('waitlist', 'users')),
  subject TEXT NOT NULL CHECK (char_length(trim(subject)) BETWEEN 1 AND 200),
  body_text TEXT NOT NULL CHECK (char_length(trim(body_text)) BETWEEN 1 AND 50000),
  recipient_count INT NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  sent_count INT NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count INT NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_campaigns_created_idx ON email_campaigns (created_at DESC);
CREATE INDEX email_campaigns_audience_idx ON email_campaigns (audience, created_at DESC);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_campaigns_admin_select ON email_campaigns
  FOR SELECT
  TO authenticated
  USING (is_app_admin());

CREATE POLICY email_campaigns_admin_insert ON email_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (is_app_admin() AND admin_id = auth.uid());
