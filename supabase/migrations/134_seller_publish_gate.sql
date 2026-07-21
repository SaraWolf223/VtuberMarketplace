-- VtuberMarketplace: defense-in-depth DB trigger enforcing the seller Connect/phone
-- publish gate (primary enforcement lives in the create-listing/update-listing edge
-- functions; this trigger guards direct-REST/PostgREST paths too).

CREATE OR REPLACE FUNCTION listings_enforce_seller_publish_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ready BOOLEAN;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT connect_charges_enabled AND connect_payouts_enabled AND phone_verified_at IS NOT NULL
    INTO v_ready
    FROM profiles WHERE id = NEW.seller_id;

    IF NOT COALESCE(v_ready, FALSE) THEN
      RAISE EXCEPTION 'SELLER_NOT_PAYOUT_READY: seller must complete Stripe Connect onboarding and phone verification before publishing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_seller_publish_gate ON listings;
CREATE TRIGGER listings_seller_publish_gate
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_enforce_seller_publish_gate();

COMMENT ON TRIGGER listings_seller_publish_gate ON listings IS
  'Defense-in-depth: primary validation happens in the create-listing/update-listing edge functions.';
