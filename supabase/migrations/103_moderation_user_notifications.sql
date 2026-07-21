-- Deliver moderation reasons to the affected user.
-- Staff can now attach a reason when warning/banning a user or pausing/removing a
-- listing; that reason is surfaced to the user via the in-app notification center.

ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'account_warned';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'account_banned';
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'listing_removed';

-- Staff-only: create (or enrich) a user-facing notification explaining a
-- moderation action and its reason. Runs as definer so it can call the
-- locked-down create_notification helper.
CREATE OR REPLACE FUNCTION notify_moderation_action(
  p_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_listing_id uuid DEFAULT NULL,
  p_listing_title text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_reason), '');
  v_title text;
  v_body text;
  v_updated int;
BEGIN
  IF NOT is_app_staff() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false);
  END IF;

  IF p_action = 'warn_user' THEN
    v_title := 'Warning from Local Marketplace';
    v_body := 'Our moderation team issued a warning on your account.'
      || CASE WHEN v_reason IS NOT NULL THEN ' Reason: ' || v_reason ELSE '' END;
    PERFORM create_notification(p_user_id, 'account_warned', v_title, v_body, NULL, NULL, NULL);

  ELSIF p_action = 'ban_user' THEN
    v_title := 'Account suspended';
    v_body := 'Your Local Marketplace account has been banned.'
      || CASE WHEN v_reason IS NOT NULL THEN ' Reason: ' || v_reason ELSE '' END;
    PERFORM create_notification(p_user_id, 'account_banned', v_title, v_body, NULL, NULL, NULL);

  ELSIF p_action = 'delete_listing' THEN
    -- listing_id is intentionally NULL: the listing no longer exists.
    v_title := 'Listing removed';
    v_body := '"' || COALESCE(p_listing_title, 'Your listing')
      || '" was removed by our moderation team.'
      || CASE WHEN v_reason IS NOT NULL THEN ' Reason: ' || v_reason ELSE '' END;
    PERFORM create_notification(p_user_id, 'listing_removed', v_title, v_body, NULL, NULL, NULL);

  ELSIF p_action = 'pause_listing' THEN
    -- The status-change trigger already posted a generic "under review" notice.
    -- Append the staff reason to it (no duplicate); fall back to a fresh notice.
    IF v_reason IS NOT NULL THEN
      UPDATE notifications
      SET body = body || ' Reason: ' || v_reason
      WHERE id = (
        SELECT id FROM notifications
        WHERE user_id = p_user_id
          AND kind = 'listing_paused'
          AND (p_listing_id IS NULL OR listing_id = p_listing_id)
          AND created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY created_at DESC
        LIMIT 1
      );
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 0 THEN
        PERFORM create_notification(
          p_user_id,
          'listing_paused',
          'Listing under review',
          '"' || COALESCE(p_listing_title, 'Your listing')
            || '" was paused by our moderation team. Reason: ' || v_reason,
          p_listing_id,
          NULL,
          NULL
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION notify_moderation_action(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notify_moderation_action(uuid, text, text, uuid, text) TO authenticated;
