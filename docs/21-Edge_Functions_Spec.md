# VtuberMarketplace — Edge Functions Specification

**Version:** 2.1
**Runtime:** Deno (Supabase Edge Functions)
**Companion:** [04-API_Endpoints.md](./04-API_Endpoints.md), [05-Backend_Architecture.md](./05-Backend_Architecture.md), [03-Database_Schemas.md](./03-Database_Schemas.md)

---

## 1. Shared utilities (`supabase/functions/_shared/`)

| Module | Exports |
|--------|---------|
| `cors.ts` | `corsHeaders`, `handleCors` |
| `errors.ts` | `ok(data)`, `fail(code, message, status)` |
| `supabaseAdmin.ts` | `createServiceClient()` |
| `stripe.ts` | `stripe`, `verifyWebhook` — now also exposes Connect-aware helpers (`createDestinationCharge`, `getOrCreateConnectAccount`) |
| `moderation.ts` | `containsBannedKeyword(text): boolean` (unchanged mechanism, VTuber-domain keyword seed) |
| `auth.ts` | `requireUser(req): { user, supabase }` |
| `require-admin.ts` | `requireAdmin(req)` / `requireManagerOrAdmin(req)` — unchanged, enforces mandatory TOTP for admin/manager |
| `youtube.ts` | `parseYoutubeVideoId(url)`, `checkOembed(videoId)`, `checkDataApi(videoId)` (new) |
| `linkHealth.ts` | `checkUrlHealth(url)` — shared HEAD/GET probe used by both the scheduled cron and `recheck-listing-link` (new) |

All user-facing functions return the JSON envelope per `04-API_Endpoints.md` §1.1.

---

## 2. `create-connect-account` (new)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |
| **Body** | *(none)* |

**Logic:**

1. `requireUser` — reject if `banned_at`
2. If `profiles.stripe_connect_account_id` already set, return it idempotently
3. Else create a Stripe Connect **Express** account (`type: 'express'`, capabilities `card_payments` + `transfers`), store `stripe_connect_account_id`

**Response:** `{ stripe_account_id }`

**Errors:** `BANNED` (403)

---

## 3. `connect-onboarding-link` (new)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |
| **Body** | *(none)* |

**Logic:**

1. Require `profiles.stripe_connect_account_id` to exist (call §2 first if not)
2. Create a Stripe `AccountLink` (`type: 'account_onboarding'`, or `account_update` if `connect_details_submitted` is already true and Stripe is requesting more info) with `refresh_url`/`return_url` back into the app/web seller dashboard

**Response:** `{ url }`

**Errors:** `CONNECT_ACCOUNT_MISSING` (409)

---

## 4. `create-listing` (rewritten)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |
| **Body** | `{ title, description?, price, category, asset_type, license_type, license_text, download_url, youtube_video_url, is_mature?, support_duration?, compatible_software?, file_formats?, ...asset-type-conditional fields }` (see `04-API_Endpoints.md` §5.1 for the full shape) |

**Logic:**

1. `requireUser` — reject if `banned_at`
2. Validate zod schema; `price > 0` with no fixed maximum
3. `containsBannedKeyword(title + description)`
4. **Seller publish gate:** `connect_charges_enabled AND connect_payouts_enabled AND phone_verified_at IS NOT NULL` — reject `SELLER_NOT_PAYOUT_READY` if not met
5. Validate `license_text` is non-blank, `download_url` is a well-formed `https://` URL
6. Call `validate-youtube-video` internally (or inline the same logic) against `youtube_video_url` — reject if not embeddable or flagged `madeForKids`
7. Validate `asset_type`-conditional required fields (per `03-Database_Schemas.md` §3.3)
8. Insert `listings` with `status = 'draft'`
9. Generate up to 5 signed upload URLs for `listing-images/{seller_id}/{listing_id}/{n}.webp`

**Response:** `{ listing_id, upload_urls[], youtube_validation }`

**Rate limit:** 10/hour/user (`listing_create_log`)

**Errors:** `KEYWORD_BLOCKED`, `VIDEO_REQUIRED`, `VIDEO_NOT_EMBEDDABLE`, `VIDEO_MADE_FOR_KIDS`, `LICENSE_TEXT_REQUIRED`, `SELLER_NOT_PAYOUT_READY`, `VALIDATION`

---

## 5. `finalize-listing-images` (updated)

| | |
|--|--|
| **Auth** | User JWT (owner) |
| **Body** | `{ listing_id, images: [{ sort_order, storage_path, byte_size, width, height }] }` |

**Logic:**

1. Verify seller owns listing
2. Require `images.length` between **3** (raised from 1) and 5
3. Insert `listing_images` rows
4. Set `image_count`, `status = 'active'`, `published_at = now()` — re-checks the seller publish gate (§4 step 4) as a defense-in-depth backstop since time may have passed since `create-listing`
5. No `expires_at`/`purge_at` are set — there is no fixed expiry in this domain

**Errors:** `NOT_OWNER`, `IMAGE_MINIMUM`, `SELLER_NOT_PAYOUT_READY`

---

## 6. `upsert-listing-addon` (new)

| | |
|--|--|
| **Auth** | User JWT (listing owner) |
| **Body** | `{ listing_id, addon_id?, kind: 'customization' \| 'setup', name, description?, extra_fee_cents, estimated_turnaround? }` |

**Logic:**

1. Verify caller owns `listing_id`
2. `extra_fee_cents > 0` required
3. Upsert `listing_addon_options` row; `DELETE /rest/v1/listing_addon_options` (RLS-scoped, owner-only) handles removal directly, no dedicated delete function needed

**Response:** `{ addon_id }`

---

## 7. `validate-youtube-video` (new)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |
| **Body** | `{ url }` |

**Logic:**

1. Parse the video ID out of `url` (supports `youtu.be/`, `youtube.com/watch?v=`, `youtube.com/shorts/`)
2. **oEmbed check** (no API key): `GET https://www.youtube.com/oembed?url=...&format=json` — 404/failure ⇒ `VIDEO_NOT_FOUND`
3. **YouTube Data API v3 check** (`videos.list`, part=`status,snippet`, 1 quota unit): reject if `status.embeddable = false` (`VIDEO_NOT_EMBEDDABLE`) or `status.madeForKids = true` (`VIDEO_MADE_FOR_KIDS`, incompatible with the platform's 18+ mature-content model)
4. On success, return the parsed `video_id`, title, thumbnail URL, and set `listings.youtube_video_status = 'valid'` if called in the context of an existing listing

**Response (valid):** `{ video_id, status: "valid", title, thumbnail_url, embeddable: true, made_for_kids: false }`

**Errors:** `VIDEO_NOT_FOUND` (400), `VIDEO_NOT_EMBEDDABLE` (400), `VIDEO_MADE_FOR_KIDS` (400)

**Called from:** `create-listing`/`update-listing` (submission-time, full Data API check) and the `check-youtube-videos` cron (§14, oEmbed-only re-check — the Data API call is submission-time-only to conserve the daily quota).

---

## 8. `create-order-checkout` (new)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |
| **Body** | `{ listing_id, addon_option_ids?, promo_code?, license_acknowledged }` |

**Logic:**

1. `requireUser` — reject if `banned_at`; reject if buyer is the listing's own seller
2. Require `license_acknowledged = true` (`LICENSE_NOT_ACKNOWLEDGED`)
3. Re-validate listing is purchasable: `status = 'active'` (`LISTING_NOT_PURCHASABLE` otherwise)
4. Re-validate every `addon_option_ids` entry is still `active` and belongs to `listing_id`
5. `base_price_cents = listings.price * 100`; `addon_total_cents = SUM(extra_fee_cents)`; apply `promo_code` discount if valid; `total_cents = base_price_cents + addon_total_cents - discount`
6. `fee_bps = current_platform_fee_bps(seller_id)` (1000 or 800); `platform_fee_cents = round(total_cents * fee_bps / 10000)`
7. Insert `orders` row (`status = 'pending_payment'`, `license_snapshot = listings.license_text`, `fee_bps_applied`, `platform_fee_cents`), insert `order_addons` snapshot rows
8. Create a Stripe Checkout Session: destination charge to the seller's `stripe_connect_account_id`, `application_fee_amount = platform_fee_cents`, `metadata.order_id`

**Response:** `{ checkout_url }`

**Errors:** `LICENSE_NOT_ACKNOWLEDGED`, `LISTING_NOT_PURCHASABLE`, `SELLER_NOT_PAYOUT_READY` (seller's Connect gate lapsed since publish), `VALIDATION`

---

## 9. `submit-order-deliverable` (new)

| | |
|--|--|
| **Auth** | User JWT (seller) |
| **Method** | POST |
| **Body** | `{ order_id, deliverable_url, note? }` |

**Logic:**

1. Verify caller is `orders.seller_id`
2. Require `orders.status = 'awaiting_fulfillment'` (`ORDER_NOT_FULFILLABLE` otherwise)
3. Insert `order_deliverables` (`delivered_by = auth.uid()`)
4. `orders.status = 'fulfilled'`, `fulfilled_at = now()`
5. If `license_type = 'otu'`, trigger sets the listing `status = 'sold'`
6. Notify the buyer (`order_fulfilled` notification)

**Errors:** `NOT_OWNER`, `ORDER_NOT_FULFILLABLE`

---

## 10. `stripe-webhook` (extended, not replaced)

| | |
|--|--|
| **Auth** | Stripe signature only |
| **Method** | POST raw body |

**Events:**

| Event | Action |
|-------|--------|
| `account.updated` | Sync `connect_charges_enabled`/`connect_payouts_enabled`/`connect_details_submitted` |
| `checkout.session.completed` (order mode) | Mark `orders` paid; `status → 'awaiting_fulfillment'` (has add-ons) or `'fulfilled'` (no add-ons); mark OTU listing `sold` |
| `checkout.session.completed` (Pro Seller mode) | Upsert `pro_seller_subscriptions` |
| `payment_intent.succeeded` (Featured) | Call `apply-featured-placement` internally |
| `charge.refunded` | `orders.status = 'refunded'`, `refunded_at = now()` |
| `customer.subscription.created/updated/deleted` | Upsert `pro_seller_subscriptions`, set `profiles.is_pro_seller`/`pro_seller_until` |
| `invoice.paid` (Pro Seller) | Extend `profiles.pro_seller_until` to the new `current_period_end` — does **not** touch Featured credits (those reset on the monthly cron, §15, not per-invoice) |

**Idempotency:** `webhook_events(stripe_event_id)` table (unchanged mechanism).

---

## 11. `recheck-listing-link` (new)

| | |
|--|--|
| **Auth** | User JWT (listing owner) |
| **Method** | POST |
| **Body** | `{ listing_id }` |

**Logic:**

1. Verify caller owns `listing_id`
2. Run `checkUrlHealth(listings.download_url)` immediately (bypasses the 6h cron cadence)
3. On success: close the matching `link_health_checks` issue (`issue_open = false`, `consecutive_failures = 0`); if the listing was `paused_pending_review` solely for this issue, restore `status = 'active'`
4. On failure: leave the issue open, return the failure to the seller so they know it's still broken

**Response:** `{ healthy: boolean }`

**Rate limit:** 10/hour/user (prevents hammering the seller's own host)

---

## 12. `create-pro-seller-checkout` (new)

| | |
|--|--|
| **Auth** | User JWT |
| **Method** | POST |

**Logic:**

1. Create or retrieve a Stripe Customer for the caller
2. Create a Subscription-mode Checkout Session for the Pro Seller price (admin-configurable)

**Response:** `{ checkout_url }`

---

## 13. `create-pro-seller-portal` (new)

| | |
|--|--|
| **Auth** | User JWT (active or past Pro Seller subscriber) |
| **Method** | POST |

**Logic:** Returns a Stripe Billing Portal session URL scoped to the caller's `stripe_customer_id`, for managing/canceling the subscription.

**Response:** `{ url }`

---

## 14. `create-featured-checkout` (new)

| | |
|--|--|
| **Auth** | User JWT (listing owner) |
| **Body** | `{ listing_id }` |

**Logic:**

1. Listing must be `active`, owned by caller
2. If caller `is_pro_seller` and has an unused `featured_listing_credits` row this period → return `{ use_credit: true }`, client calls `apply-featured-placement` directly with `source='pro_seller_credit'`, no Stripe charge
3. Else create a Stripe PaymentIntent for `featured_placement_price_cents` (config)

**Response:** `{ use_credit: true }` or `{ client_secret }`

---

## 15. `apply-featured-placement` (new)

| | |
|--|--|
| **Auth** | User JWT or service (webhook) |
| **Body** | `{ listing_id, source: 'paid' \| 'pro_seller_credit' }` |

**Logic:**

1. Idempotency on `payment_intent_id` (paid path) or a single credit redemption per call (credit path)
2. `listings.featured_until = now() + featured_placement_duration_days` (config, default 7)
3. Insert `featured_listing_purchases` row
4. If `source = 'pro_seller_credit'`, increment `featured_listing_credits.credits_used`

---

## 16. `admin-action` (extended)

| | |
|--|--|
| **Auth** | Admin or manager JWT (`profiles.role IN ('admin','manager')`), mandatory TOTP |
| **Body** | `{ action, listing_id?, user_id?, order_id?, report_id?, pro_seller_months?, notes? }` |

**Actions:**

| action | Effect | Role |
|--------|--------|------|
| `remove_listing` / `delete_listing` | `status = 'deleted'` + storage cleanup queued | admin, manager |
| `pause_listing` / `unpause_listing` | Toggle `status = 'paused_pending_review'` / restore `'active'` | admin, manager |
| `ban_user` / `unban_user` | `banned_at = now()` / clear | admin, manager |
| `warn_user` | Note in audit log, no state change | admin, manager |
| `shadow_ban_user` / `unshadow_ban_user` | Toggle `shadow_banned` | admin, manager |
| `dismiss_reports` | Report `status = 'dismissed'` | admin, manager |
| `confirm_strike` | Insert `seller_strikes` (`confirmed_by = auth.uid()`); pauses the listing; 3rd active strike triggers automatic ban | **admin only** |
| `dismiss_link_issue` | Close a `link_health_checks` issue as a false positive, no strike | admin, manager |
| `ban_for_ai_content` | Immediate `banned_at = now()`, **skips the normal warn-first ladder** | **admin only** |
| `grant_pro_seller` / `revoke_pro_seller` | Comp or revoke Pro Seller without Stripe (`pro_seller_months` for grant) | **admin only** |
| `refund_order` | Issues a Stripe refund on the order's PaymentIntent | **admin only** |

Insert a `moderation_actions` row for every action.

---

## 17. `admin-manage` (unchanged mechanism, new settings keys)

| | |
|--|--|
| **Auth** | Admin or manager JWT |
| **Body** | `{ action: 'get_settings' \| 'update_settings' \| 'create_promo' \| 'deactivate_promo', settings?, code?, type?, value?, scope?, seller_id?, max_redemptions?, expires_at?, promo_id? }` |

`update_settings` now writes `platform_fee_bps_free`, `platform_fee_bps_pro`, `featured_placement_duration_days`, `featured_placement_price_cents`, `link_health_grace_period_hours`, `strike_expiry_months`, `strike_ban_threshold` instead of the old radius/price-cap keys. `create_promo` supports `scope: 'seller'` (Pro Seller-scoped promo codes) in addition to `'platform'`.

---

## 18. `check-listing-links` (new, cron)

| | |
|--|--|
| **Auth** | Service role (pg_cron / scheduled Edge invocation) |
| **Schedule** | Every 6 hours |

**Logic:**

1. For every `active` listing: `checkUrlHealth(download_url)`
2. For every order in `awaiting_fulfillment` with a submitted `order_deliverables.deliverable_url`: `checkUrlHealth(deliverable_url)`
3. Update/insert `link_health_checks`; on first failure open an issue with `grace_period_ends_at = now() + link_health_grace_period_hours`; on success after a prior failure, close the issue

**Log:** count checked / newly opened / auto-closed

---

## 19. `check-youtube-videos` (new, cron)

| | |
|--|--|
| **Auth** | Service role |
| **Schedule** | Daily |

**Logic:** oEmbed-only re-check (no Data API call, to conserve quota) of every `active` listing's `youtube_video_url`. On failure, set `youtube_video_status = 'removed'` and flag the listing for the seller to fix — **never** writes a `seller_strikes` row (§8 of `11-Storage_and_Deletion_System.md`).

---

## 20. `purge_stale_drafts` (renamed from `purge-expired-listings`)

| | |
|--|--|
| **Auth** | Service role (cron) |
| **Schedule** | Daily 02:00 UTC |

**Logic:**

1. Select listings where `status = 'draft' AND draft_created_at < now() - interval '24 hours'`
2. For each: delete storage objects from `listing_images` paths
3. Delete DB rows (cascade `listing_images`)

This is a **draft-abandonment** cleanup only — there is no more `expires_at`/`purge_at` pair to act on for published listings (`03-Database_Schemas.md` §3.3).

**Log:** count purged

---

## 21. `reset_featured_listing_credits` (new, cron)

| | |
|--|--|
| **Auth** | Service role (cron) |
| **Schedule** | 1st of month |

**Logic:** For every currently-active Pro Seller subscriber, insert a new `featured_listing_credits` row (`credits_total = 4`, `credits_used = 0`, `period_start = <this month>`). Prior-period unused credits do not roll over.

---

## 22. Push notification delivery (DB trigger, not an edge function)

Unchanged mechanism — Postgres `AFTER INSERT` trigger `send_push_for_notification` on `notifications`, via `pg_net` to the Expo push API. New notification kinds routed through it: `order_paid`, `order_fulfilled`, `order_refunded`, `link_issue_opened`, `link_issue_grace_period_ending`, `strike_issued`, `pro_seller_renewed`, `connect_onboarding_incomplete`. Removed kind: `listing_expiring` (no more expiry).

---

## 23. `on-auth-user-created` / `sync-google-profile` (unchanged)

Unchanged from the physical-marketplace build — provider profile sync (`display_name`, `avatar_url`, `email`, `auth_provider`) on Google/Apple sign-in, callable client-side post-redirect. See `25-Google_Auth_and_Profile.md`.

---

## 24. Removed functions

| Function | Reason |
|----------|--------|
| `geocode-zip` | No ZIP/radius geo-discovery in a global digital catalog (`09-Search_and_Radius_System.md` retired) |
| `send-college-email-code` | College `.edu` verification is not a relevant trust signal for this domain |
| `verify-college-email-code` | Same as above |
| `create-boost-checkout` | Superseded by `create-featured-checkout` (§14) |
| `apply-boost` | Superseded by `apply-featured-placement` (§15) |
| `create-premium-checkout` | Superseded by `create-pro-seller-checkout` (§12) |
| `create-premium-portal` | Superseded by `create-pro-seller-portal` (§13) |
| `sync-premium` | Superseded by the Pro Seller webhook path (§10) |
| `get-seller-benefits` | Superseded by `get_seller_dashboard_summary` RPC (`03-Database_Schemas.md` §4.4) |
| `purge-expired-listings` | Renamed/repurposed as `purge_stale_drafts` (§20) — no more fixed-expiry listings to purge |

**Removed RPCs** (not standalone edge functions, but retired alongside the above): `register_waitlist_signup`, `get_waitlist_public_stats`, `get_referral_status` (waitlist/referral system), `propose_contact_agreement`, `accept_contact_agreement`, `get_conversation_contact_agreement`, `reveal_conversation_phones`, `reveal_seller_phone` (meetup phone-reveal/contact-agreement flow — no meetup concept in a remote marketplace), `mark_listing_sold_and_end_chat` (replaced by the order-fulfillment trigger), `record_listing_interest` (replaced by `create_review`'s purchase-verified gate), `approve_seed_listing`, `revoke_seed_approval`, `mark_seed_paid` (city-seeding program), `apply_listing_boost` (renamed `apply_featured_placement`).

**Removed admin screens:** `admin/waitlist.tsx`, `admin/ios-waitlist.tsx`, `admin/seed.tsx`, `admin/college-students.tsx`.

---

## 25. Deployment

```bash
supabase functions deploy create-connect-account
supabase functions deploy connect-onboarding-link
supabase functions deploy create-listing
supabase functions deploy finalize-listing-images
supabase functions deploy upsert-listing-addon
supabase functions deploy validate-youtube-video
supabase functions deploy create-order-checkout
supabase functions deploy submit-order-deliverable
supabase functions deploy stripe-webhook
supabase functions deploy recheck-listing-link
supabase functions deploy create-pro-seller-checkout
supabase functions deploy create-pro-seller-portal
supabase functions deploy create-featured-checkout
supabase functions deploy apply-featured-placement
supabase functions deploy admin-action
supabase functions deploy admin-manage
# ... deploy all
```

Set secrets before deploy (Stripe, YouTube Data API key). Test with `supabase functions serve --env-file .env.local`.

---

## 26. Testing matrix

| Function | Test |
|----------|------|
| `create-listing` | price ≤ 0 fails; keyword fails; < 3 images at finalize fails; unverified seller (`SELLER_NOT_PAYOUT_READY`) fails; missing license text fails |
| `validate-youtube-video` | non-embeddable video rejected; `madeForKids` video rejected; valid public video passes |
| `create-order-checkout` | unacknowledged license fails; sold/paused listing fails; correct `application_fee_amount` for free vs Pro Seller tier |
| `stripe-webhook` | replay same event id is a no-op; OTU listing auto-marks `sold` on fulfillment |
| `submit-order-deliverable` | wrong seller rejected; order not in `awaiting_fulfillment` rejected |
| `check-listing-links` | broken link opens an issue with correct `grace_period_ends_at`; recovered link auto-closes |
| `recheck-listing-link` | non-owner rejected; healthy re-check restores a `paused_pending_review` listing |
| `admin-action: confirm_strike` | 3rd active strike triggers automatic ban |
| `admin-action: ban_for_ai_content` | bans immediately without a prior warning record |
| `purge_stale_drafts` | draft older than 24h removed + storage cleaned; published listings untouched regardless of age |

---

## 27. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05 | Original hyperlocal physical-goods marketplace edge function inventory (superseded) |
| 2.0 | 2026-07-21 | Full rewrite for VtuberMarketplace: added Stripe Connect onboarding, order checkout/fulfillment, YouTube video validation, link-health/strike cron + admin actions, Pro Seller + Featured Listing monetization functions; removed geocode-zip, college verification, boost/premium, waitlist/seed-program, and contact-agreement functions and RPCs |
| 2.1 | 2026-07-21 | Corrected the `admin-action`/`recheck-listing-link` auto-pause status literal from `paused` to `paused_pending_review` to match migration 121's enum reuse (no new `paused` value was added to `listing_status`) |
