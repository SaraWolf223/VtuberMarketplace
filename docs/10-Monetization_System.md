# VtuberMarketplace — Monetization System

**Version:** 2.0
**Processor:** Stripe Connect Express (destination charges) + Stripe Subscriptions (Pro Seller) + Stripe one-off PaymentIntents (pay-per-use Featured)
**Scope:** Real item-sale payments (this replaces the old Boost/Premium-only, no-item-sales model). Buyer covers Stripe's processing fee + tax; there is no fixed listing price cap (`price > 0` only).

---

## 1. Revenue streams

| Stream | Structure | Notes |
|--------|-----------|-------|
| Platform commission (free tier) | **10%** of order total, `application_fee_amount` on the destination charge | Config key `public_app_config.platform_fee_bps_free` (default `1000`) |
| Platform commission (Pro Seller) | **8%** of order total | Config key `platform_fee_bps_pro` (default `800`) |
| Pro Seller subscription | Monthly, admin-configurable price, Stripe Subscription | Perks in §4 |
| Pay-per-use Featured Listing | One-time, admin-configurable price, Stripe PaymentIntent | Available to any seller, subscribed or not |

**Removed entirely:** the old $1/24h Boost, $5/mo Premium, Founding Seller boost-credit program, and AdMob banner-ad monetization. This is now a real-payments goods marketplace — a banner-ad revenue stream doesn't fit alongside taking a commission on every sale, and Boost/Premium are superseded by Pro Seller + pay-per-use Featured (§4–§5). Admins can still comp Pro Seller (`pro_seller_subscriptions` row created out-of-band) without Stripe, mirroring the old `premium_source='comp'` pattern.

---

## 2. Stripe Connect Express — seller onboarding

### 2.1 Flow

```
Seller taps "Start selling" → create-connect-account
  → Stripe Connect Express account created, stripe_connect_account_id stored
  → connect-onboarding-link → Stripe-hosted onboarding (KYC: identity, bank details, business type)
  → Seller redirected back → webhook (account.updated) syncs
     connect_charges_enabled / connect_payouts_enabled / connect_details_submitted
  → Seller separately completes phone verification (existing OTP flow, unrelated to Stripe)
```

### 2.2 Publish gate

A listing can only be moved to `status = 'active'` (published) if, at the time of the publish request:

```
profiles.connect_charges_enabled = TRUE
AND profiles.connect_payouts_enabled = TRUE
AND profiles.phone_verified_at IS NOT NULL
```

Enforced server-side in the listing publish path (not just client-side gating) — see `03-Database_Schemas.md` §3.1. The seller dashboard (`get_seller_dashboard_summary` RPC) surfaces which of the three conditions is still outstanding so the UI can show a clear "why can't I publish" checklist.

### 2.3 Re-verification

Stripe can flip `charges_enabled`/`payouts_enabled` back to `false` post-onboarding (e.g. additional KYC requested). The `account.updated` webhook handler re-syncs these flags on every event; if either flips false, active listings are **not** auto-unpublished (a live listing with a temporarily-restricted Connect account can still be browsed) but new orders are blocked at checkout (`create-order-checkout` re-checks the gate) and the seller dashboard shows an "action needed" banner.

---

## 3. Order checkout — destination charge

### 3.1 Flow

```
Buyer selects listing (+ optional customization/setup add-ons) → Checkout →
create-order-checkout:
  1. Re-validate listing is active, seller gate still passes, addon options still active
  2. Compute base_price_cents + addon_total_cents = total_cents
  3. Look up current_platform_fee_bps(seller_id) → 1000 or 800
  4. platform_fee_cents = round(total_cents * fee_bps / 10000)
  5. Create Stripe Checkout Session:
     - payment_intent_data.application_fee_amount = platform_fee_cents
     - payment_intent_data.transfer_data.destination = seller's stripe_connect_account_id
     - line item = total_cents (Stripe Tax + buyer-side processing fee added on top per Stripe config)
  6. Insert `orders` row (status = pending_payment), snapshot license_text → license_snapshot,
     snapshot fee_bps_applied, insert `order_addons` rows if any add-ons selected
  → Buyer redirected to Stripe Checkout → pays
  → stripe-webhook (checkout.session.completed):
     - orders.status = 'awaiting_fulfillment' (if order_addons exist) else 'fulfilled', paid_at = now()
     - if license_type = 'otu': trigger sets listings.status = 'sold'
     - buyer's Library unlocks the order (download_url immediately if no add-ons)
```

### 3.2 Fee math example

| Field | No add-ons, free tier | With add-ons, Pro Seller |
|-------|------------------------|---------------------------|
| `base_price_cents` | 2500 | 4000 |
| `addon_total_cents` | 0 | 1500 |
| `total_cents` | 2500 | 5500 |
| `fee_bps_applied` | 1000 | 800 |
| `platform_fee_cents` | 250 | 440 |
| Seller receives (before Stripe's own processing fee, which the buyer separately covers) | 2250 | 5060 |

### 3.3 Refunds

Refund via Stripe Dashboard or a future `admin-action` refund path issues a Stripe refund on the PaymentIntent, which automatically reverses the `application_fee_amount` proportionally (standard Connect destination-charge refund behavior). `orders.status → 'refunded'`, `refunded_at = now()`; if the listing had been auto-marked `sold` (OTU), an admin can manually relist it.

---

## 4. Pro Seller subscription

### 4.1 Perks

| Perk | Detail |
|------|--------|
| Reduced commission | 8% vs 10% on every order (`platform_fee_bps_pro`) |
| Featured Listing credits | Monthly allotment (`featured_listing_credits`, default 4/month) redeemable via `apply_featured_placement` instead of paying per placement |
| Analytics dashboard | Listing views, favorites, conversion, order history trends |
| Verified badge | `is_pro_seller` surfaced on `profiles_public`, shown on listing cards and profile |
| Shop customization | `shop_banner_url` + `shop_accent_color` on the seller's public shop page |
| Seller-scoped promo codes | Seller can create promo codes redeemable only against their own listings |

### 4.2 Flow

```
Seller → Settings → Pro Seller → create-pro-seller-checkout
  → Stripe Checkout (Subscription mode) → webhook (customer.subscription.created/updated)
  → upsert pro_seller_subscriptions, profiles.is_pro_seller = (status = 'active'), pro_seller_until = current_period_end
Manage/cancel → create-pro-seller-portal → Stripe Billing Portal
```

### 4.3 Lifecycle

| Stripe subscription status | Behavior |
|---|---|
| `active` | Perks on, `is_pro_seller = true` |
| `past_due` | Perks remain on for a 3-day grace period, then treated as `canceled` if unresolved |
| `canceled` | Perks remain active until `current_period_end`, then `is_pro_seller = false` |

### 4.4 Monthly credit reset

Cron `reset_featured_listing_credits` (1st of month) inserts a new `featured_listing_credits` row (`credits_total = 4`, `credits_used = 0`) for every currently-active Pro Seller subscriber. Unused credits from the prior period do **not** roll over.

---

## 5. Pay-per-use Featured Listing

Any seller — subscribed or not — can buy a single Featured placement à la carte:

```
Seller → Listing → "Feature this listing" → create-featured-checkout
  → If Pro Seller with an unused credit this period: apply_featured_placement(source='pro_seller_credit') — no Stripe charge
  → Else: Stripe PaymentIntent for `featured_placement_price_cents` → on success, apply_featured_placement(source='paid')
apply_featured_placement:
  - listings.featured_until = now() + featured_placement_duration_days (config, default 7)
  - insert featured_listing_purchases row
  - if paid from a credit, increment featured_listing_credits.credits_used
```

This replaces the old `apply-boost`/`apply_listing_boost` mechanism; the effect on feed ranking (Featured tier sorts above non-Featured, no geo component) is described in `01-PRD.md` §10 and `03-Database_Schemas.md` §4.1/§4.3.

---

## 6. Edge functions (monetization-relevant)

### 6.1 New

| Function | Purpose |
|----------|---------|
| `create-connect-account` | Creates the seller's Stripe Connect Express account, stores `stripe_connect_account_id` |
| `connect-onboarding-link` | Generates a fresh Stripe-hosted onboarding (or account-update) link |
| `create-order-checkout` | Builds the destination-charge Checkout Session for a listing purchase (§3.1) |
| `create-pro-seller-checkout` | Builds the Stripe Subscription Checkout Session for Pro Seller |
| `create-pro-seller-portal` | Returns a Stripe Billing Portal session for managing/canceling Pro Seller |
| `create-featured-checkout` | Builds the PaymentIntent (or applies a credit) for a pay-per-use Featured purchase |
| `apply-featured-placement` | Sets `featured_until`, records the purchase/credit use (called from checkout success or webhook) |

### 6.2 Removed

| Function | Reason |
|----------|--------|
| `create-boost-checkout` | Superseded by `create-featured-checkout` |
| `apply-boost` | Superseded by `apply-featured-placement` |
| `create-premium-checkout` | Superseded by `create-pro-seller-checkout` |
| `create-premium-portal` | Superseded by `create-pro-seller-portal` |
| `sync-premium` | Superseded by the Pro Seller webhook path (§4.2) |
| `get-seller-benefits` | Superseded by `get_seller_dashboard_summary` RPC (`03-Database_Schemas.md` §4.4), which now also reports Connect status |

`stripe-webhook` is extended (not replaced) — see §7.

---

## 7. `stripe-webhook` — event matrix

| Event | Action |
|-------|--------|
| `account.updated` | Re-sync `connect_charges_enabled`/`connect_payouts_enabled`/`connect_details_submitted` |
| `checkout.session.completed` (order mode) | Mark `orders` paid, transition status, mark OTU listing `sold` |
| `checkout.session.completed` (Pro Seller mode) | Upsert `pro_seller_subscriptions` |
| `payment_intent.succeeded` (Featured) | `apply-featured-placement` |
| `customer.subscription.updated/deleted` | Update Pro Seller status/`profiles.is_pro_seller` per §4.3 |
| `invoice.paid` (Pro Seller) | No credit action here — credits reset on the monthly cron (§4.4), not per-invoice, so calendar-month billing and credit periods stay predictable regardless of subscription anniversary date |
| `charge.refunded` | Mark `orders.status = 'refunded'` |

**Idempotency:** unchanged mechanism — every event ID is recorded in `webhook_events` before processing; duplicates are no-ops.

---

## 8. Stripe Dashboard checklist

- [ ] Connect platform profile configured (Express, destination charges)
- [ ] Products: Pro Seller subscription price, Featured Listing price
- [ ] Webhook endpoint → `stripe-webhook`, signature verification enabled
- [ ] Events subscribed: `account.updated`, `checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.*`, `charge.refunded`
- [ ] Stripe Tax enabled (buyer covers tax)
- [ ] Customer Portal enabled (for Pro Seller management)
- [ ] Connect onboarding branding (platform name/logo) configured

---

## 9. Analytics

| Event | When |
|-------|------|
| `connect_onboarding_started` / `connect_onboarding_completed` | Seller starts/finishes Stripe Connect KYC |
| `checkout_started` | Buyer opens Checkout |
| `order_completed` | `checkout.session.completed` webhook processed |
| `pro_seller_subscribed` / `pro_seller_canceled` | Subscription lifecycle |
| `featured_purchased` | Featured placement applied (paid or credit) |

Track **Pro Seller conversion rate** (active Pro Seller subscribers ÷ Stripe Connect–enabled sellers) and **Featured attach rate** (Featured purchases ÷ new listings) as the primary monetization health metrics, replacing the old "boost ROI" metric.

---

## 10. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-05-22 | Original hyperlocal-marketplace Boost/Premium/AdMob system (superseded) |
| 2.0 | 2026-07-21 | Full rewrite for VtuberMarketplace: Stripe Connect Express onboarding + destination-charge order checkout, 10%/8% fee-tier commission, Pro Seller subscription (replaces Premium), pay-per-use Featured Listing (replaces Boost), removal of AdMob ad monetization and Founding Seller boost credits |
