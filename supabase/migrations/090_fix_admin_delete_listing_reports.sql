-- Retarget listing reports before DELETE so ON DELETE SET NULL on listing_id
-- does not violate reports_target_check.

CREATE OR REPLACE FUNCTION admin_delete_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_paths text[];
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

  DELETE FROM listings WHERE id = p_listing_id;

  INSERT INTO moderation_actions (admin_id, action, listing_id, target_user_id, notes)
  VALUES (auth.uid(), 'delete_listing', p_listing_id, v_listing.seller_id, NULL);

  RETURN json_build_object('listing_id', p_listing_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_listing(uuid) TO authenticated;
