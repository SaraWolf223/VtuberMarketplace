# VtuberMarketplace — Database Schemas

**Version:** 2.0
**Database:** PostgreSQL 15+ (Supabase)
**Extensions required:** none beyond Supabase defaults — `postgis` is **removed** (no geo queries in this domain)

This document describes the **target schema** for the VTuber digital-asset marketplace. It is implemented as a set of **additive forward migrations** (`121_*.sql` onward) layered on top of the original hyperlocal-marketplace migrations (`001`–`120`), which drop/replace the physical-marketplace-only tables (`zip_centroids`, college-verification tables, `waitlist_signups`/`ios_waitlist_signups`, `seed_payouts`/`founding_boost_credits`, `conversation_contact_agreements`, `boost_purchases`/`premium_subscriptions`/`premium_boost_credits`, `listing_interest`) rather than editing migration history in place.

---

## 1. Enum types

```sql
-- New/replaced enums (migration 121_vtuber_enums.sql)
CREATE TYPE asset_type AS ENUM (
  'live2d_2d', 'model_3d', 'pngtuber', 'accessory_prop',
  'background_overlay', 'base_model', 'other'
);

CREATE TYPE license_type AS ENUM ('otu', 'p2u');

CREATE TYPE addon_kind AS ENUM ('customization', 'setup');

CREATE TYPE support_duration AS ENUM ('none', '30_days', '90_days', 'lifetime');

CREATE TYPE order_status AS ENUM (
  'pending_payment', 'awaiting_fulfillment', 'fulfilled', 'refunded', 'cancelled'
);

CREATE TYPE strike_source AS ENUM ('automated_check', 'buyer_report');

CREATE TYPE performance_rank AS ENUM ('excellent', 'good', 'medium', 'poor');

-- listing_status gains 'paused' (link-health auto-pause) alongside the existing
-- 'draft' / 'active' / 'sold' / 'deleted'; 'expired' is retired (no fixed expiry).
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'paused';

-- report_reason gains new digital-marketplace reasons.
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'ai_generated_content';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'download_link_not_working';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'stolen_content';
```

`listing_category` stays retired as an enum (unchanged from migrations 109–110 — `listing_categories` table + `listings.category TEXT` FK, reseeded for the new domain, §11).

---

## 2. Tables overview

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users`; gains Stripe Connect + Pro Seller fields |
| `listings` | Core VTuber digital assets — reworked (§3.3) |
| `listing_images` | Image metadata + storage paths (unchanged, min raised to 3) |
| `listing_addon_options` | Seller-defined customization/setup fees (§3.4, new) |
| `favorites` | Saved listings (unchanged) |
| `reviews` | Purchase-verified buyer reviews (§3.7, gate reworked) |
| `orders` | A completed/in-progress purchase (§3.9, new — replaces the absence of real item payments) |
| `order_addons` | Stackable customization/setup selections per order (§3.10, new) |
| `order_deliverables` | Seller-submitted deliverable link for add-on orders (§3.11, new) |
| `link_health_checks` | Scheduled + reported download-link health tracking (§3.12, new) |
| `seller_strikes` | Confirmed broken-link strikes, 12-month rolling window (§3.13, new) |
| `pro_seller_subscriptions` | Stripe Subscription mirror for Pro Seller (§3.14, new — replaces `premium_subscriptions`) |
| `featured_listing_credits` | Monthly Featured credits for Pro Seller subscribers (§3.15, new — replaces `premium_boost_credits`) |
| `featured_listing_purchases` | Pay-per-use Featured placement purchases (§3.16, new — replaces `boost_purchases`) |
| `reports` | Moderation reports (unchanged shape, new reasons) |
| `moderation_actions` | Admin audit log (unchanged) |
| `banned_keywords` | Keyword filter list (unchanged) |
| `public_app_config` | Runtime config: branding, fee tiers, grace period, strike window — public read, admin write (§11) |
| `listing_categories` | Admin add/edit/reorder/deactivate categories, reseeded for VTuber domain (§11) |
| `email_templates` | Admin-editable transactional email copy (unchanged) |
| `promo_codes` / `promo_redemptions` | Generalized purchase-discount codes, decoupled from founding-seller (§9) |
| `conversations` / `conversation_participants` / `messages` | In-app DM (unchanged structure; gate changes from phone → email verification) |
| `blocks` | User blocks (unchanged) |

**Dropped** (migration `122_drop_physical_marketplace_tables.sql`): `zip_centroids`, `college_students`/college-verification tables, `waitlist_signups`, `ios_waitlist_signups`, `seed_payouts`, `founding_boost_credits`, `conversation_contact_agreements`, `listing_interest`, `boost_purchases`, `premium_subscriptions`, `premium_boost_credits`.

---

## 3. Table definitions

### 3.1 `profiles` (additive changes, migration `123_profiles_connect_fields.sql`)

```sql
ALTER TABLE profiles
  ADD COLUMN stripe_connect_account_id TEXT UNIQUE,
  ADD COLUMN connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN connect_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN connect_details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN phone_verified_at TIMESTAMPTZ,  -- already exists from migration 032; reused as the Connect-publish gate
  ADD COLUMN is_pro_seller BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN pro_seller_until TIMESTAMPTZ,
  ADD COLUMN shop_banner_url TEXT,
  ADD COLUMN shop_accent_color TEXT CHECK (shop_accent_color IS NULL OR shop_accent_color ~ '^#[0-9a-fA-F]{6}$');
```

`is_premium`/`premium_until`/`premium_source`/`is_founding_seller`/`founding_seller_at` (from the physical-marketplace build) are dropped in the same migration — replaced by `is_pro_seller`/`pro_seller_until`.

**Seller publish gate:** a listing can only move to `active` if the seller has `connect_charges_enabled = TRUE AND connect_payouts_enabled = TRUE AND phone_verified_at IS NOT NULL` (enforced in the `create-listing`/`publish-listing` edge function, not just client-side).

### 3.2 `user_prefs` (simplified)

ZIP/radius/location columns (`home_zip`, `home_location`, `radius_miles`) and their GIST index are **dropped** (migration `124_drop_geo_columns.sql`) — no geo discovery in this domain. `push_token`, `notify_expiry`→renamed `notify_link_issues`, `notify_boost_deals`→renamed `notify_order_updates` are kept.

### 3.3 `listings` (reworked, migration `125_listings_vtuber_rework.sql`)

```sql
ALTER TABLE listings
  DROP COLUMN zip_code,
  DROP COLUMN location,     -- GEOGRAPHY(POINT); drops the GIST index with it
  DROP COLUMN expires_at,
  DROP COLUMN purge_at,
  RENAME COLUMN boosted_until TO featured_until;

ALTER TABLE listings
  ALTER COLUMN image_count SET DEFAULT 0,
  ADD CONSTRAINT listings_image_count_min CHECK (image_count >= 3 AND image_count <= 5);

ALTER TABLE listings
  ADD COLUMN asset_type asset_type NOT NULL DEFAULT 'other',
  ADD COLUMN license_type license_type NOT NULL DEFAULT 'p2u',
  ADD COLUMN license_text TEXT NOT NULL DEFAULT '' CHECK (char_length(license_text) <= 4000),
  ADD COLUMN download_url TEXT,  -- required before publish; validated as a well-formed https URL
  ADD COLUMN youtube_video_url TEXT,     -- required before publish
  ADD COLUMN youtube_video_id TEXT,      -- parsed from the URL, used for embeds + oEmbed re-checks
  ADD COLUMN youtube_video_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (youtube_video_status IN ('unchecked','valid','invalid','removed')),
  ADD COLUMN is_mature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN support_duration support_duration NOT NULL DEFAULT 'none',
  ADD COLUMN compatible_software TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN file_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN includes_source_files BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN credits_text TEXT CHECK (credits_text IS NULL OR char_length(credits_text) <= 1000),
  ADD COLUMN changelog JSONB NOT NULL DEFAULT '[]',  -- [{ "version": "1.1", "note": "Fixed toggle", "at": "2026-07-21" }]
  -- Live2D (2D) fields
  ADD COLUMN cubism_version TEXT,
  ADD COLUMN has_physics BOOLEAN,
  ADD COLUMN expression_count INT CHECK (expression_count IS NULL OR expression_count >= 0),
  ADD COLUMN parameter_notes TEXT CHECK (parameter_notes IS NULL OR char_length(parameter_notes) <= 1000),
  ADD COLUMN includes_psd_source BOOLEAN,
  -- 3D model/accessory fields
  ADD COLUMN platform_compatibility TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'pc','quest'}
  ADD COLUMN triangle_count_pc INT CHECK (triangle_count_pc IS NULL OR triangle_count_pc >= 0),
  ADD COLUMN triangle_count_quest INT CHECK (triangle_count_quest IS NULL OR triangle_count_quest >= 0),
  ADD COLUMN performance_rank performance_rank,
  ADD COLUMN rig_type TEXT CHECK (rig_type IS NULL OR rig_type IN ('physbones','dynamic_bones','other')),
  ADD COLUMN supports_full_body_tracking BOOLEAN,
  ADD COLUMN toggle_list TEXT[] NOT NULL DEFAULT '{}',       -- e.g. {'Hat toggle','Jacket toggle'}
  ADD COLUMN required_tools TEXT CHECK (required_tools IS NULL OR char_length(required_tools) <= 500),
  ADD COLUMN compatible_base_avatar TEXT,
  -- PNGtuber fields
  ADD COLUMN included_states TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {'idle','talking','blink'}
  ADD COLUMN setup_instructions TEXT CHECK (setup_instructions IS NULL OR char_length(setup_instructions) <= 2000);

CREATE INDEX listings_asset_type_idx ON listings (asset_type);
CREATE INDEX listings_license_type_idx ON listings (license_type);
CREATE INDEX listings_featured_idx ON listings (featured_until DESC NULLS LAST);
CREATE INDEX listings_compatible_software_idx ON listings USING GIN (compatible_software);
```

**`listings.status` semantics (reworked):** `draft` → `active` → (`sold` if OTU and purchased) | (`paused` if the link-health/strike pipeline auto-pauses it for a broken `download_url`) → `deleted` (soft-delete). No `expired` transition.

**Triggers (replace the old lifecycle trigger):**

- `BEFORE INSERT`: no longer sets `expires_at`/`purge_at`; instead validates `asset_type`-conditional required fields server-side as a defense-in-depth backstop to client validation.
- `BEFORE UPDATE`: if `status` → `sold`, set `sold_at = now()` (unchanged); **new** — if `license_type = 'otu'` and an order for this listing reaches `fulfilled`, a trigger/RPC sets `status = 'sold'`.
- `AFTER INSERT/DELETE`: maintain `profiles.listing_count` (unchanged).

Draft cleanup (no more expiry cron): a lightweight `draft_created_at`-based cron still purges abandoned `draft` listings after 24h (unchanged mechanism, just no longer tied to the removed `expires_at`/`purge_at` pair).

### 3.4 `listing_addon_options` (new, migration `126_listing_addons.sql`)

```sql
CREATE TABLE listing_addon_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind addon_kind NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  extra_fee_cents INT NOT NULL CHECK (extra_fee_cents > 0),
  estimated_turnaround TEXT CHECK (estimated_turnaround IS NULL OR char_length(estimated_turnaround) <= 60),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX listing_addon_options_listing_idx ON listing_addon_options (listing_id);
CREATE INDEX listing_addon_options_kind_idx ON listing_addon_options (listing_id, kind) WHERE active;
```

A listing may have any number of active `customization` and/or `setup` addon rows. A buyer selects zero or more of each at checkout (§3.10) — not limited to one of each kind.

### 3.5 `listing_images`

Unchanged shape; the `CHECK (sort_order >= 0 AND sort_order < 5)` constraint stays (max 5), and `listings.image_count` now enforces a **minimum of 3** (§3.3) rather than a minimum of 1.

### 3.6 `favorites`

Unchanged.

### 3.7 `reviews` (gate reworked, migration `127_purchase_verified_reviews.sql`)

```sql
-- Table shape unchanged:
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,  -- new FK: the fulfilled order that unlocks this review
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, listing_id)
);
```

**Eligibility (RPC `create_review`, replaces the old `listing_interest`/DM-count/deal-agreement paths entirely):** requires an `orders` row with `buyer_id = auth.uid()`, `listing_id = p_listing_id`, and `status = 'fulfilled'`. `listing_interest` and `deal_review_unlocks` are dropped.

### 3.8 `blocks`, `reports`, `moderation_actions`, `banned_keywords`

Unchanged shape. `reports.target_type` gains an `order`-scoped path for `download_link_not_working` (`reports.order_id UUID REFERENCES orders(id)`, nullable, alongside the existing `listing_id`/`reported_user_id` columns); `report_reason` gains `ai_generated_content`, `download_link_not_working`, `stolen_content` (§1).

### 3.9 `orders` (new, migration `128_orders.sql`)

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  license_type license_type NOT NULL,
  license_snapshot TEXT NOT NULL,             -- immutable copy of the listing's license_text at purchase time
  base_price_cents INT NOT NULL CHECK (base_price_cents > 0),
  addon_total_cents INT NOT NULL DEFAULT 0 CHECK (addon_total_cents >= 0),
  total_cents INT NOT NULL CHECK (total_cents = base_price_cents + addon_total_cents),
  platform_fee_cents INT NOT NULL CHECK (platform_fee_cents >= 0),  -- snapshot of the 10%/8% commission actually applied
  fee_bps_applied INT NOT NULL,                -- 1000 or 800 at time of purchase, for audit
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  promo_code_id UUID REFERENCES promo_codes(id),
  status order_status NOT NULL DEFAULT 'pending_payment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE INDEX orders_listing_idx ON orders (listing_id);
CREATE INDEX orders_status_idx ON orders (status);
```

**Status flow:** `pending_payment` (Checkout session created) → (webhook `checkout.session.completed`) → `awaiting_fulfillment` (if any `order_addons` rows exist) or straight to `fulfilled` (no add-ons — the buyer already has `listings.download_url`) → seller submits `order_deliverables` → `fulfilled`. `refunded`/`cancelled` are terminal.

### 3.10 `order_addons` (new, migration `128_orders.sql`)

```sql
CREATE TABLE order_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  addon_option_id UUID NOT NULL REFERENCES listing_addon_options(id) ON DELETE RESTRICT,
  kind addon_kind NOT NULL,
  name_snapshot TEXT NOT NULL,       -- copy of listing_addon_options.name at purchase time
  fee_cents_snapshot INT NOT NULL CHECK (fee_cents_snapshot > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_addons_order_idx ON order_addons (order_id);
```

An order can carry any number of `order_addons` rows (multiple customization and/or setup selections stack additively into `orders.addon_total_cents`).

### 3.11 `order_deliverables` (new, migration `128_orders.sql`)

```sql
CREATE TABLE order_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  deliverable_url TEXT NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  delivered_by UUID NOT NULL REFERENCES profiles(id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Only populated for orders that had at least one `order_addons` row; the seller submits this once the customization/setup work is complete, which flips `orders.status` to `fulfilled`.

### 3.12 `link_health_checks` (new, migration `129_strike_system.sql`)

```sql
CREATE TABLE link_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_status_code INT,
  issue_open BOOLEAN NOT NULL DEFAULT FALSE,
  grace_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT link_health_checks_target_check CHECK (
    (listing_id IS NOT NULL AND order_id IS NULL) OR (listing_id IS NULL AND order_id IS NOT NULL)
  )
);

CREATE INDEX link_health_checks_open_idx ON link_health_checks (issue_open) WHERE issue_open;
```

### 3.13 `seller_strikes` (new, migration `129_strike_system.sql`)

```sql
CREATE TABLE seller_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  source strike_source NOT NULL,
  confirmed_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL   -- created_at + 12 months, rolling window
);

CREATE INDEX seller_strikes_seller_active_idx ON seller_strikes (seller_id) WHERE expires_at > NOW();
```

Active strike count = `COUNT(*) WHERE seller_id = ? AND expires_at > NOW()`. **3 active strikes → automatic ban** (reuses existing ban RPC/infrastructure).

### 3.14 `pro_seller_subscriptions` (new, migration `130_pro_seller.sql`, replaces `premium_subscriptions`)

```sql
CREATE TABLE pro_seller_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX pro_seller_subscriptions_active_user
  ON pro_seller_subscriptions (user_id)
  WHERE status = 'active';
```

### 3.15 `featured_listing_credits` (new, migration `130_pro_seller.sql`, replaces `premium_boost_credits`)

```sql
CREATE TABLE featured_listing_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  credits_total INT NOT NULL DEFAULT 4,
  credits_used INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_start)
);
```

### 3.16 `featured_listing_purchases` (new, migration `130_pro_seller.sql`, replaces `boost_purchases`)

```sql
CREATE TABLE featured_listing_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount_cents INT NOT NULL,
  duration_days INT NOT NULL DEFAULT 7,
  source TEXT NOT NULL DEFAULT 'paid' CHECK (source IN ('paid', 'pro_seller_credit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.17 `conversations`, `conversation_participants`, `messages`

Table shape unchanged from the original DM system. **Gate change (migration `131_dm_email_verification.sql`):** `send_conversation_message` now requires `profiles.email_confirmed_at IS NOT NULL` (Supabase Auth's own email-confirmation timestamp) instead of `is_phone_verified()`. `conversation_contact_agreements` (the meet/deal phone-reveal flow) and its RPCs (`propose_contact_agreement`, `accept_contact_agreement`, `reveal_conversation_phones`, `reveal_seller_phone`, `mark_listing_sold_and_end_chat`) are **dropped entirely** — there is no meetup/phone-reveal concept in a fully digital, remote marketplace. `mark_listing_sold_and_end_chat` is replaced by the order-fulfillment trigger (§3.3).

### 3.18 `webhook_events`, `rate_limit_events`, `listing_create_log`

Unchanged (Stripe idempotency, rate limiting, anti-farming — all still apply, now to Connect/Checkout events instead of boost/premium events).

---

## 4. RPC functions (required)

### 4.1 `get_feed_listings` (reworked — geo removed)

**Purpose:** single query for the global feed with Featured tier, filters, blocks, pagination.

| Param | Type | Description |
|-------|------|-------------|
| `p_category` | text | nullable; validated against `listing_categories.slug` |
| `p_asset_type` | asset_type | nullable |
| `p_license_type` | license_type | nullable |
| `p_max_price` | numeric | nullable |
| `p_min_price` | numeric | nullable |
| `p_compatible_software` | text | nullable — matches `compatible_software @> ARRAY[p_compatible_software]` |
| `p_has_customization` | boolean | nullable — filters to listings with an active `customization` addon |
| `p_has_setup` | boolean | nullable — filters to listings with an active `setup` addon |
| `p_support_duration` | support_duration | nullable |
| `p_is_mature` | boolean | nullable — `NULL`/`false` excludes mature listings by default (age-gated) |
| `p_status` | listing_status | default `active` |
| `p_search` | text | nullable |
| `p_sort` | text | `newest`, `price_low`, `price_high`, `featured` |
| `p_cursor` | text | opaque cursor |
| `p_limit` | int | default 20 |

**Returns:** JSON with `items[]` and `next_cursor`.

**Sort logic:** partition `featured_until > now()` first, then sort by `p_sort`, tie-break `id`. `ST_DWithin`/geo filtering is entirely removed — replaced by the filter set above.

### 4.2 `create_review`

Replaces the removed `record_listing_interest` path. Validates a `fulfilled` order exists for `(auth.uid(), p_listing_id)` before allowing the insert (§3.7).

### 4.3 `apply_featured_placement`

Sets `listings.featured_until`, inserts `featured_listing_purchases`, decrements Pro Seller `featured_listing_credits` if applicable (replaces `apply_listing_boost`).

### 4.4 `get_seller_dashboard_summary`

New RPC: returns the seller's Connect status (`charges_enabled`, `payouts_enabled`, `phone_verified_at`), open orders needing fulfillment, active strike count, and Pro Seller status — powers the seller dashboard header.

### 4.5 `list_staff_users_page`

Unchanged from the physical-marketplace build.

**Removed RPCs:** `geocode_zip`, `apply_listing_boost` (renamed, see §4.3), `register_waitlist_signup`, `get_waitlist_public_stats`, `get_referral_status`, `propose_contact_agreement`/`accept_contact_agreement`/`get_conversation_contact_agreement`/`reveal_conversation_phones`/`reveal_seller_phone`, `record_listing_interest`.

---

## 5. Row Level Security (RLS)

Same house rules as before: RLS enabled on every table, separate policies per operation, every policy column indexed, never `USING (true)` on PII-bearing tables.

### 5.1 `profiles`

Unchanged shape (public view hides `email`, `phone`, ban/strike fields, `stripe_connect_account_id`). New columns (`connect_charges_enabled`, `connect_payouts_enabled`, `is_pro_seller`) are added to `profiles_public` since they're safe/useful to show buyers (e.g. a "verified seller" or "Pro Seller" badge).

### 5.2 `listings`

Unchanged policy shape (owner CRUD, public read of `active`/`sold` for non-banned/non-blocked sellers). `INSERT`/`UPDATE` to `status = 'active'` additionally requires the seller-publish-gate check (§3.1) — enforced in the edge function, backstopped by a DB trigger that raises if the gate isn't met.

### 5.3 `listing_addon_options`

- SELECT: same visibility as parent listing (public if listing is visible)
- INSERT/UPDATE/DELETE: listing owner only

### 5.4 `orders`

- SELECT: `buyer_id = auth.uid()` OR `seller_id = auth.uid()` OR admin
- INSERT: service role only (created by `create-order-checkout` edge function after Stripe Checkout session creation)
- UPDATE: service role only (status transitions driven by webhook/fulfillment RPCs), except the seller-submitted `order_deliverables` insert path (§3.11, via a `SECURITY DEFINER` RPC that checks `seller_id = auth.uid()`)

### 5.5 `order_addons`, `order_deliverables`

- SELECT: same as parent order (`buyer_id`/`seller_id`/admin)
- INSERT: service role (`order_addons`, at checkout) or seller-scoped RPC (`order_deliverables`, at fulfillment)

### 5.6 `seller_strikes`, `link_health_checks`

- SELECT: `seller_id = auth.uid()` (own strikes/issues) OR admin
- INSERT/UPDATE: service role / admin edge functions only

### 5.7 `reviews`, `favorites`, `blocks`, `reports`

Owner-based CRUD with `auth.uid()`, unchanged pattern; `reviews` INSERT is RPC-only (§4.2).

### 5.8 Admin bypass

Unchanged pattern — `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))` per table as needed.

---

## 6. Storage buckets

| Bucket | Public | Path pattern |
|--------|--------|--------------|
| `listing-images` | Yes (read) | `{seller_id}/{listing_id}/{sort}.webp` — **preview photos only**; the sold asset file itself is never uploaded here |
| `branding` | Yes (read) | Admin logo uploads (unchanged) |

No new storage bucket is introduced for asset delivery — by design, the platform never stores the sold file (§5.2 of the PRD).

---

## 7. Cron jobs (pg_cron or Edge scheduled)

| Job | Schedule | Action |
|-----|----------|--------|
| `check-listing-links` | Every 6h | HTTP HEAD/GET check on every active listing's `download_url` and open `order_deliverables.deliverable_url`; updates `link_health_checks`, opens issues, auto-pauses listings (§3.12) |
| `check-youtube-videos` | Daily | oEmbed re-check of every listing's `youtube_video_url`; flags dead videos (`youtube_video_status = 'removed'`) without touching strikes |
| `purge_stale_drafts` | Daily 02:00 UTC | Delete `draft` listings older than 24h + storage cleanup |
| `reset_featured_listing_credits` | 1st of month | Insert new credit row for active Pro Seller subscribers |
| `expire_seller_strikes` | Daily | No-op table scan (strikes expire implicitly via `expires_at > NOW()` filter — kept for potential notification hooks) |

**Removed:** `expire_listings`, `purge_listings` (tied to the removed `expires_at`/`purge_at` pair), `notify_expiring`.

---

## 8. Migration order (forward, additive)

```
... 001-120 (original hyperlocal-marketplace migrations, retained for history) ...
121_vtuber_enums.sql
122_drop_physical_marketplace_tables.sql
123_profiles_connect_fields.sql
124_drop_geo_columns.sql
125_listings_vtuber_rework.sql
126_listing_addons.sql
127_purchase_verified_reviews.sql
128_orders.sql                      -- orders, order_addons, order_deliverables
129_strike_system.sql               -- link_health_checks, seller_strikes
130_pro_seller.sql                  -- pro_seller_subscriptions, featured_listing_credits/purchases
131_dm_email_verification.sql
132_category_reseed_vtuber.sql
133_generalize_promo_codes.sql
134_seller_publish_gate.sql
135_listing_write_rpcs_and_cleanup.sql
136_listing_support_subscriptions.sql   -- support plans, subscriptions, work quotes
137_seller_profile_portfolio.sql        -- socials, portfolio_url, showcase items
138_profile_bulletin.sql                -- one-current-post bulletin + comments
139_listing_sale_periods.sql            -- Pro Seller timed sales + promo gates
140_listing_thumbnails_and_feed_filters.sql
```

### Additive feature tables (136–140)

| Table | Purpose |
|-------|---------|
| `listing_support_plans` | Per-listing monthly support offer (eligible asset types / VRChat) |
| `listing_support_subscriptions` | Stripe Connect subscriptions (purchasers only) |
| `support_work_quotes` | Extra-work quotes on an active support subscription |
| `seller_portfolio_items` | Up to 6 showcase images per seller |
| `profile_bulletin_posts` / `profile_bulletin_comments` | One current post per profile + comments |
| `listing_sale_periods` | Pro Seller timed % off or sale price windows |

`profiles` also gains `website_url`, `portfolio_url` (required to publish), `social_links` JSONB. `listings.feed_thumbnail_path` is required to publish.

---

## 9. TypeScript mapping

```typescript
// src/types/enums.ts — must match Postgres
export type AssetType = 'live2d_2d' | 'model_3d' | 'pngtuber' | 'accessory_prop' | 'background_overlay' | 'base_model' | 'other';
export type LicenseType = 'otu' | 'p2u';
export type AddonKind = 'customization' | 'setup';
export type SupportDuration = 'none' | '30_days' | '90_days' | 'lifetime';
export type OrderStatus = 'pending_payment' | 'awaiting_fulfillment' | 'fulfilled' | 'refunded' | 'cancelled';
export type ListingStatus = 'draft' | 'active' | 'sold' | 'paused' | 'deleted';
```

Regenerate `database.ts` after each migration.

---

## 10. Index maintenance notes

- Run `ANALYZE listings`, `ANALYZE orders` weekly at scale
- Monitor slow queries on `get_feed_listings` (no geo index anymore — full-text + btree filters carry the query plan)
- Watch `link_health_checks` table growth; consider partitioning by month if the catalog grows large

---

## 11. Runtime-configurable platform settings (admin-configurable at runtime)

Renamed away from resale/template-buyer framing but the **mechanism is unchanged**: these tables let the operator customize branding, categories, fee tiers, and email copy **without a code change or rebuild**.

### `public_app_config`

```sql
CREATE TABLE public_app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS: `SELECT` open to `anon, authenticated`; `INSERT/UPDATE/DELETE` require `is_app_admin()`.

Seeded keys (migration `134_platform_config_reseed.sql` replaces the radius-era keys): `app_display_name`, `support_email`, `branding_logo_url`, `branding_colors`, `platform_fee_bps_free` (default `1000` = 10%), `platform_fee_bps_pro` (default `800` = 8%), `featured_placement_duration_days` (default `7`), `featured_placement_price_cents`, `link_health_grace_period_hours` (default `48`), `strike_expiry_months` (default `12`), `strike_ban_threshold` (default `3`). `feed_radius_options`/`max_radius_miles` are dropped.

### `listing_categories`

Unchanged shape; reseeded (§migration `132_category_reseed_vtuber.sql`) with VTuber-domain defaults: `vrchat`, `live2d`, `pngtuber`, `chibi`, `kemonomimi`, `fantasy`, `original_character`, `accessories`, `backgrounds`, `miscellaneous`. Old physical-goods categories (`electronics`, `furniture`, `clothing`, etc.) are deactivated (`is_active = FALSE`), not hard-deleted, so historical listings referencing them don't break a foreign key.

### `email_templates`

Unchanged mechanism; template content rewritten for order confirmations, fulfillment notices, strike/grace-period notices, and Connect onboarding reminders instead of boost/premium/waitlist copy.

### Fee tiers & strike settings

`current_platform_fee_bps(p_user_id)` reads `is_pro_seller` and looks up `platform_fee_bps_pro`/`platform_fee_bps_free` from `public_app_config` — same "read from config, never hardcode" pattern used for the old radius options and price cap.

See [14-Security_Best_Practices.md](./14-Security_Best_Practices.md) for the RLS/injection audit of these tables.
