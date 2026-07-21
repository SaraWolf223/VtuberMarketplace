-- Premium sellers: 2 months active. Standard sellers: 21 days. Purge 7 days after expiry.

CREATE OR REPLACE FUNCTION profile_premium_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_premium
        AND (p.premium_until IS NULL OR p.premium_until > NOW())
      FROM profiles p
      WHERE p.id = p_user_id
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION profile_premium_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profile_premium_active(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION listings_set_lifecycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;

    IF profile_premium_active(NEW.seller_id) THEN
      NEW.expires_at := NEW.published_at + INTERVAL '2 months';
      NEW.purge_at := NEW.published_at + INTERVAL '2 months' + INTERVAL '7 days';
    ELSE
      NEW.expires_at := NEW.published_at + INTERVAL '21 days';
      NEW.purge_at := NEW.published_at + INTERVAL '28 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE listings l
SET
  expires_at = l.published_at + CASE
    WHEN profile_premium_active(l.seller_id) THEN INTERVAL '2 months'
    ELSE INTERVAL '21 days'
  END,
  purge_at = l.published_at + CASE
    WHEN profile_premium_active(l.seller_id) THEN INTERVAL '2 months' + INTERVAL '7 days'
    ELSE INTERVAL '28 days'
  END,
  updated_at = NOW()
WHERE l.status IN ('active', 'paused_pending_review')
  AND l.published_at IS NOT NULL
  AND l.purge_at > NOW();

UPDATE listings l
SET
  purge_at = l.published_at + CASE
    WHEN profile_premium_active(l.seller_id) THEN INTERVAL '2 months' + INTERVAL '7 days'
    ELSE INTERVAL '28 days'
  END,
  updated_at = NOW()
WHERE l.status = 'expired'
  AND l.published_at IS NOT NULL
  AND l.purge_at > NOW();
