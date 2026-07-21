-- Mark active listings past expires_at as expired (run daily via pg_cron or external scheduler)

CREATE OR REPLACE FUNCTION expire_due_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE listings
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('active', 'paused_pending_review')
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_due_listings FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_due_listings TO service_role;

-- Optional: enable pg_cron in Supabase dashboard, then:
-- SELECT cron.schedule('expire-listings-daily', '0 4 * * *', $$SELECT expire_due_listings()$$);
