-- Local Marketplace: Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_boost_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_keywords ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- user_prefs
CREATE POLICY user_prefs_select_own ON user_prefs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_prefs_insert_own ON user_prefs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_prefs_update_own ON user_prefs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_prefs_delete_own ON user_prefs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- listings
CREATE POLICY listings_select_visible ON listings
  FOR SELECT TO authenticated
  USING (
    (
      status IN ('active', 'sold')
      AND seller_id NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = listings.seller_id
          AND p.banned_at IS NULL
          AND p.shadow_banned = FALSE
      )
    )
    OR seller_id = auth.uid()
  );

CREATE POLICY listings_insert_own ON listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.banned_at IS NULL
    )
  );

CREATE POLICY listings_update_own ON listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY listings_delete_own ON listings
  FOR DELETE TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY admin_all_listings ON listings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- listing_images (visibility follows listing)
CREATE POLICY listing_images_select ON listing_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_images.listing_id
        AND (
          l.seller_id = auth.uid()
          OR (
            l.status IN ('active', 'sold')
            AND l.seller_id NOT IN (
              SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY listing_images_insert_own ON listing_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_images.listing_id AND l.seller_id = auth.uid()
    )
  );

CREATE POLICY listing_images_delete_own ON listing_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_images.listing_id AND l.seller_id = auth.uid()
    )
  );

-- favorites
CREATE POLICY favorites_select_own ON favorites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY favorites_insert_own ON favorites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY favorites_delete_own ON favorites
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- listing_interest
CREATE POLICY listing_interest_select_own ON listing_interest
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY listing_interest_insert_own ON listing_interest
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- reviews
CREATE POLICY reviews_select ON reviews
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY reviews_insert_own ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- blocks
CREATE POLICY blocks_select_own ON blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY blocks_insert_own ON blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY blocks_delete_own ON blocks
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- reports
CREATE POLICY reports_insert_own ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY reports_select_own ON reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- monetization (owner read; writes via Edge/service)
CREATE POLICY boost_purchases_select_own ON boost_purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY premium_subscriptions_select_own ON premium_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY premium_boost_credits_select_own ON premium_boost_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- moderation_actions: admin only
CREATE POLICY moderation_actions_admin ON moderation_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- banned_keywords: read for authenticated (edge also uses service role)
CREATE POLICY banned_keywords_select ON banned_keywords
  FOR SELECT TO authenticated
  USING (active = TRUE);

-- Storage policies
CREATE POLICY listing_images_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'listing-images');

CREATE POLICY listing_images_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY listing_images_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
