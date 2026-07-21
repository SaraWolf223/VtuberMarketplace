-- 101: Staff email redaction for moderation/admin list reads.
--
-- Managers must never receive PII (emails) — only admins do. Previously the
-- warned-users, banned-users, moderation-log, and college-student lists read
-- `profiles` directly over PostgREST with `email` embedded. RLS is row-level,
-- so any staff member who can read the row also gets the email column. This
-- mirrors the established pattern in migration 091 (list_staff_users_page):
-- SECURITY DEFINER functions gated by is_app_admin() that null out email for
-- non-admins. This is the real boundary (not just UI gating) because a manager
-- token could otherwise query the email column directly.

-- 1) Warned users — raw warn rows; the client groups them by target.
CREATE OR REPLACE FUNCTION list_warned_users()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_items json;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_admin := is_app_admin();

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
  INTO v_items
  FROM (
    SELECT
      ma.id,
      ma.target_user_id,
      ma.created_at,
      ma.notes,
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
        'id', p.id,
        'email', CASE WHEN v_admin THEN p.email ELSE NULL END,
        'username', p.username,
        'display_name', p.display_name,
        'banned_at', p.banned_at
      ) END AS target
    FROM moderation_actions ma
    LEFT JOIN profiles p ON p.id = ma.target_user_id
    WHERE ma.action = 'warn_user'
    ORDER BY ma.created_at DESC
    LIMIT 500
  ) r;

  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION list_warned_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_warned_users() TO authenticated;

-- 2) Banned users.
CREATE OR REPLACE FUNCTION list_banned_users()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_items json;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_admin := is_app_admin();

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
  INTO v_items
  FROM (
    SELECT
      id,
      CASE WHEN v_admin THEN email ELSE NULL END AS email,
      username,
      display_name,
      role,
      created_at,
      banned_at
    FROM profiles
    WHERE banned_at IS NOT NULL
    ORDER BY banned_at DESC
  ) r;

  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION list_banned_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_banned_users() TO authenticated;

-- 3) Moderation action log (paginated). Redacts the acting admin's email.
CREATE OR REPLACE FUNCTION list_moderation_log(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_items json;
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_admin := is_app_admin();

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
  INTO v_items
  FROM (
    SELECT
      ma.id,
      ma.action,
      ma.created_at,
      ma.notes,
      ma.target_user_id,
      ma.listing_id,
      ma.report_id,
      CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
        'display_name', a.display_name,
        'email', CASE WHEN v_admin THEN a.email ELSE NULL END
      ) END AS admin
    FROM moderation_actions ma
    LEFT JOIN profiles a ON a.id = ma.admin_id
    ORDER BY ma.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) r;

  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION list_moderation_log(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_moderation_log(int, int) TO authenticated;

-- 4) Active college-student verifications. Redacts both account + .edu emails.
CREATE OR REPLACE FUNCTION list_college_students()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_items json;
  v_now timestamptz := now();
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_admin := is_app_admin();

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
  INTO v_items
  FROM (
    SELECT
      id,
      CASE WHEN v_admin THEN email ELSE NULL END AS email,
      username,
      display_name,
      role,
      created_at,
      banned_at,
      phone,
      phone_verified_at,
      is_premium,
      premium_until,
      CASE WHEN v_admin THEN college_edu_email ELSE NULL END AS college_edu_email,
      college_badge_verified_at,
      college_badge_expires_at
    FROM profiles
    WHERE college_edu_email IS NOT NULL
      AND college_badge_verified_at IS NOT NULL
      AND college_badge_expires_at > v_now
    ORDER BY college_badge_verified_at DESC
  ) r;

  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION list_college_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_college_students() TO authenticated;
