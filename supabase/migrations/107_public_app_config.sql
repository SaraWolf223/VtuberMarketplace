-- Public, admin-editable app configuration (branding, categories metadata, radius
-- options, etc). Unlike `platform_settings` (admin-only read+write, operational
-- values like boost pricing), rows here are safe/non-secret and readable by
-- anyone so the signed-out sign-in screen, the website, and every client can
-- render the buyer's branding without authenticating first.
--
-- Never store secrets here (API keys, service role keys, etc) — those stay in
-- .env / Supabase Dashboard secrets. See docs/00-Developer_Setup.md.

CREATE TABLE public_app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_app_config_select_all ON public_app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY public_app_config_admin_insert ON public_app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY public_app_config_admin_update ON public_app_config
  FOR UPDATE
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY public_app_config_admin_delete ON public_app_config
  FOR DELETE
  TO authenticated
  USING (is_app_admin());

-- Seed defaults matching the bundled app defaults, so a fresh buyer database
-- behaves identically to the shipped app until they change something.
INSERT INTO public_app_config (key, value) VALUES
  ('app_display_name', '"Local Marketplace"'),
  ('support_email', '"support@example.com"'),
  ('branding_logo_url', 'null'),
  ('branding_colors', '{}'),
  ('feed_radius_options', '[0.5, 1, 2, 5, 10, 25, 50]'),
  ('max_radius_miles', '50')
ON CONFLICT (key) DO NOTHING;
