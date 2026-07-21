-- Grant Local Marketplace admin panel access (run in Supabase SQL Editor).
-- Use the SAME Supabase project as EXPO_PUBLIC_SUPABASE_URL in your .env.
-- Prefer updating by id (copy from app Settings or /admin blocked screen).

-- By profile id (most reliable):
-- UPDATE profiles SET role = 'admin', updated_at = NOW()
-- WHERE id = 'paste-your-uuid-here';

-- By email (only if it matches the signed-in Google account exactly):
UPDATE profiles
SET role = 'admin', updated_at = NOW()
WHERE LOWER(email) = LOWER('your-admin@gmail.com');

-- Verify (must show role = admin):
SELECT id, email, username, role, updated_at
FROM profiles
WHERE LOWER(email) = LOWER('your-admin@gmail.com');

-- If 0 rows updated, list recent sign-ins:
-- SELECT id, email, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 10;
