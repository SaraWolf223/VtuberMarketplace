-- Defensive provenance column for premium status.
-- Comp/promo grants are set by admins via the service-role admin-action function.
-- Today comps are already safe (no downgrade cron; Stripe sync only runs for users
-- with a real subscription). This column lets any future reconciliation skip non-Stripe grants.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS premium_source TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_premium_source_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_premium_source_check
  CHECK (premium_source IN ('stripe', 'comp', 'promo'));
