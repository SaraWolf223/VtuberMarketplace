-- Prompt 16: sync verified phone from auth.users → profiles; gate listing create

CREATE OR REPLACE FUNCTION complete_phone_verification()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT;
  v_confirmed TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT phone, phone_confirmed_at
  INTO v_phone, v_confirmed
  FROM auth.users
  WHERE id = v_uid;

  IF v_phone IS NULL OR v_confirmed IS NULL THEN
    RETURN json_build_object('error', 'PHONE_NOT_CONFIRMED');
  END IF;

  UPDATE profiles
  SET
    phone = v_phone,
    phone_verified_at = COALESCE(phone_verified_at, NOW()),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN json_build_object('ok', true, 'phone', v_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION complete_phone_verification() TO authenticated;
