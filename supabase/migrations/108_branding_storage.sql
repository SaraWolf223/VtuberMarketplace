-- Storage bucket for the admin-uploaded brand logo (public read, admin-only write).
-- Uploads go through the `upload-branding-logo` edge function, which validates
-- file type/size/dimensions server-side before writing here.

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY branding_storage_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'branding');

CREATE POLICY branding_storage_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND is_app_admin());

CREATE POLICY branding_storage_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND is_app_admin());

CREATE POLICY branding_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND is_app_admin());
