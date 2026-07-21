-- VtuberMarketplace domain conversion: drop tables/columns that only existed for the
-- hyperlocal physical-goods prototype (geo discovery, college verification, waitlist,
-- founding-seller/seed program, boost/premium, meetup phone-reveal, listing_interest).
-- These are dropped rather than repurposed because their shape doesn't map cleanly
-- onto the new domain (replacements are created fresh in later migrations).

-- --- Geo / ZIP discovery -----------------------------------------------------------
DROP TABLE IF EXISTS zip_centroids CASCADE;

-- --- College verification ----------------------------------------------------------
DROP FUNCTION IF EXISTS college_badge_is_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS set_feed_college_students_only(BOOLEAN) CASCADE;
DROP TABLE IF EXISTS college_email_verification_codes CASCADE;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS college_edu_email,
  DROP COLUMN IF EXISTS college_badge_verified_at,
  DROP COLUMN IF EXISTS college_badge_expires_at;

ALTER TABLE user_prefs
  DROP COLUMN IF EXISTS feed_college_students_only;

-- --- Waitlist / founding-seller / seed program --------------------------------------
DROP TABLE IF EXISTS waitlist_signups CASCADE;
DROP TABLE IF EXISTS ios_waitlist_signups CASCADE;
DROP TABLE IF EXISTS seed_payouts CASCADE;
DROP TABLE IF EXISTS founding_boost_credits CASCADE;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS is_founding_seller,
  DROP COLUMN IF EXISTS founding_seller_at;

-- --- Meetup phone-reveal / deal-agreement flow --------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN (
        'propose_contact_agreement', 'accept_contact_agreement',
        'get_conversation_contact_agreement', 'reveal_conversation_phones',
        'reveal_seller_phone', 'mark_listing_sold_and_end_chat',
        'conversation_contact_unlocked'
      )
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

DROP TABLE IF EXISTS conversation_contact_agreements CASCADE;

-- --- listing_interest / deal_review_unlocks (review-eligibility gates) -------------
DROP TABLE IF EXISTS deal_review_unlocks CASCADE;
DROP TABLE IF EXISTS listing_interest CASCADE;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'record_listing_interest'
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

-- --- Boost / Premium monetization ---------------------------------------------------
DROP TABLE IF EXISTS boost_purchases CASCADE;
DROP TABLE IF EXISTS premium_subscriptions CASCADE;
DROP TABLE IF EXISTS premium_boost_credits CASCADE;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('apply_listing_boost', 'profile_premium_active', 'get_my_promo_boost_balance')
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

-- Geocoding RPC (edge-function-backed, no longer needed).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'geocode_zip'
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

-- Waitlist referral / stats RPCs.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('register_waitlist_signup', 'register_ios_waitlist_signup',
                        'get_waitlist_public_stats', 'get_referral_status')
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;
