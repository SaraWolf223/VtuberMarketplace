# Project Backlog & Session Continuity

## Current status

**Last updated:** 2026-07-21

**Summary:** VTuber Marketplace conversion plan implemented: global digital VTuber asset marketplace with Stripe Connect, OTU/P2U licensing, seller-hosted delivery, Pro Seller + Featured, support subscriptions, seller socials/bulletin, strikes, and admin fee/strike tools.

**Current phase:** Code conversion complete for plan todos; human deploy of migrations/edge functions + store launch remain.

## Now / Next / Later

### Now

- [x] Rewrite `AGENTS.md` + backlog for VTuber domain
- [x] Remove resale/white-label-for-sale collateral; re-label Store settings
- [x] Core product docs + legal stack (marketplace facilitator)
- [x] Database migrations `121`–`140`
- [x] Edge: Connect, order checkout, Pro Seller/Featured, YouTube validate, link health, support/portfolio, webhook
- [x] Frontend: listings (asset/license/YouTube/download), feed filters, orders library, membership, messaging, reviews, strikes
- [x] Admin: fee tiers, strike queue, AI-content ban action
- [x] Cleanup physical gates (location/ZIP hard requirement)
- [x] Typecheck clean; lint 0 errors (warnings only)
- [x] Git push (active remote: https://github.com/SaraWolf223/VtuberMarketplace)
- [ ] Human deploy migrations + edge functions; set `STRIPE_PRICE_PRO_SELLER`, `YOUTUBE_DATA_API_KEY`
- [ ] Transfer remote to `UjuComics/VtuberMarketplace` when org access is available

### Later

- [ ] Full device/web QA after deploy
- [ ] Attorney review of legal stack
- [ ] Delete unused legacy routes (waitlist/seed/college) after confirmation
- [ ] Regenerate static legal HTML after filling `docs/legal/ENTITY.md` placeholders

## Session log

### 2026-07-21 — Conversion plan completion

- Finished remaining conversion todos: Pro Seller/Featured edge functions, `validate-youtube-video`, `check-listing-links`, VTuber `create-listing`, sell flow (asset/license/YouTube/download), orders library, feed license/add-on filters, geocode 410 stub, admin/membership/strikes from parallel workstreams.
- QA: `npm run typecheck` pass; lint warnings only.
- Pushed to SaraWolf223/VtuberMarketplace (gh auth cannot create under UjuComics).

### 2026-07-21 — Seller social / support / discovery

- Migrations `136`–`140`, support/portfolio/bulletin/sales UI, Connect/order checkout foundations.
