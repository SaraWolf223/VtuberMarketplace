# Local Marketplace — New Features Spec (Phase 2)

**Version:** 1.1  
**Date:** 2026-05-24 (updated 2026-05-25 — college badge)  
**Research refs:** OfferUp, Facebook Marketplace (UX, ads, legal patterns — not copying proprietary assets)

---

## 1. Profile aggregate rating

- Under **display name** on every public profile: combined rating from **all reviews** (all listings / transactions).
- Show: average stars (1 decimal), review count, e.g. `4.8 ★ (23 reviews)`.
- Hide block if count = 0 (“No reviews yet”).
- Source: `profiles.rating_avg` + `profiles.rating_count` (maintained by review triggers).

---

## 2. Direct messages (replace auto call/text as primary contact)

- **Goal:** Protect phone numbers; reveal contact only when users choose in DM thread.
- **MVP chat:** 1:1 threads tied to a `listing_id` (optional context header).
- **Flow:** Listing detail → “Message seller” → create/open thread → realtime or poll messages.
- **No** auto-launch SMS/dialer on tap; optional “Share phone” message type later.
- **Gates:** Phone-verified users only can send DMs (see §8). Unverified can read listing detail only.
- **Safety:** Report user + block user from thread; apply blocks (no new messages either direction).
- **Tables:** `conversations`, `conversation_participants`, `messages` (see migrations in prompt 15).

---

## 3. Report user & block user

- **Report:** listing OR user; reason enum per `12-Moderation_and_Safety.md`.
- **Block:** blocker never sees blocked user’s listings in feed/profile; blocked user cannot DM blocker.
- **Listing auto-pause (automation):**
  - **10 reports** within **rolling 24 hours** → `listings.status = paused_pending_review`
  - **OR 50 lifetime reports** on same listing → same pause state
  - Paused listings hidden from feed/search; seller sees “Under review”
  - **Admin** (future panel): approve (unpause) or delete listing + optional user ban
- Until admin panel ships: SQL/Supabase dashboard queue + minimal `admin-action` edge.

---

## 4. Categories & search radius

### 4.1 Categories (replace `clothing`)

Remove enum value `clothing`. Add:

| Slug | Label |
|------|-------|
| `womens_clothing` | Women's clothing |
| `mens_clothing` | Men's clothing |
| `college_school` | College / schooling |
| `books` | Books |
| `bikes` | Bikes |
| `decorations` | Decorations |
| `food_beverage` | Food & beverage |
| `carpool` | Carpool |
| `hobby` | Hobby |
| `delivery` | Delivery |

Keep existing: electronics, gaming, furniture, home, collectibles, toys, automotive, sports_outdoors, miscellaneous.

Migration: map legacy `clothing` → `miscellaneous` or `womens_clothing` (document choice).

### 4.2 Radius options

Add **0.5, 1, 2** mile options. Full set: `0.5, 1, 2, 5, 10, 25, 50` miles.

- Update `user_prefs.radius_miles` check constraint
- Update `get_feed_listings` RPC / geo filter
- Location settings chips + feed filter UI

---

## 5. Public profile — seller listings grid

- Section: **“Listings by this seller”** (OfferUp/Facebook-style grid, not one-at-a-time).
- **Active:** thumbnail grid; show **time remaining** until `expires_at`.
- **Sold:** still in DB, shown with **sold** badge + **faded overlay** (not in default feed).
- **Deleted** (user or platform): **hard removed** from DB + storage — never shown anywhere.

---

## 6. Feed layout (OfferUp-style)

- **Grid:** 2 columns on phone (adjust tablet), variable height cards with image + price + title snippet.
- **Not** single full-width card per row only.
- Interleave **ad rows** per §7 (below).
- **Shipped (prompt 14):** `FlatList` + paired rows (`FeedGridListingRow`); compact `ListingCard` `variant="grid"`.
- Ad cadence: **6 listing cells** → full-width AdMob ad row (`LISTINGS_PER_AD_SLOT`).

---

## 7. Advertising

### 7.1 Google AdMob (Play Store)

- **OfferUp-style in-feed ads:** full-width **native/video** cards between listing rows (~every 6 cells), labeled **Sponsored**, video muted autoplay when live. See `docs/google-feed-video-ads.md`.
- **Placeholder:** `FeedGoogleVideoAdPlaceholder` until `EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE=true` + native ad unit IDs.
- Test unit IDs in dev; production units in EAS secrets.
- No ads on auth/onboarding/location-setup.
- Comply with [Google Play ads policy](https://support.google.com/googleplay/android-developer/answer/9857753).

---

## 8. College student badge (edu email)

**Goal:** Trust signal for college sellers; optional feed filter for buyers near campus.

### 8.1 Verification

| Rule | Detail |
|------|--------|
| Email | User enters **`.edu` email** (validate domain; block disposable patterns) |
| OTP | 6-digit code emailed via Edge (Resend/SendGrid/Supabase-compatible provider — same pattern as SMS OTP doc) |
| Badge active | `.edu` verified (`college_edu_email`, `college_badge_verified_at`) and `college_badge_expires_at > now()` |
| Expiry | `profiles.college_badge_expires_at = verified_at + 1 year` |
| Re-verify grace | After expiry, **10 days** (`college_reverify_deadline_at = expires_at + 10 days`) to OTP again; badge hidden during grace |
| Purge | If grace ends without re-verify, `purge_expired_college_badges()` clears college fields (cron: `purge-expired-college-badges`) |
| Admin list | Only users with **active** verified badge (not grace, not purged) |
| Re-verify | Once per year user must repeat OTP on same or new `.edu` email to extend expiry |
| Badge UI | “College student” badge on profile, listing cards (optional), listing detail seller row |
| Settings | `app/settings/verify-college-email.tsx` — status, expiry date, “Renew verification” |

**Separate from** Google account email and **phone** verification (all three can be independent).

### 8.2 Feed filter

- **Feed filters sheet** (`FeedFiltersSheet`): toggle **“College students only”** (persist in `user_prefs` or `feed-filters-store`).
- `get_feed_listings`: when enabled, only listings where seller has active badge (`college_badge_expires_at > now()`).
- Empty state copy when filter on and no results.

### 8.3 Schema sketch

- `profiles`: `college_edu_email`, `college_badge_verified_at`, `college_badge_expires_at`, `college_reverify_deadline_at`
- `user_prefs`: `feed_college_students_only BOOLEAN DEFAULT false`
- `college_email_verification_codes` (hash, expires_at, user_id) — mirror phone OTP table pattern
- Edge: `send-college-email-code`, `verify-college-email-code`

### 8.4 Abuse

- Rate limit: 3 send-code / hour per user; 10 / day per edu domain
- One active `.edu` per account at a time (changing email resets pending codes)

---

## 9. Phone verification gates

- **Mandatory** SMS OTP (Supabase Auth phone or Twilio Verify — decide in implementation).
- **Required before:** create listing, send DM, boost/premium pay, report/block (optional: allow report when unverified).
- **Allowed without phone:** browse feed, open listing detail, favorites (read-only OK).
- UI: `app/settings/verify-phone.tsx` + intercept modals on gated actions.
- `profiles.phone_verified_at` + `profiles.phone` (E.164).

---

## 10. Anti-spam & DDoS protection

| Layer | MVP |
|-------|-----|
| Edge functions | Per-IP + per-user rate limits (Supabase/KV or in-memory + DB sliding window) |
| Reports | 5/user/hour (existing doc) |
| Listings | Max N creates per day per user |
| DMs | Max messages per minute per thread |
| Auth | Supabase built-in + captcha on abuse (optional) |
| WAF | Cloudflare in front of API if custom domain (document) |
| DB | Connection pooling; statement timeouts |

Document limits in `docs/12-Moderation_and_Safety.md` § Rate limits.

---

## 11. Database cleanup (hard delete)

- User deletes listing → Edge deletes `listing_images` storage objects + DB row (CASCADE).
- Admin delete / moderation delete → same.
- Purge job already planned 7 days after expiry (standard day 28; Premium 2 months + 7 days) — align with **no soft-delete** for user-facing removal.

---

## 12. Image upload limit

- **Max 2 MB** per image after compression (reconfirm in `create-listing` + client compressor).
- Reject larger with clear error before upload.

---

## 13. Legal & compliance (research task)

- Review OfferUp + Facebook Marketplace **Terms**, **Community Standards**, **Privacy**, **commerce policies**.
- Update `docs/legal/TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`, add:
  - Prohibited items (align moderation doc)
  - User-generated content license
  - Phone verification / SMS consent (TCPA-style language — counsel review)
  - Report/block process
  - “As-is” local meetup disclaimer (no escrow)
- **Not legal advice** — flag “attorney review before launch” in doc.

---

## 14. Admin panel (prompt 20)

### 14.1 Moderation queues

- Paused listings (auto-paused from reports)
- Open reports

### 14.2 Promo codes (admin-created)

| Type | Behavior |
|------|----------|
| `free_boosts` | Redeem N paid boosts without Stripe (credits or one-time grants) |
| `free_premium_month` | **1 calendar month** Premium access, then auto-expires (no Stripe sub) |

- Admin creates codes: code string, type, value, max redemptions, optional expires_at.
- Track redemptions per user (no double-redeem).
- Edge: `redeem-promo-code` (user) + admin CRUD in panel.

### 14.3 Boost & monetization settings (admin)

- Adjust platform defaults: boost duration (hours), base boost price display, premium credit count per month (read from config table).
- Changes apply to **new** checkouts; document behavior for in-flight boosts.

### 14.4 Schema sketch

- `platform_settings` (key/value JSON)
- `promo_codes`, `promo_redemptions`

MVP: Supabase SQL + `app/admin/*` gated by `profiles.role = admin`.

---

## 15. Competitive UX checklist

| Pattern | OfferUp | Facebook Marketplace | Local Marketplace target |
|---------|---------|----------------------|-----------------|
| Feed grid | 2-col | 2-col | 2-col |
| Ads in feed | Native + banners | Mixed | AdMob only |
| Contact | In-app chat | Messenger | In-app DM |
| Trust | Profile ratings | Ratings + mutual friends | Aggregate rating + phone verify |
| Sold items | Faded on profile | Mark sold | Faded on profile |
