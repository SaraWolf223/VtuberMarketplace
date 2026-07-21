-- Users cannot clear their own ban or shadow-ban via the client API (mirrors role protection in 054).

CREATE OR REPLACE FUNCTION protect_profile_moderation_fields_on_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
    IF OLD.banned_at IS DISTINCT FROM NEW.banned_at THEN
      NEW.banned_at := OLD.banned_at;
    END IF;
    IF OLD.shadow_banned IS DISTINCT FROM NEW.shadow_banned THEN
      NEW.shadow_banned := OLD.shadow_banned;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_moderation_fields ON profiles;
CREATE TRIGGER profiles_protect_moderation_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_moderation_fields_on_self_update();

-- Admin can manage banned keyword list from the app.
DROP POLICY IF EXISTS banned_keywords_admin_all ON banned_keywords;
CREATE POLICY banned_keywords_admin_all ON banned_keywords
  FOR ALL
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());
