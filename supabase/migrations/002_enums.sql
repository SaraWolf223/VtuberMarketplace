-- Local Marketplace: enum types
CREATE TYPE listing_status AS ENUM (
  'draft',
  'active',
  'sold',
  'expired',
  'deleted'
);

CREATE TYPE listing_category AS ENUM (
  'electronics',
  'gaming',
  'furniture',
  'clothing',
  'home',
  'collectibles',
  'toys',
  'automotive',
  'sports_outdoors',
  'miscellaneous'
);

CREATE TYPE report_target_type AS ENUM ('listing', 'user');

CREATE TYPE report_reason AS ENUM (
  'scam',
  'spam',
  'prohibited_item',
  'harassment',
  'counterfeit',
  'stolen',
  'misleading',
  'other'
);

CREATE TYPE report_status AS ENUM ('open', 'reviewed', 'actioned', 'dismissed');

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE boost_source AS ENUM ('paid', 'premium_credit');
