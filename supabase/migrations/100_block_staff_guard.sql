-- Local Marketplace: prevent users from blocking platform staff (admin / manager).
-- Blocking a staff account would hide moderation/official listings and break
-- contact with the platform. Enforced server-side so it covers every client
-- path (profile, listing detail, message thread) regardless of UI guards.

CREATE OR REPLACE FUNCTION prevent_block_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = NEW.blocked_id
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'You cannot block a Local Marketplace staff account'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blocks_prevent_staff ON blocks;

CREATE TRIGGER blocks_prevent_staff
BEFORE INSERT ON blocks
FOR EACH ROW
EXECUTE FUNCTION prevent_block_staff();
