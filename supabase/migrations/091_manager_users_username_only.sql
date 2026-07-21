-- Managers: username-only user directory (no emails). Admins: full user list.

CREATE OR REPLACE FUNCTION list_staff_users_page(
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
  v_page_size int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_fetch int := v_page_size + 1;
  v_is_admin boolean;
  v_items json;
  v_total int;
  v_has_more boolean;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_is_admin := is_app_admin();

  IF v_is_admin THEN
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    INTO v_items
    FROM (
      SELECT
        id,
        email,
        username,
        display_name,
        role,
        created_at,
        banned_at,
        shadow_banned
      FROM profiles
      ORDER BY created_at DESC
      LIMIT v_fetch
      OFFSET v_offset
    ) r;
  ELSE
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    INTO v_items
    FROM (
      SELECT id, username, banned_at, shadow_banned
      FROM profiles
      ORDER BY username ASC
      LIMIT v_fetch
      OFFSET v_offset
    ) r;
  END IF;

  v_total := json_array_length(v_items);
  v_has_more := v_total > v_page_size;

  IF v_has_more THEN
    SELECT COALESCE(json_agg(elem), '[]'::json)
    INTO v_items
    FROM (
      SELECT elem
      FROM json_array_elements(v_items) WITH ORDINALITY AS t(elem, ord)
      WHERE ord <= v_page_size
    ) trimmed;
  END IF;

  RETURN json_build_object(
    'items', COALESCE(v_items, '[]'::json),
    'next_offset', CASE WHEN v_has_more THEN v_offset + v_page_size ELSE NULL END,
    'limited', NOT v_is_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION list_staff_users_page(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_staff_users_page(int, int) TO authenticated;
