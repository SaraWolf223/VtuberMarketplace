# VTuber Marketplace — Agent Instructions

This repository is built with **Cursor AI Auto Mode**. Agents must follow the documentation stack — not improvise architecture.

## Start here

0. [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md) — **update at end of session** (status, session log, next tasks)
1. [docs/INDEX.md](./docs/INDEX.md) — master map
2. [docs/01-PRD.md](./docs/01-PRD.md) — product truth
3. [docs/02-Cursor_Rules.md](./docs/02-Cursor_Rules.md) — coding rules
4. [docs/08-Cursor_Prompts.md](./docs/08-Cursor_Prompts.md) — **one prompt per task**

**Store maintenance & security cadence:** [docs/27-Platform_Maintenance_Runbook.md](./docs/27-Platform_Maintenance_Runbook.md) — use for dependency audits, Play/App Store updates, vulnerability research, and periodic hardening (not feature prompts).

## Hard constraints (never violate)

- **Domain:** a global marketplace for pre-made **digital VTuber assets** — 2D Live2D models, 3D VRM/FBX models (incl. VRChat avatars/props), PNGtuber models, accessories, backgrounds/overlays, base models. No local/geo discovery, no freelance "commission" listings.
- No fixed listing price cap — price must be greater than $0.
- **Real payments via Stripe Connect Express.** Every order is a destination charge with a platform commission: **10%** for free-tier sellers, **8%** for Pro Seller subscribers (both admin-configurable). Buyer covers Stripe's processing fee and tax. Sellers must have `charges_enabled` + `payouts_enabled` + verified phone before publishing. See [10-Monetization_System.md](./docs/10-Monetization_System.md).
- **Digital delivery only — seller-hosted links, no platform file storage.** The platform never stores/proxies asset files; `listings.download_url` and `order_deliverables.deliverable_url` point at the seller's own hosting. See [11-Storage_and_Deletion_System.md](./docs/11-Storage_and_Deletion_System.md).
- **Licensing is mandatory and seller-authored:** every listing is either **OTU** (One-Time-Use — full rights/copyright transfer, delists after sale) or **P2U** (Pay-to-Use — non-exclusive usage license, stays listed). Sellers write their own license text; it is snapshotted into `orders.license_snapshot` at checkout. Never invent a platform-mandated license template.
- **No fixed listing expiry.** A listing stays live until the seller unpublishes it, it sells (OTU), or it is auto-paused by the strike/link-health system. `21-day`/`2-month` expiry logic is retired.
- **No ZIP/radius geo discovery.** This is a global catalog; the feed is filtered by category, license type, price, customization/setup add-ons, support duration, asset type, compatible software (incl. VRChat), file format, and mature-content toggle. `09-Search_and_Radius_System.md` is retired.
- **Every listing requires ≥3 photos and exactly one validated YouTube demo video** (oEmbed + Data API v3 `embeddable`/`madeForKids` checks) before it can publish. No category exemptions.
- **Mature content is age-gated, not banned** (suggestive/non-explicit, blurred by default); **explicit sexual content stays banned**; **AI-generated content is banned outright** — a confirmed violation escalates straight to an account ban, skipping the normal warn-first ladder.
- **Reviews are purchase-verified only** — a buyer may review a listing only if they hold a completed (`fulfilled`) order for it.
- **DMs require email verification, not phone verification.** Phone verification is only required for sellers to unlock Stripe Connect payouts, not for messaging.
- **No platform liability for buyer/seller disputes.** This is a marketplace-facilitator model, not a merchant/retailer — see the legal stack for the liability cap, indemnification, and mandatory-arbitration language. Never add code or copy implying the platform guarantees, insures, or is responsible for a transaction's outcome.
- Sign-in supports **Google, Apple (iOS), and email/password**; profile photo + name are populated from the provider when available (Google/Apple) or collected on sign-up (email).
- **Two-factor authentication (TOTP) is mandatory for `admin`/`manager` roles** (optional for everyone else) — enforced client- and server-side, see [25-Google_Auth_and_Profile.md](./docs/25-Google_Auth_and_Profile.md) §MFA and `supabase/functions/_shared/require-admin.ts`.
- This is a **runtime-configurable, single-tenant** codebase: branding (logo/colors), listing categories (incl. VRChat), fee-tier percentages, moderation thresholds, and email templates are all **admin-configurable at runtime** via `public_app_config`/`listing_categories`/`email_templates` — never hardcode these; add a bundled fallback + admin screen instead of a new constant. See [03-Database_Schemas.md](./docs/03-Database_Schemas.md) §Platform config and `app/admin/{branding,categories,settings,email-templates}.tsx`.

## Build order

Follow prompt sequence `00` → `16` in [08-Cursor_Prompts.md](./docs/08-Cursor_Prompts.md).

## When touching systems

| System | Document |
|--------|----------|
| **Google auth + profile** | [25-Google_Auth_and_Profile.md](./docs/25-Google_Auth_and_Profile.md) |
| Database / RLS | [03-Database_Schemas.md](./docs/03-Database_Schemas.md) |
| API | [04-API_Endpoints.md](./docs/04-API_Endpoints.md) |
| Backend | [05-Backend_Architecture.md](./docs/05-Backend_Architecture.md), [21-Edge_Functions_Spec.md](./docs/21-Edge_Functions_Spec.md) |
| Frontend | [06-Frontend_Structure.md](./docs/06-Frontend_Structure.md), [07-UI_UX_Design_System.md](./docs/07-UI_UX_Design_System.md) |
| Money (Stripe Connect, commission, Pro Seller) | [10-Monetization_System.md](./docs/10-Monetization_System.md) |
| Digital delivery / links / strikes | [11-Storage_and_Deletion_System.md](./docs/11-Storage_and_Deletion_System.md) |
| Safety / moderation / AI-content / strikes | [12-Moderation_and_Safety.md](./docs/12-Moderation_and_Safety.md) |
| Scope | [15-MVP_vs_Future_Features.md](./docs/15-MVP_vs_Future_Features.md) |
| **Web app** | [28-Web_App.md](./docs/28-Web_App.md) |
| **Security (RLS, auth hardening, bot protection)** | [14-Security_Best_Practices.md](./docs/14-Security_Best_Practices.md) |
| **Legal (ToS, Seller/Buyer Agreements, DMCA, Privacy)** | [docs/legal/](./docs/legal/) |
| **Store maintenance & security** | [27-Platform_Maintenance_Runbook.md](./docs/27-Platform_Maintenance_Runbook.md) |

## Repo status

Documentation reflects the VTuber digital-asset marketplace domain. Application code is being converted from an earlier hyperlocal physical-goods prototype — see `PROJECT_BACKLOG.md` for current conversion progress.

## Human setup required

Run `npm run setup` for a guided prompt-through of every account/key below, or follow [docs/00-Developer_Setup.md](./docs/00-Developer_Setup.md) manually (Supabase, Google/Apple sign-in, Stripe Connect, YouTube Data API key, EAS, optional Cloudflare Turnstile). Check `app/admin/setup-status.tsx` (Admin → Setup status) any time to see what's still missing.
