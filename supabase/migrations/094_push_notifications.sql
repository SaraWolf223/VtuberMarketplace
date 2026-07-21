-- Push notifications: device-token RPCs + auto-send Expo push on every new
-- in-app notification. All notifications already flow through
-- create_notification() (037_in_app_notifications.sql), so a single AFTER
-- INSERT trigger on `notifications` covers messages, deals, reviews, listing
-- status changes, and expiry reminders.
--
-- Delivery uses pg_net (async HTTP) to call the Expo push API directly. Push
-- failures are swallowed so they can never block the in-app notification insert.
-- Android delivery additionally requires FCM credentials uploaded to Expo and
-- an EAS projectId on the client (see docs/00-Developer_Setup.md).

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Device token RPCs (client opt-in) ──────────────────────────────────────

-- Stores the current user's Expo push token. user_prefs always exists for a
-- signed-in user because home ZIP/location is required at onboarding.
CREATE OR REPLACE FUNCTION set_my_push_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  UPDATE user_prefs
  SET push_token = p_token, updated_at = NOW()
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'NO_PREFS');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

-- Clears the stored token so the backend stops targeting this device.
CREATE OR REPLACE FUNCTION clear_my_push_token()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_prefs
  SET push_token = NULL, updated_at = NOW()
  WHERE user_id = v_uid;

  RETURN json_build_object('ok', true);
END;
$$;

-- Returns the current user's stored token (NULL when push is off).
CREATE OR REPLACE FUNCTION get_my_push_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT push_token FROM user_prefs WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION set_my_push_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_my_push_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_my_push_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_my_push_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_my_push_token() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_push_token() TO authenticated;

-- ── Auto-send Expo push when a notification row is inserted ─────────────────
CREATE OR REPLACE FUNCTION send_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_notify_expiry BOOLEAN;
BEGIN
  SELECT push_token, notify_expiry
  INTO v_token, v_notify_expiry
  FROM user_prefs
  WHERE user_id = NEW.user_id;

  -- No device registered (push off) → nothing to deliver.
  IF v_token IS NULL OR v_token NOT LIKE 'ExponentPushToken%' THEN
    RETURN NEW;
  END IF;

  -- Respect the user's expiry-reminder preference.
  IF NEW.kind = 'listing_expiring' AND v_notify_expiry IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := jsonb_build_object(
        'to', v_token,
        'title', NEW.title,
        'body', NEW.body,
        'sound', 'default',
        'channelId', 'default',
        'priority', 'high',
        'data', jsonb_build_object(
          'notification_id', NEW.id,
          'kind', NEW.kind,
          'listing_id', NEW.listing_id,
          'conversation_id', NEW.conversation_id
        )
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Never let a push transport error roll back the notification insert.
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_send_push ON notifications;
CREATE TRIGGER notifications_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_for_notification();
