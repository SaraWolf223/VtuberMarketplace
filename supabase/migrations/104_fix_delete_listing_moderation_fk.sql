-- Fix listing deletion. moderation_actions.listing_id had a RESTRICT foreign key
-- (no ON DELETE), so:
--   1. Any listing with prior moderation history could not be deleted (RESTRICT).
--   2. admin_delete_listing inserted its audit row AFTER deleting the listing,
--      violating the FK (parent gone) and rolling the whole delete back.
-- Switch the FK to ON DELETE SET NULL and log the audit row BEFORE the delete.

ALTER TABLE moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_listing_id_fkey;

ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE SET NULL;

-- Drop the old single-arg version so the new defaulted-param overload is unambiguous.
DROP FUNCTION IF EXISTS admin_delete_listing(uuid);

CREATE OR REPLACE FUNCTION admin_delete_listing(
  p_listing_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_paths text[];
  v_reason text := NULLIF(btrim(p_notes), '');
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT path), ARRAY[]::text[])
  INTO v_paths
  FROM (
    SELECT storage_path AS path FROM listing_images WHERE listing_id = p_listing_id AND storage_path IS NOT NULL
    UNION
    SELECT thumb_path FROM listing_images WHERE listing_id = p_listing_id AND thumb_path IS NOT NULL
  ) s;

  IF array_length(v_paths, 1) > 0 THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'listing-images'
      AND name = ANY(v_paths);
  END IF;

  UPDATE reports
  SET
    status = CASE WHEN status = 'open' THEN 'reviewed'::report_status ELSE status END,
    reviewed_at = CASE WHEN status = 'open' THEN NOW() ELSE reviewed_at END,
    reviewed_by = CASE WHEN status = 'open' THEN auth.uid() ELSE reviewed_by END,
    target_type = 'user',
    reported_user_id = v_listing.seller_id
  WHERE listing_id = p_listing_id
    AND target_type = 'listing';

  -- Log BEFORE delete so the FK is satisfied; ON DELETE SET NULL nulls listing_id.
  INSERT INTO moderation_actions (admin_id, action, listing_id, target_user_id, notes)
  VALUES (
    auth.uid(),
    'delete_listing',
    p_listing_id,
    v_listing.seller_id,
    'Removed "' || COALESCE(v_listing.title, '(untitled)') || '"'
      || CASE WHEN v_reason IS NOT NULL THEN ' — ' || v_reason ELSE '' END
  );

  DELETE FROM listings WHERE id = p_listing_id;

  RETURN json_build_object('listing_id', p_listing_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_listing(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_listing(uuid, text) TO authenticated;
