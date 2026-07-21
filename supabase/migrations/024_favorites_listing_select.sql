-- Let buyers read listings they favorited (including expired) for the Favorites tab
CREATE POLICY listings_select_favorited ON listings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM favorites f
      WHERE f.listing_id = listings.id AND f.user_id = auth.uid()
    )
  );

CREATE POLICY listing_images_select_favorited ON listing_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM favorites f
      WHERE f.listing_id = listing_images.listing_id AND f.user_id = auth.uid()
    )
  );
