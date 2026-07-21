-- Mandatory TOTP (2FA) enforcement for admin/manager roles.
--
-- Enrollment itself (supabase.auth.mfa.enroll/verify) always happens over Supabase Auth's own
-- API, never through these RLS-gated tables, so this cannot create a lockout: a staff member who
-- hasn't enrolled yet simply cannot read/write anything gated by is_app_admin()/is_app_staff()
-- until they complete enrollment (client routes them to /admin/security to do so).
--
-- auth.jwt()->>'aal' is a first-class Supabase Auth claim (aal1 = single-factor, aal2 = MFA
-- verified this session) — see https://supabase.com/blog/mfa-auth-via-rls.

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = auth.uid()),
    false
  ) AND (auth.jwt() ->> 'aal') = 'aal2';
$$;

CREATE OR REPLACE FUNCTION is_app_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'manager') FROM profiles WHERE id = auth.uid()),
    false
  ) AND (auth.jwt() ->> 'aal') = 'aal2';
$$;

COMMENT ON FUNCTION is_app_admin() IS
  'True only for role=admin AND a step-up-verified (aal2) session — TOTP enrollment is mandatory for admin.';
COMMENT ON FUNCTION is_app_staff() IS
  'True only for role IN (admin, manager) AND a step-up-verified (aal2) session — TOTP enrollment is mandatory for staff.';
