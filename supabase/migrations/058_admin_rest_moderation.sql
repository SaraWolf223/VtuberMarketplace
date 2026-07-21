-- Admin REST fallbacks (no edge required for common moderation actions)

CREATE POLICY reports_admin_update ON reports
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY listings_admin_update ON listings
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS moderation_actions_admin ON moderation_actions;
CREATE POLICY moderation_actions_admin ON moderation_actions
  FOR ALL
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin() AND admin_id = auth.uid());

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
  IF NOT is_app_admin() THEN
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

  DELETE FROM listings WHERE id = p_listing_id;

  INSERT INTO moderation_actions (admin_id, action, listing_id, target_user_id, notes)
  VALUES (auth.uid(), 'delete_listing', p_listing_id, v_listing.seller_id, NULL);

  UPDATE reports
  SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = auth.uid()
  WHERE listing_id = p_listing_id AND status = 'open';

  RETURN json_build_object('listing_id', p_listing_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_listing(uuid) TO authenticated;
