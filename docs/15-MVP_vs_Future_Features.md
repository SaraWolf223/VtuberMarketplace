# VtuberMarketplace — MVP vs Future Features

**Version:** 2.0
**Rule:** If it's in the **Future** column, Auto Mode must NOT implement it unless the user explicitly overrides. If it's in the **Retired** section (§3), Auto Mode must NOT implement it at all — these are not deferred, they're inapplicable to this domain.

---

## 1. Feature matrix (MVP vs Future, current domain)

| Feature | MVP | Future |
|---------|-----|--------|
| Google, Apple (iOS), email/password auth | ✓ | — |
| Profile from provider (Google/Apple name + photo) or sign-up form (email) | ✓ | Custom avatar upload for provider accounts |
| Optional TOTP 2FA (any user); mandatory for admin/manager | ✓ | — |
| Create/edit/delete listing (digital asset) | ✓ | — |
| No fixed listing price cap (`price > 0`) | ✓ | — |
| Asset type structured fields (Live2D/3D/PNGtuber/etc.) | ✓ | Additional asset types as the catalog grows |
| OTU/P2U licensing, seller-authored license text | ✓ | Platform-suggested license templates library |
| ≥3 photos (max 5), 2MB compress | ✓ | — |
| Exactly 1 required YouTube demo video, oEmbed + Data API validation | ✓ | Multiple demo videos per listing |
| Category filters (admin-configurable, incl. VRChat) | ✓ | Subcategories |
| Keyword search (title + description) | ✓ | Fuzzy/trigram search |
| Filters: license type, price, asset type, compatible software, file format, mature toggle, support duration, addon availability | ✓ | Saved searches / deal alerts |
| Sort: newest, price low/high, Featured | ✓ | Trending/relevance algorithm |
| Listing detail | ✓ | — |
| Stripe Connect Express seller onboarding (KYC gate) | ✓ | — |
| Real order checkout (Stripe destination charge) | ✓ | — |
| 10%/8% fee-tier commission | ✓ | Volume-tiered commission |
| **In-app DM** (per-listing thread, email-verified senders, rate-limited, keyword-filtered) | ✓ | — |
| Favorites | ✓ | — |
| Purchase-verified reviews/ratings | ✓ | Photo reviews |
| Block user | ✓ | — |
| Report listing/user, incl. `download_link_not_working` | ✓ | — |
| Pro Seller subscription (reduced fee, Featured credits, analytics, badge, shop customization, seller promo codes) | ✓ | Tiered Pro Seller levels |
| Pay-per-use Featured Listing purchase | ✓ | Multi-day Featured packs |
| Customization/setup add-ons (stackable, seller-priced) | ✓ | Add-on templates library |
| Support duration (none/30d/90d/lifetime) | ✓ | Ticketed support threads |
| Link health checks + grace period + admin-confirmed strikes | ✓ | Seller self-service link re-check before grace period ends |
| YouTube video health re-check (separate, non-strike) | ✓ | — |
| Phone verification (gates Stripe Connect payouts, not DMs) | ✓ | — |
| Admin: report queue, link-health queue, banned keywords, branding, categories, fee tiers, email templates, setup-status checklist | ✓ minimal, runtime-configurable | Full analytics-driven admin dashboard |
| Mature content age-gating (`is_mature`, blur-by-default) | ✓ | Permanent per-account mature-content preference (vs session toggle) |
| AI-generated content ban (direct-to-ban enforcement) | ✓ | — |
| Push notifications (order/fulfillment/strike/link-issue) | ✓ | Deal alerts, price-drop alerts |
| Web app (primary launch target) | ✓ | i18n, additional locales |
| iOS + Android app (build-ready) | ✓ tech | Store submission (deferred, see `01-PRD.md` §14) |
| Escrow beyond what Stripe Connect provides | | ✗ never planned |
| Auctions/bidding | | ✗ never planned |
| Multi-currency | | ✓ (USD-only for MVP) |
| Platform-run seasonal asset bundles/sales events | | ✓ |
| Sponsored/featured category placements (beyond per-listing Featured) | | ✓ |
| AI recommendations | | ✓ |
| Seller analytics beyond the MVP Pro Seller dashboard | | ✓ |

---

## 2. MVP definition of done

Reproduce from `01-PRD.md` §16 — all checkboxes green.

---

## 3. Retired — not applicable to this domain (do not implement, ever)

These are **not** deferred-to-future features; they belonged to the original hyperlocal physical-goods prototype and do not fit a global digital-asset marketplace. Do not resurrect them under a "Future" label — if a request comes in for one of these, point back to this section and to `01-PRD.md` §11 (Non-goals).

| Retired feature | Why it doesn't apply | Superseded by |
|---|---|---|
| ZIP + radius geo-discovery feed | This is a global catalog — no local/geo discovery of any kind (`01-PRD.md` §2, §10) | Category/license/price/asset-type/software/format filters, `09-Search_and_Radius_System.md` (retired stub) |
| "Use current location" / GPS tracking | Same as above | — |
| Meetup safety copy/flow (in-person exchange, phone-reveal, contact agreements) | Fully remote, digital-delivery marketplace — buyers and sellers never meet | Seller-hosted download link + strike system (`11-Storage_and_Deletion_System.md`) |
| College `.edu` student verification (badge, feed filter, OTP) | Not a relevant trust signal for a global creator marketplace | Stripe Connect KYC (seller trust) + purchase-verified reviews (buyer trust) |
| Waitlist / iOS waitlist signups | Was a pre-launch hyperlocal seeding mechanic | Direct Stripe Connect seller onboarding from launch |
| Founding Seller badge / seed program boost credits | Tied to city-by-city physical-marketplace seeding | Pro Seller subscription (a real, ongoing perk system, not a one-time launch promo) |
| $1/24h Boost + $5/mo Premium | Old low-stakes promotion-only monetization (no item-sale revenue) | Pro Seller subscription + pay-per-use Featured Listing (`10-Monetization_System.md`) |
| AdMob banner ads | Doesn't fit a real-payments goods marketplace alongside a sales commission | Platform commission (10%/8%) is now the primary revenue stream |
| Listing expire 14d / purge 21d (or 2mo Premium variant) | No fixed listing expiry in this domain — listings stay live until unpublished, sold (OTU), or auto-paused for a strike | Link-health strike system (`11-Storage_and_Deletion_System.md`) |
| Physical-goods prohibited-item categories (weapons, drugs, alcohol, etc.) | Not a relevant content category for digital assets | AI-generated-content ban, explicit-content ban, stolen-content ban (`12-Moderation_and_Safety.md`) |
| Shipping | Digital delivery only, no physical shipping ever | Seller-hosted download link |
| Cash/Venmo meetup payment ("outside app") | All payments run through Stripe Connect — no off-platform payment path | Stripe Connect destination charges |
| Multiple-cities marketing / city-by-city launch strategy | Not a hyperlocal rollout — global from day one | Concierge-seeded starting catalog across asset types (`01-PRD.md` §14) |

---

## 4. Scope creep examples (reject)

| Request | Response |
|---------|----------|
| "Add ZIP/radius filtering back for local pickup convenience" | Retired, not applicable (§3) — this is a global digital catalog, not a hyperlocal marketplace |
| "Let sellers list AI-generated models, just don't allow explicit content" | Non-goal; AI-generated content is banned outright regardless of explicit/non-explicit status |
| "Add a platform-hosted file mirror so buyers aren't stuck if the seller's link dies" | Violates the seller-hosted-only delivery model (`01-PRD.md` §5.2) — the strike system is the intended remedy, not platform file hosting |
| "Bring back the $1 boost for sellers who don't want a subscription" | Already covered — pay-per-use Featured Listing purchase serves this need without resurrecting the old Boost product |
| "Add PayPal/Venmo as an alternative to Stripe for item sales" | Non-goal; Stripe Connect is the only payment rail, by design (KYC, destination charges, tax handling) |

---

## 5. Version gates for future work

| Gate | Future feature unlock |
|------|------------------------|
| Steady order volume at launch commission rates | Volume-tiered commission evaluation |
| Meaningful Pro Seller adoption (≥5% of active sellers, per `01-PRD.md` success metrics) | Additional Pro Seller tier / perk expansion |
| Catalog breadth across all asset types | Sponsored category placements, seasonal bundle events |
| International buyer demand signal | Multi-currency support |

---

## 6. Document amendments

When promoting a feature from Future → MVP:

1. Update this file
2. Update `01-PRD.md`
3. Add an `08-Cursor_Prompts.md` section
4. Bump version headers

Retired (§3) items are never promoted this way — a retired feature would require a full domain-scope decision (i.e., a new PRD major version), not a routine Future → MVP promotion.

---

## 7. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.3 | 2026-05-24 | Phase 2 promotions (DMs, phone verify, grid feed) for the hyperlocal physical-goods prototype (superseded) |
| 2.0 | 2026-07-21 | Full rewrite for VtuberMarketplace: MVP list reflects digital VTuber assets, Stripe Connect, OTU/P2U licensing, Pro Seller, strikes, purchase-verified reviews; moved all physical-marketplace-only concepts (ZIP/radius, meetup safety, college verification, boost/premium, waitlist/founding-seller/seed-program) to a new "Retired, not applicable" section (§3) instead of leaving them as Future features |
