# VtuberMarketplace — API Endpoints

**Version:** 2.0
**Transport:** Supabase client (PostgREST), Storage API, Edge Functions, RPC
**Auth header:** `Authorization: Bearer <supabase_jwt>`

---

## 1. Conventions

### 1.1 Response envelope (Edge Functions only)

```json
{ "ok": true, "data": {}, "error": null }
```

Error:

```json
{ "ok": false, "data": null, "error": { "code": "VALIDATION", "message": "Price must be greater than $0" } }
```

### 1.2 PostgREST errors

Map Supabase errors to `AppError` in client — see **02-Cursor_Rules.md**.

### 1.3 Pagination

- Cursor-based for feeds: `next_cursor` opaque string
- Limit default: `20`, max: `50`

### 1.4 Idempotency

- Stripe webhooks: store `stripe_event_id` in `webhook_events`
- Checkout: idempotency key = `stripe_checkout_session_id` / `stripe_payment_intent_id`

---

## 2. Authentication (Google, Apple, email/password)

Unchanged from the prior build — see [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md). Sign-in supports Google OAuth, Apple Sign-In (iOS), and email/password; 2FA (TOTP) optional for everyone, mandatory for `admin`/`manager`.

**New:** `profiles.email_confirmed_at` (mirrors Supabase Auth's own confirmation timestamp) now gates DM sending (§7a) instead of phone verification. Phone verification (`phone_verified_at`) is retained but repurposed as a **seller Stripe Connect publish gate**, not a messaging gate.

---

## 3. Profiles

### 3.1 Get public profile

```
GET /rest/v1/profiles_public?id=eq.{uuid}
```

**Response 200:**

```json
{
  "id": "uuid",
  "username": "riggerjane",
  "display_name": "Jane",
  "avatar_url": "https://...",
  "rating_avg": 4.8,
  "rating_count": 34,
  "listing_count": 12,
  "is_pro_seller": true,
  "connect_charges_enabled": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### 3.2 Update own profile

```
PATCH /rest/v1/profiles?id=eq.{auth_uid}
```

**Allowed fields:** `username`, `phone`, `shop_banner_url`, `shop_accent_color` (Pro Seller only, enforced server-side).

**Not client-writable:** `email`, `display_name`, `avatar_url`, `auth_provider`, all Connect/Pro-Seller/strike fields.

### 3.3 Delete account

```
POST /functions/v1/delete-account
```

**Side effects:** cancels active Pro Seller Stripe subscription; blocks deletion if the seller has open `orders` in `awaiting_fulfillment` (must resolve first); hard-deletes listings; deletes auth user (cascade profile).

### 3.4 Accept platform terms

Unchanged mechanism (`accept_platform_terms` RPC) — `terms_version` bumped for the new ToS.

---

## 4. Seller onboarding (Stripe Connect)

### 4.1 Create Connect account

```
POST /functions/v1/create-connect-account
```

**Response 200:**

```json
{ "ok": true, "data": { "stripe_account_id": "acct_..." } }
```

Creates a Stripe Connect Express account for the caller if one doesn't already exist; persists `profiles.stripe_connect_account_id`.

### 4.2 Connect onboarding link

```
POST /functions/v1/connect-onboarding-link
```

**Response 200:**

```json
{ "ok": true, "data": { "url": "https://connect.stripe.com/setup/..." } }
```

Returns a fresh Stripe-hosted onboarding (or account-update) link; the client opens it in a web browser / in-app browser.

### 4.3 Connect status

```
GET /rest/v1/profiles?id=eq.{auth_uid}&select=connect_charges_enabled,connect_payouts_enabled,connect_details_submitted,phone_verified_at
```

Kept in sync by the `account.updated` webhook event (§9.4).

---

## 5. Listings (digital assets)

### 5.1 Create listing (draft)

```
POST /functions/v1/create-listing
```

**Request:**

```json
{
  "title": "Chibi Fox Live2D Model",
  "description": "Fully rigged chibi model with 12 expressions",
  "price": 45.00,
  "category": "live2d",
  "asset_type": "live2d_2d",
  "license_type": "p2u",
  "license_text": "You may use this model for streaming and content creation...",
  "is_mature": false,
  "support_duration": "30_days",
  "compatible_software": ["VTube Studio"],
  "file_formats": ["MOC3", "PSD"],
  "includes_source_files": true,
  "cubism_version": "5.0",
  "has_physics": true,
  "expression_count": 12,
  "download_url": "https://drive.google.com/...",
  "youtube_video_url": "https://youtu.be/..."
}
```

**Response 201:**

```json
{
  "ok": true,
  "data": {
    "listing_id": "uuid",
    "upload_urls": [{ "sort_order": 0, "path": "seller/listing/0.webp", "signed_url": "..." }],
    "youtube_validation": { "status": "valid", "title": "...", "thumbnail_url": "..." }
  }
}
```

Rejects with `VALIDATION` if: `image_count` would be `< 3`, `youtube_video_url` fails oEmbed/Data-API validation (§10), `license_text` is blank, `download_url` is missing/malformed, seller Connect/phone gate isn't met (`SELLER_NOT_PAYOUT_READY`), or asset-type-conditional required fields are missing.

**Step 2 — upload images to Storage signed URLs; Step 3 — `finalize-listing-images`** (unchanged mechanism from the prior build).

### 5.2 Add/update addon options

```
POST /functions/v1/upsert-listing-addon
{ "listing_id": "uuid", "kind": "setup", "name": "VRChat avatar upload", "description": "I'll upload and configure your avatar via the Unity SDK", "extra_fee_cents": 2500, "estimated_turnaround": "2-3 days" }

DELETE /rest/v1/listing_addon_options?id=eq.{uuid}&listing_id=eq.{owned_listing_id}
```

A listing can carry any number of `customization` and/or `setup` addon rows (§03-Database_Schemas.md §3.4).

### 5.3 Get listing detail

```
POST /rpc/get_listing_detail
{ "p_listing_id": "uuid" }
```

**Response includes:** listing fields, `listing_images`, active `listing_addon_options` grouped by `kind`, seller public profile, and `youtube_video_id` for the embedded player. No distance/geo fields.

### 5.4 Update listing

```
POST /rpc/update_listing
{ "p_listing_id": "uuid", "p_title": "...", "p_description": "...", "p_price": 45.00,
  "p_category": "live2d", "p_license_text": "...", "p_download_url": "https://...",
  "p_is_mature": false, "p_support_duration": "30_days", "p_compatible_software": ["VTube Studio"],
  "p_file_formats": ["MOC3", "PSD"], "p_includes_source_files": true, "p_credits_text": null,
  "p_asset_fields": { "cubism_version": "5.0", "has_physics": true, "expression_count": 12 } }
```

Direct `PATCH /rest/v1/listings` is blocked for sellers at the RLS/trigger level (unchanged security model from the prior build — all listing mutations go through `SECURITY DEFINER` RPCs so banned-keyword and category checks always run). **Rejected if:** `status NOT IN ('draft', 'active', 'paused_pending_review')` (i.e. `sold`/`deleted` listings are immutable). Changing `download_url` mid-listing is allowed but flagged in the seller-hosting guidance copy (past buyers may still hold the old link).

New drafts are created with `POST /rpc/insert_draft_listing` (same field set, plus `p_seller_id`, `p_asset_type`, `p_license_type`); publishing a draft (or re-publishing after edits) calls `POST /rpc/publish_listing { "p_listing_id": "uuid" }`, which enforces the ≥3-photo, valid-YouTube-video, download-URL, and license-text gates server-side before flipping `status` to `active`.

### 5.5 Mark sold / delete / my listings

Unchanged mechanism from the prior build (`PATCH status`, `PATCH status=deleted`, `GET ...seller_id=eq...`). **New:** an OTU listing auto-transitions to `sold` when its order reaches `fulfilled` (trigger, §03-Database_Schemas.md §3.3) — manual mark-sold is mainly for P2U sellers voluntarily delisting.

---

## 6. Feed & search (no geo)

### 6.1 Feed (primary)

```
POST /rpc/get_feed_listings
```

**Body:**

```json
{
  "p_category": null,
  "p_asset_type": null,
  "p_license_type": null,
  "p_min_price": null,
  "p_max_price": null,
  "p_compatible_software": null,
  "p_has_customization": null,
  "p_has_setup": null,
  "p_support_duration": null,
  "p_is_mature": false,
  "p_status": "active",
  "p_search": null,
  "p_sort": "newest",
  "p_cursor": null,
  "p_limit": 20,
  "p_published_after": null,
  "p_published_before": null,
  "p_min_seller_rating": null
}
```

Price filters apply to **effective price** (after any active Pro Seller sale). Items include `effective_price`, `on_sale`, `has_support_plan`, `seller_rating_avg`, and `thumb_path` (prefers `feed_thumbnail_path`).

**Item shape:**

```json
{
  "id": "uuid",
  "title": "Chibi Fox Live2D Model",
  "price": 45.00,
  "category": "live2d",
  "asset_type": "live2d_2d",
  "license_type": "p2u",
  "thumb_url": "https://...",
  "is_mature": false,
  "has_customization": false,
  "has_setup": false,
  "featured": true,
  "published_at": "2026-07-01T12:00:00Z",
  "seller": { "id": "uuid", "username": "riggerjane", "is_pro_seller": true, "rating_avg": 4.8 }
}
```

### 6.2 Category browse

Same RPC with `p_category` set (`TEXT` FK into `listing_categories.slug`, incl. `vrchat`).

---

## 7. Favorites

Unchanged mechanism (`GET`/`POST`/`DELETE` on `favorites`).

---

## 8. Reviews — purchase-verified only

### 8.1 Create review

```
POST /rest/v1/rpc/create_review
{ "p_order_id": "uuid", "p_rating": 5, "p_body": "Great model, easy to set up!" }
```

Direct `POST /rest/v1/reviews` is blocked for authenticated clients. **Requires:** `orders.status = 'fulfilled'` for `(auth.uid(), listing_id)` matching `p_order_id`. Replaces the removed `record_listing_interest` path entirely.

**Side effect:** trigger updates `profiles.rating_avg`, `rating_count` (unchanged mechanism).

---

## 8a. Orders & checkout

### 8a.1 Create order checkout

```
POST /functions/v1/create-order-checkout
{
  "listing_id": "uuid",
  "addon_option_ids": ["uuid", "uuid"],
  "promo_code": "OPTIONAL10",
  "license_acknowledged": true
}
```

**Response 200:**

```json
{ "ok": true, "data": { "checkout_url": "https://checkout.stripe.com/..." } }
```

Server looks up the seller's active fee tier (`current_platform_fee_bps`), snapshots `listings.license_text` into the pending order's `license_snapshot`, sums `addon_option_ids` fees into `addon_total_cents`, and creates a Stripe Checkout Session as a **destination charge** against the seller's Connect account with `application_fee_amount` set to the commission. Rejects with `LICENSE_NOT_ACKNOWLEDGED` if `license_acknowledged` is not `true`, or `LISTING_NOT_PURCHASABLE` if the listing is `sold`/`paused`/`deleted`, or if the buyer is the seller.

### 8a.2 Stripe webhook

```
POST /functions/v1/stripe-webhook
```

**Events handled:**

- `account.updated` → sync `profiles.connect_charges_enabled`/`connect_payouts_enabled`/`connect_details_submitted`
- `checkout.session.completed` / `payment_intent.succeeded` → mark `orders.status = 'awaiting_fulfillment'` (has add-ons) or `'fulfilled'` (no add-ons; buyer already has `listings.download_url`); if OTU, mark listing `sold`
- `charge.refunded` → `orders.status = 'refunded'`
- `customer.subscription.created|updated|deleted` → sync `pro_seller_subscriptions` + `profiles.is_pro_seller`
- `invoice.paid` → extend `profiles.pro_seller_until`

### 8a.3 Submit deliverable (seller fulfillment)

```
POST /functions/v1/submit-order-deliverable
{ "order_id": "uuid", "deliverable_url": "https://...", "note": "Recolored to match your reference!" }
```

**Requires:** caller is `orders.seller_id`; order status is `awaiting_fulfillment`. Inserts `order_deliverables`, flips `orders.status = 'fulfilled'`, notifies the buyer.

### 8a.4 My orders (buyer library / seller dashboard)

```
GET /rest/v1/orders?buyer_id=eq.{auth_uid}&select=*,listings(title,download_url),order_deliverables(*)&order=created_at.desc
GET /rest/v1/orders?seller_id=eq.{auth_uid}&select=*,listings(title),order_addons(*)&order=created_at.desc
```

---

## 8b. Digital delivery, link health & strikes

### 8b.1 Report a broken download link

```
POST /rest/v1/reports
{ "target_type": "order", "order_id": "uuid", "reason": "download_link_not_working", "details": "optional" }
```

Feeds the same pipeline as an automated health-check failure (see **11-Storage_and_Deletion_System.md**).

### 8b.2 Seller "I fixed it" re-check

```
POST /functions/v1/recheck-listing-link
{ "listing_id": "uuid" }
```

Triggers an immediate re-check of `link_health_checks` for that listing; closes the issue if it now passes.

### 8b.3 Admin strike confirmation

```
POST /functions/v1/admin-action
{ "action": "confirm_strike" | "dismiss_link_issue", "listing_id": "uuid", "notes": "string" }
```

`confirm_strike` writes a `seller_strikes` row (`confirmed_by = auth.uid()`); a 3rd active strike triggers an automatic ban via the existing ban RPC.

---

## 9. Monetization endpoints (Stripe Connect + Pro Seller)

### 9.1 Pro Seller subscription checkout

```
POST /functions/v1/create-pro-seller-checkout
```

Returns a Stripe Checkout Session URL for the Pro Seller subscription.

### 9.2 Pro Seller billing portal

```
POST /functions/v1/create-pro-seller-portal
```

Returns a Stripe Billing Portal URL (manage/cancel subscription).

### 9.3 Featured placement purchase (pay-per-use)

```
POST /functions/v1/create-featured-checkout
{ "listing_id": "uuid" }
```

Same PaymentIntent mechanic as the old boost purchase, repointed at Featured semantics (duration from `public_app_config.featured_placement_duration_days`).

### 9.4 Apply Featured placement (after payment or from a Pro Seller credit)

```
POST /functions/v1/apply-featured-placement
{ "listing_id": "uuid", "source": "paid" | "pro_seller_credit" }
```

### 9.5 Featured credit status

```
GET /rest/v1/featured_listing_credits?user_id=eq.{auth_uid}&period_start=eq.{current_month}
```

**Removed endpoints:** `create-boost-checkout`, `apply-boost`, `create-premium-checkout`, `create-premium-portal`, `sync-premium`, `get-seller-benefits` (founding-seller specific parts), `geocode-zip`, `join-waitlist`, `join-ios-waitlist`, `get_waitlist_public_stats`, `get_referral_status`.

---

## 10. YouTube demo video validation

### 10.1 Validate a demo video URL

```
POST /functions/v1/validate-youtube-video
{ "url": "https://youtu.be/..." }
```

**Response 200 (valid):**

```json
{
  "ok": true,
  "data": {
    "video_id": "dQw4w9WgXcQ",
    "status": "valid",
    "title": "...",
    "thumbnail_url": "https://i.ytimg.com/...",
    "embeddable": true,
    "made_for_kids": false
  }
}
```

**Response (rejected):**

```json
{ "ok": false, "data": null, "error": { "code": "VIDEO_NOT_EMBEDDABLE", "message": "This video can't be embedded and can't be used as a demo." } }
```

Called synchronously on listing submission (`create-listing`/`update-listing`); also invoked by the scheduled `check-youtube-videos` cron (§03-Database_Schemas.md §7) to re-validate published listings via oEmbed only (the Data API call is submission-time only, to conserve quota).

---

## 10A. Model-support subscriptions, portfolio, bulletin, sales

```
POST /rpc/can_subscribe_to_listing_support { "p_listing_id": "uuid" }
POST /functions/v1/upsert-listing-support-plan
  { "listing_id", "price_cents_month", "offerings_text", "active" }
POST /functions/v1/create-support-subscription-checkout { "listing_id" }
POST /rpc/create_support_work_quote { "p_subscription_id", "p_title", "p_description", "p_amount_cents" }
POST /rpc/respond_support_work_quote { "p_quote_id", "p_accept": true }
POST /functions/v1/create-support-quote-checkout { "quote_id" }

POST /rpc/set_bulletin_post { "p_body": "..." }
POST /rpc/get_current_bulletin { "p_user_id": "uuid" }
POST /rpc/list_bulletin_comments / add_bulletin_comment
POST /rpc/staff_hide_bulletin_post | staff_hide_bulletin_comment

PATCH /rest/v1/profiles?id=eq.{uid}  — website_url, portfolio_url, social_links
POST /functions/v1/upload-portfolio-image

POST /rpc/upsert_listing_sale_period  — Pro Seller only
POST /rpc/create_seller_promo_code    — Pro Seller only
POST /rpc/set_listing_feed_thumbnail { "p_listing_id", "p_storage_path" }
POST /rpc/publish_listing             — also requires portfolio_url + feed_thumbnail_path
```

---

## 11. Direct messages

Unchanged RPC surface (`get_or_create_listing_conversation`, `send_conversation_message`, `list_my_conversations`, `get_conversation_detail`, `delete_conversation`) **except**:

- `send_conversation_message` now checks `profiles.email_confirmed_at IS NOT NULL` instead of `is_phone_verified()`.
- `mark_listing_sold_and_end_chat` and the entire `conversation_contact_agreements` RPC surface (`propose_contact_agreement`, `accept_contact_agreement`, `get_conversation_contact_agreement`, `reveal_conversation_phones`, `reveal_seller_phone`) are **removed** — no phone-reveal/meetup-agreement concept in a remote digital marketplace.

Message fetch is still a plain `GET /rest/v1/messages?conversation_id=eq...` (RLS-scoped).

---

## 12. Blocks & reports

Unchanged mechanism; `reports` gains the `order`-scoped `download_link_not_working` path (§8b.1) and `ai_generated_content`/`stolen_content` reasons.

---

## 13. Admin endpoints (Edge, admin/manager role)

```
POST /functions/v1/admin-action
{
  "action": "unpause_listing" | "pause_listing" | "delete_listing" | "ban_user" | "unban_user" |
            "warn_user" | "shadow_ban_user" | "unshadow_ban_user" | "dismiss_reports" |
            "confirm_strike" | "dismiss_link_issue" | "ban_for_ai_content" |
            "grant_pro_seller" | "revoke_pro_seller" | "refund_order",
  "listing_id": "uuid",
  "user_id": "uuid",
  "order_id": "uuid",
  "report_id": "uuid",
  "pro_seller_months": 1,
  "notes": "string"
}
// admin-only (managers denied): grant_pro_seller, revoke_pro_seller, refund_order,
// confirm_strike, ban_for_ai_content.
// ban_for_ai_content bans immediately, skipping the normal warn-first ladder.

POST /functions/v1/admin-manage
{
  "action": "get_settings" | "update_settings" | "create_promo" | "deactivate_promo",
  "settings": { "platform_fee_bps_free": 1000, "platform_fee_bps_pro": 800, "link_health_grace_period_hours": 48, "strike_expiry_months": 12, ... },
  "code": "PROMO1",
  "type": "percent_off" | "flat_off_cents",
  "value": 10,
  "scope": "platform" | "seller",
  "seller_id": "uuid",
  "max_redemptions": 100,
  "expires_at": "ISO8601",
  "promo_id": "uuid"
}
```

**Admin UI:** `app/admin/*`, gated by role + mandatory TOTP (unchanged pattern). New screens: `app/admin/strikes.tsx` (link-issue/strike confirmation queue), AI-content confirmation-and-ban action folded into the existing moderation queue UI.

**Removed admin endpoints/screens:** `join-waitlist`/`join-ios-waitlist` handling, `admin/waitlist.tsx`, `admin/ios-waitlist.tsx`, `admin/seed.tsx`, `admin/college-students.tsx`, seed-program actions (`approve_seed_listing`, `revoke_seed_approval`, `mark_seed_paid`), `extend_listing_expiry` (no more expiry).

---

## 14. Notifications

Unchanged mechanism (`set_my_push_token`/`clear_my_push_token`/`get_my_push_token` RPCs + `AFTER INSERT` trigger on `notifications`). New notification kinds: `order_paid`, `order_fulfilled`, `order_refunded`, `link_issue_opened`, `link_issue_grace_period_ending`, `strike_issued`, `pro_seller_renewed`, `connect_onboarding_incomplete`. Removed: `listing_expiring`.

---

## 15. Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `KEYWORD_BLOCKED` | 400 | banned keyword |
| `IMAGE_MINIMUM` | 400 | < 3 images |
| `VIDEO_REQUIRED` | 400 | missing YouTube demo video |
| `VIDEO_NOT_EMBEDDABLE` | 400 | video fails Data API `embeddable` check |
| `VIDEO_MADE_FOR_KIDS` | 400 | video is flagged `madeForKids` (incompatible with 18+ platform) |
| `LICENSE_TEXT_REQUIRED` | 400 | missing seller-authored license |
| `LICENSE_NOT_ACKNOWLEDGED` | 400 | buyer didn't check the license acknowledgment box at checkout |
| `SELLER_NOT_PAYOUT_READY` | 403 | Connect/phone gate not met, can't publish/receive orders |
| `NOT_OWNER` | 403 | wrong seller |
| `LISTING_NOT_PURCHASABLE` | 409 | sold/paused/deleted |
| `ALREADY_REVIEWED` | 409 | duplicate review |
| `ORDER_NOT_FULFILLABLE` | 409 | deliverable submitted for an order not in `awaiting_fulfillment` |
| `BANNED` | 403 | user banned |
| `RATE_LIMITED` | 429 | too many requests |

---

## 16. Client service layer mapping

| Service file | Endpoints |
|---------------|-----------|
| `auth-service.ts` | Supabase Auth |
| `profile-service.ts` | profiles |
| `connect-service.ts` | Stripe Connect onboarding + status (new) |
| `listing-service.ts` | create, update, detail, addons, my listings |
| `feed-service.ts` | `get_feed_listings` RPC |
| `favorite-service.ts` | favorites CRUD |
| `order-service.ts` | checkout, deliverables, buyer library, seller orders (new — replaces the absent-item-payments gap) |
| `review-service.ts` | `create_review` RPC |
| `dm-service.ts` | conversations, messages |
| `moderation-service.ts` | reports, blocks, strikes |
| `monetization-service.ts` | Pro Seller + Featured placement edge functions |
| `youtube-service.ts` | `validate-youtube-video` (new) |

**Removed:** `geo-service.ts`.

---

## 17. Versioning

- Breaking changes: bump this doc's version and add migration notes.
- v2.0 (2026-07-21): full domain conversion — see [03-Database_Schemas.md](./03-Database_Schemas.md) for the underlying schema changes.
