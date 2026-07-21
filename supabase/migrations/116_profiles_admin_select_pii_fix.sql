-- Critical PII/RLS fixes found in the full-audit pass:
--
-- 1) `profiles_select_admin` (088_manager_role_rls.sql) used is_app_staff(), which is true for
--    admin AND manager. RLS is row-level only, so this let any manager's JWT read every column
--    on `profiles` directly over PostgREST -- including `email` and `phone` -- bypassing every
--    SECURITY DEFINER redaction RPC added in 091/101 (list_staff_users_page, list_banned_users,
--    list_warned_users, list_moderation_log, list_college_students). Restrict the raw table
--    SELECT to true admins only.
--
-- 2) The one legitimate staff (not just admin) direct-table read this removes --
--    `fetchModerationTargetState` in admin-service.ts, used to show inline ban/shadow-ban state
--    for both roles -- is moved to a SECURITY DEFINER RPC that returns only non-PII columns
--    (id, role, banned_at, shadow_banned), so managers keep the moderation UI without regaining
--    column-level access to email/phone.
--
-- 3) `waitlist_signups_admin_select` (082_waitlist_founding_codes.sql) checked raw
--    `role = 'admin'` instead of is_app_admin(), skipping the mandatory aal2 (2FA step-up) check
--    every other admin policy enforces. Fixed to use is_app_admin().
--
-- 4) `fetchPublicProfile`'s staff fallback (review-service.ts, for viewing a banned/hidden
--    seller's profile from a report) also relied on the now-admin-only `profiles_select_admin`
--    policy. It only ever needed non-PII columns, so it gets the same RPC treatment rather than
--    losing manager access outright.
--
-- 5) `list_college_students` (091/101) redacted `email` and `college_edu_email` for managers but
--    left `phone` unredacted -- an inconsistent PII rule for the same row. The client already
--    filters managers down to zero rows here (college_edu_email is required to keep a row), but
--    fix the RPC itself so a manager calling it directly can't read phone numbers either.

DROP POLICY IF EXISTS profiles_select_admin ON profiles;
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT TO authenticated USING (is_app_admin());

CREATE OR REPLACE FUNCTION get_moderation_target_state(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, role, banned_at, shadow_banned
  INTO v_row
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'role', v_row.role,
    'banned_at', v_row.banned_at,
    'shadow_banned', v_row.shadow_banned
  );
END;
$$;

REVOKE ALL ON FUNCTION get_moderation_target_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_moderation_target_state(uuid) TO authenticated;

DROP POLICY IF EXISTS waitlist_signups_admin_select ON waitlist_signups;
CREATE POLICY waitlist_signups_admin_select ON waitlist_signups
  FOR SELECT TO authenticated
  USING (is_app_admin());

CREATE OR REPLACE FUNCTION get_staff_visible_profile(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, username, display_name, avatar_url, rating_avg, rating_count, listing_count,
         is_premium, created_at
  INTO v_row
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'display_name', v_row.display_name,
    'avatar_url', v_row.avatar_url,
    'rating_avg', v_row.rating_avg,
    'rating_count', v_row.rating_count,
    'listing_count', v_row.listing_count,
    'is_premium', v_row.is_premium,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION get_staff_visible_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_staff_visible_profile(uuid) TO authenticated;

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
      CASE WHEN v_admin THEN phone ELSE NULL END AS phone,
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
