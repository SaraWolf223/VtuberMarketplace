-- Enforce avatar file size at storage layer (300 KB)

UPDATE storage.buckets
SET file_size_limit = 307200
WHERE id = 'avatars';

INSERT INTO platform_settings (key, value) VALUES
  ('avatar_max_width', '512'::jsonb),
  ('avatar_max_height', '512'::jsonb),
  ('avatar_max_image_kb', '300'::jsonb)
ON CONFLICT (key) DO NOTHING;
