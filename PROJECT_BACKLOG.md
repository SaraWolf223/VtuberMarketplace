# Project Backlog & Session Continuity

## Current status

**Last updated:** 2026-07-21

**Summary:** Workspace converted toward **VtuberMarketplace** — global digital VTuber asset marketplace (Live2D / 3D / VRChat / PNGtuber / accessories / backgrounds) with Stripe Connect, OTU/P2U licensing, seller-hosted delivery, Pro Seller tools, model-support subscriptions, seller socials/portfolio, profile bulletin, feed thumbnails, and discovery filters.

**Current phase:** Schema + docs + core feature surfaces landed; residual physical-goods cleanup and Pro Seller/Featured edge parity remain.

## Now / Next / Later

### Now

- [x] Rewrite `AGENTS.md` hard constraints for the VTuber marketplace domain
- [x] Core product docs + legal stack patches for VTuber domain and seller-social/support features
- [x] Database migrations `121`–`140` (digital listings, orders, Connect/Pro, support subs, portfolio, bulletin, sales, feed thumbnails/filters)
- [x] Edge: support plan/subscription/quote checkout + webhook; portfolio upload; Connect onboarding + order checkout (destination charges)
- [x] Frontend: profile socials/portfolio/bulletin; support subscribe/quote; Pro Seller promo/sale UI; feed thumbnail; price/date/rating filters; Buy CTA; seller payouts settings
- [x] Admin: bulletin moderation + support subscription/quote moderation
- [x] Feed de-geo: global catalog browse without ZIP gate
- [x] Messaging email-verification gate; purchase-verified reviews client alignment
- [ ] Finish residual conversion: Pro Seller / Featured checkout parity; remove leftover boost/premium/meetup UI; college/waitlist/seed cleanup
- [x] Typecheck pass (`npm run typecheck` clean)
- [x] Initial git commit + push (repo: https://github.com/SaraWolf223/VtuberMarketplace — `UjuComics/VtuberMarketplace` was not creatable with the active `gh` account)
- [ ] Human deploy of migrations `121`–`140` + new edge functions
- [ ] Transfer/rename remote to `UjuComics/VtuberMarketplace` when that org/account is available

### Later

- [ ] Human setup: Stripe Connect platform, YouTube Data API, Supabase project for `VtuberMarketplace`
- [ ] Full QA (typecheck, lint, security, web, device) after deploy
- [ ] Production legal review (attorney sign-off), payment, moderation, and store-release review

## Session log

### 2026-07-21 — Seller social / support / discovery + conversion resume

- Migrations `136`–`140`: listing support plans/subscriptions/quotes; seller portfolio/socials; bulletin board; listing sale periods + Pro promo gates; feed thumbnails + date/rating filters.
- Docs/legal patches for support subscriptions, quotes, portfolio, bulletin, sales, privacy.
- Edge: `upsert-listing-support-plan`, `create-support-subscription-checkout`, `create-support-quote-checkout`, `upload-portfolio-image`, Connect/order checkout helpers, webhook extensions.
- Frontend: shop profile, showcase upload, bulletin on public profile, support UI, quotes, Pro discounts, sell-flow feed thumbnail, global feed filters, Buy + payouts settings, admin bulletin/support queues.
- Resumed conversion: feed geo removal, email-gated DMs, purchase-verified reviews, Connect + order checkout edges, digital-delivery copy.

### 2026-07-21 — VTuber marketplace conversion (earlier)

- Rewrote `AGENTS.md` hard constraints: Stripe Connect (10%/8%), seller-hosted delivery, OTU/P2U, no ZIP/radius, no fixed expiry, purchase-verified reviews, email-gated DMs, AI-content ban, marketplace-facilitator liability, mature age-gating, VRChat-inclusive categories.
