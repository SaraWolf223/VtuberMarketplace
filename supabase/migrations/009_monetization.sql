-- Local Marketplace: boosts and premium
CREATE TABLE boost_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount_cents INT NOT NULL DEFAULT 100,
  source boost_source NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX boost_purchases_user_idx ON boost_purchases (user_id);
CREATE INDEX boost_purchases_listing_idx ON boost_purchases (listing_id);

CREATE TABLE premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX premium_subscriptions_active_user
  ON premium_subscriptions (user_id)
  WHERE status = 'active';

CREATE TABLE premium_boost_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  credits_total INT NOT NULL DEFAULT 5,
  credits_used INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_start)
);

CREATE INDEX premium_boost_credits_user_idx ON premium_boost_credits (user_id);
