-- Listing lifecycle: 8 weeks active in feed, purge 1 week after expiry (9 weeks from publish).
-- Helps early marketplace seeding vs 14-day turnover.

CREATE OR REPLACE FUNCTION listings_set_lifecycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
    NEW.expires_at := NEW.published_at + INTERVAL '56 days';
    NEW.purge_at := NEW.published_at + INTERVAL '63 days';
  END IF;
  RETURN NEW;
END;
$$;

-- Extend existing live listings so seed inventory stays visible longer.
UPDATE listings
SET
  expires_at = published_at + INTERVAL '56 days',
  purge_at = published_at + INTERVAL '63 days',
  updated_at = NOW()
WHERE status IN ('active', 'paused_pending_review')
  AND published_at IS NOT NULL
  AND purge_at > NOW();

-- Keep purge clock aligned for expired-but-not-purged rows.
UPDATE listings
SET purge_at = published_at + INTERVAL '63 days', updated_at = NOW()
WHERE status = 'expired'
  AND published_at IS NOT NULL
  AND purge_at > NOW();
