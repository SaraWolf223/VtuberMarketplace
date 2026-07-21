-- Admin-editable listing categories (replaces the static `listing_category`
-- enum so an admin can add/remove/reorder/re-icon categories without a code
-- change or migration). See 110_listings_category_to_text.sql for the
-- `listings.category` column conversion that depends on this table.

CREATE TABLE listing_categories (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9_]{0,39}$'),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  -- Ionicons glyph name (validated against an allowlist client-side —
  -- see src/constants/ionicons-allowlist.ts — never rendered as free text).
  icon_name TEXT NOT NULL DEFAULT 'grid-outline',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_categories_select_all ON listing_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY listing_categories_admin_all ON listing_categories
  FOR ALL
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

-- Seed from the current 20-value enum (002_enums.sql + 039_categories_radius_2mb.sql),
-- with labels/icons matching src/features/listings/category-labels.ts and
-- src/features/listings/category-icons.ts at the time of this migration.
INSERT INTO listing_categories (slug, label, icon_name, sort_order) VALUES
  ('electronics', 'Electronics', 'phone-portrait-outline', 10),
  ('gaming', 'Gaming', 'game-controller-outline', 20),
  ('furniture', 'Furniture', 'bed-outline', 30),
  ('womens_clothing', 'Women''s clothing', 'shirt-outline', 40),
  ('mens_clothing', 'Men''s clothing', 'man-outline', 50),
  ('home', 'Home', 'home-outline', 60),
  ('collectibles', 'Collectibles', 'ribbon-outline', 70),
  ('toys', 'Toys', 'cube-outline', 80),
  ('automotive', 'Automotive', 'car-outline', 90),
  ('sports_outdoors', 'Sports & outdoors', 'basketball-outline', 100),
  ('college_school', 'College / school', 'school-outline', 110),
  ('books', 'Books', 'book-outline', 120),
  ('bikes', 'Bikes', 'bicycle-outline', 130),
  ('decorations', 'Decorations', 'color-palette-outline', 140),
  ('food_beverage', 'Food & beverage', 'fast-food-outline', 150),
  ('carpool', 'Carpool', 'people-outline', 160),
  ('hobby', 'Hobby', 'brush-outline', 170),
  ('delivery', 'Delivery', 'bag-handle-outline', 180),
  ('miscellaneous', 'Miscellaneous', 'grid-outline', 190)
ON CONFLICT (slug) DO NOTHING;
