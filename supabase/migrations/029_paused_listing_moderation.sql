-- Listing paused for moderation review + report indexes
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'paused_pending_review';

CREATE INDEX IF NOT EXISTS reports_listing_created_idx
  ON reports (listing_id, created_at DESC)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reports_user_target_idx
  ON reports (reported_user_id, created_at DESC)
  WHERE reported_user_id IS NOT NULL;

-- Admin can read all open reports
CREATE POLICY reports_select_admin ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can read moderation queue listings
CREATE POLICY listings_select_admin ON listings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
