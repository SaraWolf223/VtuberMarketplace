-- VtuberMarketplace: reseed listing_categories for the VTuber domain. Old
-- physical-goods categories are deactivated (not deleted) so historical rows keep a
-- valid FK; new categories are inserted active. Admins can further edit/reorder from
-- Admin → Categories at runtime, same mechanism as before (migration 109).

UPDATE listing_categories SET is_active = FALSE, updated_at = NOW()
WHERE slug IN (
  'electronics', 'gaming', 'furniture', 'womens_clothing', 'mens_clothing', 'home',
  'collectibles', 'toys', 'automotive', 'sports_outdoors', 'college_school', 'books',
  'bikes', 'decorations', 'food_beverage', 'carpool', 'hobby', 'delivery'
);

INSERT INTO listing_categories (slug, label, icon_name, sort_order, is_active) VALUES
  ('vrchat', 'VRChat', 'people-outline', 10, TRUE),
  ('live2d', 'Live2D', 'brush-outline', 20, TRUE),
  ('pngtuber', 'PNGtuber', 'camera-outline', 30, TRUE),
  ('chibi', 'Chibi', 'gift-outline', 40, TRUE),
  ('kemonomimi', 'Kemonomimi', 'paw-outline', 50, TRUE),
  ('fantasy', 'Fantasy', 'diamond-outline', 60, TRUE),
  ('original_character', 'Original character', 'ribbon-outline', 70, TRUE),
  ('accessories', 'Accessories', 'watch-outline', 80, TRUE),
  ('backgrounds', 'Backgrounds & overlays', 'color-palette-outline', 90, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

-- 'miscellaneous' already exists (migration 109) and stays active as-is.
UPDATE listing_categories SET sort_order = 999, updated_at = NOW() WHERE slug = 'miscellaneous';
