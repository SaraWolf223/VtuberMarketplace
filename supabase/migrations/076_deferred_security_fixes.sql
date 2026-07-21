-- Deferred security fixes: reviews privacy, listing_interest RPC-only.

-- ---------------------------------------------------------------------------
-- 1. Reviews: only buyer, seller, or admin can read a row directly
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select_participants ON reviews
  FOR SELECT TO authenticated
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR is_app_admin()
  );

-- ---------------------------------------------------------------------------
-- 2. Listing interest: RPC-only insert (edge/RPC paths use SECURITY DEFINER)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS listing_interest_insert_own ON listing_interest;
CREATE POLICY listing_interest_no_direct_insert ON listing_interest
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

CREATE OR REPLACE FUNCTION record_listing_interest(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = p_listing_id
      AND l.status IN ('active', 'sold')
      AND l.seller_id <> v_uid
  ) THEN
    RETURN;
  END IF;

  INSERT INTO listing_interest (listing_id, buyer_id)
  VALUES (p_listing_id, v_uid)
  ON CONFLICT (listing_id, buyer_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION record_listing_interest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_listing_interest(UUID) TO authenticated;
