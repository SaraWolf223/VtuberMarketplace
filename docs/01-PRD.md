# VtuberMarketplace — Product Requirements Document

**Version:** 2.0
**Status:** Approved for domain conversion (VTuber digital-asset marketplace, converted from a hyperlocal physical-goods prototype 2026-07-21)
**Project type:** Global digital marketplace
**Platforms:** Web (primary launch target), iOS + Android (Expo React Native, kept build-ready)
**Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
**Auth:** Google, Apple (iOS), and email/password via Supabase Auth
**Payments:** Stripe Connect Express (destination charges, tiered platform commission)
**Build method:** Cursor AI Auto Mode with phased documentation

---

## 1. Executive summary

VtuberMarketplace is a global marketplace where VTuber creators (riggers, artists, modelers) sell **pre-made digital assets** — 2D Live2D models, 3D VRM/FBX models (including VRChat avatars/props), PNGtuber models, accessories, backgrounds/overlays, and base models — to buyers anywhere in the world. There is no local/geo discovery: this is a global digital catalog, not a hyperlocal classifieds app.

Every asset carries a **seller-authored license** — either **OTU** (One-Time-Use, a full rights transfer) or **P2U** (Pay-to-Use, a non-exclusive usage license) — and is delivered via a **seller-hosted download link** (the platform never stores or proxies asset files). Payment runs through **Stripe Connect**, with the platform taking a **10% commission** (8% for Pro Seller subscribers) on every sale; Stripe handles KYC, payouts, and the buyer-side processing fee.

**Positioning:** the trustworthy, creator-friendly home for pre-made VTuber assets — clear licensing, verified purchase reviews, and a strike system that keeps sellers accountable for working download links, without the platform inserting itself into the buyer/seller relationship as a merchant of record.

**Success definition (first 90 days):**

| Metric | Target |
|--------|--------|
| New listings/week | ≥15 |
| Active sellers (Stripe Connect enabled) | ≥25 |
| Live listings | ≥75 |
| Orders/week | ≥20 |
| Pro Seller conversion | ≥5% of active sellers |
| Buyer review rate (post-purchase) | ≥25% of fulfilled orders |
| D30 seller retention (relist/new listing) | ≥40% |

Revenue and downloads are tracked from week one (unlike the prior physical-goods MVP) since real payments are live from launch.

---

## 2. Vision and principles

| Principle | Meaning |
|-----------|---------|
| **Global, not local** | No ZIP/radius discovery — every listing is visible to every buyer worldwide, filtered by category/license/price/compatible software |
| **Creators own their licensing** | The platform never writes a mandated license; every seller authors their own OTU/P2U terms |
| **Trust through verification** | Purchase-verified reviews only, license snapshotting at checkout, and a strike system for broken download links |
| **Low platform footprint, low cost** | No file storage/bandwidth cost — sellers host their own files; the platform is a facilitator, not a file host or merchant of record |
| **Facilitator, not liable party** | The platform disclaims responsibility for the outcome of any buyer/seller transaction — see the legal stack |
| **Content integrity** | Mature (non-explicit) content is allowed and age-gated; explicit content and AI-generated content are both banned, with AI-content violations escalating straight to a ban |

### 2.1 Listing quality guardrails

- Minimum **3 gallery photos** to publish, plus a **separate dedicated feed thumbnail**
- Exactly **one valid, embeddable YouTube demo video** required to publish — validated via oEmbed + YouTube Data API v3 (`embeddable`, `madeForKids`)
- Every listing must have seller-authored license text (OTU or P2U)
- Sellers must set a **portfolio URL** on their profile before publishing any listing; optional showcase gallery (up to 6 images) + social/website links
- Report rate monitored: if **>2%** of listings reported in a week, tighten keyword filters and review moderation thresholds

---

## 3. Business model

### 3.1 Revenue streams

| Stream | Structure | Notes |
|--------|-----------|-------|
| Platform commission | **10%** of order total (free-tier sellers) | Stripe Connect destination charge `application_fee_amount`; buyer separately covers Stripe's processing fee + tax |
| Platform commission (Pro Seller) | **8%** of order total | Discount for active Pro Seller subscribers |
| Pro Seller subscription | Monthly, admin-configurable price | Fee discount, Featured Listing credits, analytics, badge, shop customization, **seller-scoped promo codes + timed listing sale periods** |
| Pay-per-use Featured Listing | One-time, admin-configurable price | Any seller can buy a single Featured placement à la carte |
| Model-support subscriptions | Monthly, seller-set price per eligible listing | Purchasers-only recurring support on full 2D/3D/VRChat models; platform takes same Connect fee % |
| Support work quotes | One-off destination charges | Seller quotes extra work to an active subscriber; buyer accepts then pays |

### 3.2 Revenue streams (post-MVP, documented only)

- Tiered commission for high-volume sellers
- Platform-run seasonal asset bundles/sales events
- Sponsored/featured category placements

See **10-Monetization_System.md** and **15-MVP_vs_Future_Features.md**.

### 3.3 Cost targets

| Stage | Monthly infra target |
|-------|----------------------|
| Launch | $0–100 (free tiers; no file storage cost since assets are seller-hosted) |
| Moderate growth | $150–600 (Supabase compute, YouTube Data API quota, email) |

---

## 4. Target users

### 4.1 Primary personas

**Live2D/3D rigger with a back catalog** — has pre-made models/accessories sitting unsold; wants a storefront with real payments and clear licensing instead of ad-hoc Discord/Ko-fi sales.

**VRChat avatar/prop creator** — sells 3D avatars and accessories, often bundling a "setup fee" service (uploading the model to the buyer's VRChat account via the Unity SDK) alongside the base asset.

**New/aspiring VTuber (buyer)** — wants a ready-to-stream PNGtuber, Live2D, or 3D model without commissioning a full custom rig; values a working demo video and clear license terms before buying.

**Established VTuber (buyer)** — buys accessories, backgrounds, or a second model; wants a customization option (recolor, resize) to make an off-the-shelf asset feel unique.

### 4.2 Anti-personas (do not optimize for)

- Freelance commission artists selling bespoke, made-to-order work (this is a pre-made-asset marketplace, not a commission board)
- Physical goods sellers of any kind
- Local/geo-restricted transactions
- Sellers seeking to sell AI-generated assets

---

## 5. Platform rules (hard requirements)

### 5.1 Price

- `price` MUST be `> 0` USD — no fixed upper cap
- Enforced: client form validation, DB check constraint, edge function on insert/update
- Currency: USD only for MVP

### 5.2 Digital delivery, seller-hosted

- The platform never stores or proxies the sold asset file — only a link to the seller's own hosting (Google Drive, Dropbox, Mega, itch.io, personal host, etc.)
- Copy and UX must state the seller is solely responsible for link uptime and file content; a broken link is enforced via the strike system (§9 of **11-Storage_and_Deletion_System.md**), not by the platform hosting a fallback copy
- Preview images (listing photos) remain platform-hosted in the existing public storage bucket — only the *sold asset* is seller-hosted

### 5.3 Digital VTuber assets only

Allowed asset types: 2D Live2D models, 3D models (incl. VRChat avatars/props), PNGtuber models, accessories/props, backgrounds/overlays, base models — see §8. Prohibited: physical goods, freelance commissions, AI-generated content, explicit sexual content, stolen/unauthorized art — see **12-Moderation_and_Safety.md**.

### 5.4 Licensing (OTU/P2U, seller-authored)

- Every listing chooses **OTU** (One-Time-Use — full rights/copyright transfer; delists after the single sale) or **P2U** (Pay-to-Use — non-exclusive usage license; stays listed for resale to other buyers)
- The seller writes their own license text (required field); the platform provides an optional editable template, never a mandated legal text
- At checkout, the buyer must check an acknowledgment box; the exact license text is copied into `orders.license_snapshot` as an immutable record

### 5.5 Communication

- **In-app direct messages**, per-listing threads between buyer and seller (one thread per buyer/listing pair), used for pre-purchase questions and post-purchase customization/setup coordination
- Sending requires **email verification** (not phone verification — phone verification is reserved for seller Stripe Connect payout gating), is rate-limited (15 msgs/min/conversation), and message bodies pass through the same banned-keyword filter as listing text
- Blocking a user immediately blocks new messages between them (existing history stays visible)
- There is no phone-reveal/meetup-agreement flow — this is a fully remote, digital-delivery marketplace

### 5.6 Images & video

- Minimum **3**, maximum **5** photos per listing
- Exactly **one** required YouTube demo video URL (public or unlisted, on the seller's own channel) — validated at submission and periodically re-checked
- Max **2 MB** per image after client compression; formats: JPEG, PNG, WebP

---

## 6. MVP feature specification

### 6.1 Authentication (Google, Apple, email/password)

| Feature | Requirement |
|---------|-------------|
| Sign up / in | **Google OAuth**, **Apple Sign-In** (iOS only), or **email/password** — all three offered |
| Profile on sign-in | Account + profile auto-created from the provider (name, email, photo for Google/Apple) or collected on sign-up (email/password) — see [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md) |
| Password reset | Email/password accounts can request a reset link |
| 2FA | Optional TOTP for any user; **mandatory** for admin/manager roles |
| Session | Persist across app restarts |
| Account deletion | Request flow; 30-day soft delete optional |

### 6.2 Listings (digital assets)

| Action | Requirement |
|--------|-------------|
| Create | Title, price, category, asset type (drives conditional structured fields), license type + license text, ≥3 photos, 1 validated YouTube demo video, download URL |
| Edit | Owner only; re-validate price is greater than $0 |
| Delete | Owner soft-delete; admin hard-delete |
| Mark sold (OTU only) | Sets `status = sold` after the single purchase; delists from feed |
| Lifecycle | No fixed expiry — stays live until unpublished, sold (OTU), or auto-paused by the link-health/strike system |
| Add-ons | Optional seller-defined customization fee(s) and/or setup fee(s) (stackable, multi-select at checkout) |
| Support duration | Seller picks none/30 days/90 days/lifetime for post-sale bug-fix support |

### 6.3 Discovery & search

| Feature | Requirement |
|---------|-------------|
| Home feed | Global catalog, newest/Featured first — no geo filter |
| Keyword search | Title + description full-text |
| Filters | Category (incl. VRChat), license type (OTU/P2U), price range, customization/setup availability, support duration, asset type, compatible software, file format, mature-content toggle |
| Sort | Newest (default), price low/high, Featured |
| Performance | Initial feed target < 2s on mid-tier device |

### 6.4 Profiles

| Field | Source | Public | Owner-only |
|-------|--------|--------|------------|
| Display name | Provider / sign-up form | Yes | |
| Avatar | Provider (Google/Apple) or uploaded | Yes | |
| Username | Auto-generated; editable in settings | Yes | |
| Join date | App | Yes | |
| Avg rating | App (purchase-verified reviews) | Yes | |
| Review count | App | Yes | |
| Listing count | App | Yes | |
| Pro Seller badge | App | Yes | |
| Stripe Connect status | App | | Yes (seller dashboard) |
| Email | Provider / sign-up | | Yes |
| Phone | Seller-only, required for Connect payouts | | Yes |

Full spec: [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md).

### 6.5 Ratings & reviews — purchase-verified only

- A buyer may review a listing **only if they hold a completed (`fulfilled`) order** for it — no interest/DM-count eligibility path
- One review per buyer per listing (prevents spam)
- Seller aggregate rating on profile

### 6.6 Favorites

- Save listing to favorites list
- Favorites screen with availability indicator (hides/flags sold OTU listings)

### 6.7 Payments (Stripe Connect)

- Buyer pays via Stripe Checkout; destination charge routes the seller's share (minus Stripe's processing fee) to their Connect account and the platform's commission (10%/8%) to the platform's Stripe balance
- Seller must complete Stripe Connect onboarding (`charges_enabled` + `payouts_enabled`) and verify their phone number before publishing listings
- Buyer separately covers Stripe's processing fee and applicable tax (Stripe Tax)

### 6.8 Pro Seller membership (replaces Boost/Premium)

- Reduced commission (8% vs 10%), monthly Featured Listing credits, analytics dashboard, verified badge, shop customization, seller-scoped promo codes
- Pay-per-use Featured Listing credit available to any seller without a subscription

### 6.9 Moderation

- Report listing / report user, including a dedicated **"download link not working"** reason tied to a specific order
- Banned keyword filter on title + description + DM message bodies
- **AI-generated content is banned outright** — confirmed violations escalate straight to an account ban (no warn-first step)
- Admin: remove listing, ban, shadow ban, report queue, strike-confirmation queue

### 6.10 Digital delivery & strikes

- `listings.download_url` delivered immediately for orders with no selected add-on; `order_deliverables.deliverable_url` for orders where the buyer selected a customization and/or setup add-on
- Scheduled link-health checks + buyer reports feed a grace-period pipeline; unresolved issues route to an admin confirmation queue before a strike is recorded
- 3 non-expired strikes (12-month rolling window) → automatic account ban

---

## 7. User flows

### 7.1 First-time user (buyer)

```
Open app → Onboarding (VTuber-asset marketplace pitch) →
Continue with Google/Apple/email → Profile synced → Global feed (no location prompt)
```

### 7.2 List an asset (seller)

```
Complete Stripe Connect onboarding + phone verification →
Tap Sell → Asset type → Conditional structured fields → License type + license text →
≥3 photos → YouTube demo video URL (validated) → Optional customization/setup add-ons →
Support duration → Download URL → Preview → Publish
```

### 7.3 Buy an asset

```
Listing detail → Photos + embedded YouTube demo → License terms + OTU/P2U banner →
Select optional customization/setup add-ons → Checkout (Stripe) → Accept license snapshot →
Pay → Immediate download link (no add-ons) OR "awaiting fulfillment" (add-ons selected) →
Buyer Library shows the order + link → Optional: review after fulfillment
```

### 7.4 Seller fulfills a customization/setup order

```
Seller dashboard → Orders → Order awaiting fulfillment →
Complete customization/setup work → Paste deliverable link →
Order marked fulfilled → Buyer notified + Library updated
```

### 7.5 Report a broken download link

```
Buyer Library → Order → "Download link not working" →
Report opens issue → Seller grace period → Fixed (closed) OR escalated to admin queue → Strike (if confirmed)
```

---

## 8. Category & asset-type system

**Two orthogonal axes:**

- **`listings.asset_type`** — fixed enum driving which structured fields the create/edit form shows: `live2d_2d`, `model_3d`, `pngtuber`, `accessory_prop`, `background_overlay`, `base_model`, `other`.
- **`category`** — admin-configurable table (`listing_categories`), used for browsing/filtering, not tied 1:1 to `asset_type`. Seeded with defaults including **VRChat**, Live2D, PNGtuber, Chibi, Kemonomimi, Fantasy, Original Character, and Miscellaneous — buyer's admin can add/edit/reorder/deactivate at runtime from **Admin → Categories**.

See [03-Database_Schemas.md](./03-Database_Schemas.md) §Listings for the full structured-field breakdown per asset type.

---

## 9. Listing lifecycle

No fixed freshness expiry. A listing stays **active** until:

- The seller unpublishes it, or
- It sells under an **OTU** license (auto-marks `sold`, delists), or
- It is **auto-paused** by the link-health/strike pipeline for a broken download link (see **11-Storage_and_Deletion_System.md** §Strikes)

**P2U** listings never auto-delist from a sale — they stay available for repeat sales until the seller unpublishes them.

---

## 10. Discovery (no geo/radius)

This is a global catalog — there is no ZIP/radius filtering (`09-Search_and_Radius_System.md` is retired). The feed and search use:

- Full-text search (title + description)
- Category, license type, **effective price range** (after Pro Seller timed sales), asset type, compatible software (incl. VRChat), file format, mature-content toggle, customization/setup availability, support duration
- **Published date range** and **minimum seller rating** filters
- Featured placement (Pro Seller subscription credit or pay-per-use purchase) as a sort tier
- Feed cards use each listing’s dedicated `feed_thumbnail_path`

### 10.1 Model-support subscriptions

Eligible listings (`live2d_2d`, `model_3d`, or category `vrchat`) may offer a **monthly support plan** (seller-set price + offerings text). Only buyers with a **fulfilled order** for that listing may subscribe. Extra work uses a formal **quote → accept → Stripe charge** flow; informal negotiation remains available via DMs.

### 10.2 Profile bulletin board

Every profile may show **one current bulletin post** at a time (new posts archive the previous). Other users may comment (email-verified, rate-limited, keyword-filtered). Staff can hide posts/comments.

### 10.3 Pro Seller discounts

Only **Pro Sellers** may create seller-scoped promo codes and timed listing sale periods.

---

## 11. Non-goals (explicit)

Do NOT implement:

- Freelance/bespoke commission listings (made-to-order work)
- Auctions/bidding
- Platform-hosted file storage or CDN delivery of sold assets
- AI-generated asset listings (banned content category, not a feature gap)
- Multi-currency (USD only for MVP)
- Escrow beyond what Stripe Connect itself provides

---

## 12. Admin requirements

Minimum admin capabilities:

- View report queue, including link-health/strike confirmation queue
- Remove listing (with reason code)
- Ban user (`banned_at`, reason); AI-content violations use a direct-to-ban action
- Shadow ban (listings never appear in feed, user not notified)
- View moderation audit log
- Manage fee-tier percentages, Featured credit price/duration, grace-period length, strike expiry window (all runtime-configurable, not hardcoded)

**Runtime-configurable admin panel (in-app, not a Supabase dashboard/Retool workaround):** the admin role configures the deployment itself at runtime, without a code change or rebuild — logo/colors, categories, fee tiers, moderation auto-pause thresholds, email templates, and a setup-status checklist for every required key/secret. Mandatory TOTP 2FA for `admin`/`manager`. See `app/admin/*` and [03-Database_Schemas.md](./03-Database_Schemas.md).

---

## 13. Analytics (MVP events)

See **19-Analytics_and_Growth.md**. Minimum funnel:

`sign_up` → `feed_viewed` → `listing_viewed` → `checkout_started` → `order_completed`
Supply: `listing_created`, `connect_onboarding_completed` · Monetization: `pro_seller_subscribed`, `featured_purchased` · Health: `report_submitted`, `strike_issued`, `link_check_failed`

---

## 14. Launch strategy

- **Technical:** the app works globally from day one (no geo dependency)
- **Marketing:** the **website** ([28-Web_App.md](./28-Web_App.md)) is the first launch target for traction; native app screens are kept in sync and store submission is deferred
- **Pre-launch:** concierge-seed a starting catalog across each asset type (2D/3D/PNGtuber) so the feed isn't empty; onboard early sellers through Stripe Connect
- **Primary metric:** orders/week and Stripe Connect-onboarded active sellers

---

## 15. Tech stack (canonical)

| Layer | Choice |
|-------|--------|
| Mobile/web | Expo SDK 57, React Native, TypeScript strict |
| Navigation | Expo Router (file-based) |
| Server state | TanStack React Query v5 |
| Client state | Zustand (prefs, draft listing, UI) |
| Backend | Supabase |
| DB | PostgreSQL (PostGIS extension removed — no geo queries) |
| Auth | Supabase Auth (Google, Apple, email/password) |
| Files | Supabase Storage bucket `listing-images` (previews only — sold assets are seller-hosted links) |
| Payments | Stripe Connect Express (destination charges) + Stripe Subscriptions (Pro Seller) |
| Video | YouTube (oEmbed + Data API v3 for demo video validation, `youtube-nocookie.com` embeds) |
| Push | Expo Notifications |

---

## 16. Acceptance criteria (conversion done)

- [ ] User can sign in with Google, Apple (iOS), or email/password
- [ ] Seller can complete Stripe Connect onboarding + phone verification before publishing
- [ ] Seller can create a listing with asset type, OTU/P2U license, ≥3 photos, 1 validated YouTube video, download URL, and optional customization/setup add-ons
- [ ] Feed shows the global catalog with the new filter set (no geo filter)
- [ ] Buyer can complete a Stripe Checkout purchase, accept the license snapshot, and receive the download link (or see "awaiting fulfillment" for add-on orders)
- [ ] Buyer can review a listing only after a fulfilled order
- [ ] Broken download links flow through the grace-period → admin-confirmation → strike pipeline
- [ ] Admin can action reports, strikes, and AI-content violations (direct ban)
- [ ] In-app DM works between buyer/seller, gated by email verification
- [ ] Legal stack (ToS, Seller Agreement, Buyer Purchase Terms, DMCA, Privacy, Community Guidelines) reflects the marketplace-facilitator model
- [ ] App builds for iOS and Android via EAS; website exports/deploys

---

## 17. Product decisions baked into these docs

| Question | Decision reflected in docs |
|----------|-----------------------------|
| Exclusive license = ownership transfer or exclusive-use license? | Full rights/copyright transfer (OTU); P2U is the non-exclusive usage-license option |
| Who writes the license text? | The seller, always — the platform never mandates license copy |
| Where are sold files hosted? | Seller's own hosting; the platform stores only preview images |
| Is a YouTube demo video optional for any category? | No — required for every listing, no exemptions |
| Does a setup fee differ from a customization fee? | Yes — setup is a service (e.g. VRChat avatar upload), customization edits the asset file; both are stackable, independently priced add-ons |
| Can platform liability be implied anywhere in copy? | No — marketplace-facilitator stance throughout; see legal stack |

---

## 18. Document dependencies

This PRD is implemented through:

- **03-Database_Schemas.md** — tables, RLS, indexes
- **04-API_Endpoints.md** — contracts
- **08-Cursor_Prompts.md** — phased implementation commands

When PRD and child docs conflict, **PRD wins** unless child doc is newer and explicitly marked as amendment.

---

## 19. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.0–1.3 | 2026-05 to 2026-07 | Original hyperlocal physical-goods marketplace PRD (superseded) |
| 2.0 | 2026-07-21 | Full domain conversion to VtuberMarketplace: digital VTuber assets, OTU/P2U licensing, Stripe Connect payments, seller-hosted delivery, Pro Seller membership, purchase-verified reviews, strike system, removal of ZIP/radius and all physical-marketplace-only features |
