-- Profile bulletin board: one current post per profile, with comments.

ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'bulletin_post';
ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'bulletin_comment';

CREATE TABLE profile_bulletin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  hidden_at TIMESTAMPTZ,
  hidden_by UUID REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX profile_bulletin_posts_one_current
  ON profile_bulletin_posts (author_id)
  WHERE is_current;

CREATE INDEX profile_bulletin_posts_author_idx
  ON profile_bulletin_posts (author_id, created_at DESC);

CREATE TABLE profile_bulletin_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES profile_bulletin_posts (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  hidden_at TIMESTAMPTZ,
  hidden_by UUID REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profile_bulletin_comments_post_idx
  ON profile_bulletin_comments (post_id, created_at);

ALTER TABLE profile_bulletin_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_bulletin_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_bulletin_posts_select_visible ON profile_bulletin_posts
  FOR SELECT TO anon, authenticated
  USING (
    hidden_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_bulletin_posts.author_id
        AND p.banned_at IS NULL AND p.shadow_banned = FALSE
    )
  );

CREATE POLICY profile_bulletin_posts_select_own ON profile_bulletin_posts
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR is_app_staff());

CREATE POLICY profile_bulletin_comments_select_visible ON profile_bulletin_comments
  FOR SELECT TO anon, authenticated
  USING (
    hidden_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profile_bulletin_posts p
      WHERE p.id = profile_bulletin_comments.post_id
        AND p.hidden_at IS NULL
    )
  );

CREATE POLICY profile_bulletin_comments_select_own ON profile_bulletin_comments
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR is_app_staff());

CREATE OR REPLACE FUNCTION set_bulletin_post(p_body TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_trimmed TEXT := btrim(p_body);
  v_banned TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 500 THEN
    RETURN json_build_object('error', 'INVALID_BODY');
  END IF;

  IF NOT is_email_verified(v_uid) THEN
    RETURN json_build_object('error', 'EMAIL_VERIFICATION_REQUIRED');
  END IF;

  v_banned := find_banned_keyword_in_text(v_trimmed);
  IF v_banned IS NOT NULL THEN
    RETURN json_build_object('error', 'BANNED_KEYWORD', 'keyword', v_banned);
  END IF;

  UPDATE profile_bulletin_posts
  SET is_current = FALSE
  WHERE author_id = v_uid AND is_current;

  INSERT INTO profile_bulletin_posts (author_id, body, is_current)
  VALUES (v_uid, v_trimmed, TRUE)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', TRUE, 'post_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION set_bulletin_post(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_bulletin_post(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_current_bulletin(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post profile_bulletin_posts%ROWTYPE;
  v_comment_count INT;
BEGIN
  SELECT * INTO v_post
  FROM profile_bulletin_posts
  WHERE author_id = p_user_id AND is_current AND hidden_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('post', NULL, 'comment_count', 0);
  END IF;

  SELECT COUNT(*)::INT INTO v_comment_count
  FROM profile_bulletin_comments
  WHERE post_id = v_post.id AND hidden_at IS NULL;

  RETURN json_build_object(
    'post', json_build_object(
      'id', v_post.id,
      'author_id', v_post.author_id,
      'body', v_post.body,
      'created_at', v_post.created_at
    ),
    'comment_count', v_comment_count
  );
END;
$$;

REVOKE ALL ON FUNCTION get_current_bulletin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_bulletin(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION list_bulletin_comments(
  p_post_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSON;
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_bulletin_posts WHERE id = p_post_id AND hidden_at IS NULL
  ) THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
  INTO v_items
  FROM (
    SELECT
      c.id,
      c.post_id,
      c.author_id,
      c.body,
      c.created_at,
      p.username AS author_username,
      p.display_name AS author_display_name,
      p.avatar_url AS author_avatar_url
    FROM profile_bulletin_comments c
    JOIN profiles p ON p.id = c.author_id
    WHERE c.post_id = p_post_id
      AND c.hidden_at IS NULL
      AND p.banned_at IS NULL
      AND p.shadow_banned = FALSE
    ORDER BY c.created_at ASC
    LIMIT v_limit
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) r;

  RETURN json_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION list_bulletin_comments(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_bulletin_comments(UUID, INT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION add_bulletin_comment(p_post_id UUID, p_body TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_trimmed TEXT := btrim(p_body);
  v_banned TEXT;
  v_recent INT;
  v_id UUID;
  v_author UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 300 THEN
    RETURN json_build_object('error', 'INVALID_BODY');
  END IF;

  IF NOT is_email_verified(v_uid) THEN
    RETURN json_build_object('error', 'EMAIL_VERIFICATION_REQUIRED');
  END IF;

  SELECT author_id INTO v_author
  FROM profile_bulletin_posts
  WHERE id = p_post_id AND is_current AND hidden_at IS NULL;

  IF v_author IS NULL THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  IF users_are_blocked(v_uid, v_author) THEN
    RETURN json_build_object('error', 'BLOCKED');
  END IF;

  v_banned := find_banned_keyword_in_text(v_trimmed);
  IF v_banned IS NOT NULL THEN
    RETURN json_build_object('error', 'BANNED_KEYWORD', 'keyword', v_banned);
  END IF;

  SELECT COUNT(*)::INT INTO v_recent
  FROM profile_bulletin_comments
  WHERE author_id = v_uid AND created_at > NOW() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RETURN json_build_object('error', 'RATE_LIMITED');
  END IF;

  INSERT INTO profile_bulletin_comments (post_id, author_id, body)
  VALUES (p_post_id, v_uid, v_trimmed)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', TRUE, 'comment_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION add_bulletin_comment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_bulletin_comment(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION staff_hide_bulletin_post(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE profile_bulletin_posts
  SET hidden_at = NOW(), hidden_by = auth.uid(), is_current = FALSE
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN json_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION staff_hide_bulletin_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_hide_bulletin_post(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION staff_hide_bulletin_comment(p_comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE profile_bulletin_comments
  SET hidden_at = NOW(), hidden_by = auth.uid()
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN json_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION staff_hide_bulletin_comment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_hide_bulletin_comment(UUID) TO authenticated;
