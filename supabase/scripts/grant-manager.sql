-- Grant manager role (moderation only — not promos, platform settings, or bulk email).
-- Run in Supabase SQL Editor for the same project as the app.

-- UPDATE profiles SET role = 'manager', updated_at = NOW()
-- WHERE email = 'manager@example.com';

-- Verify:
-- SELECT id, email, username, role, updated_at FROM profiles WHERE role = 'manager';
