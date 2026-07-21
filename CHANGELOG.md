# Changelog

All notable changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Dedicated branding guide covering app identity, deep links, native assets, runtime settings, landing-page and legal branding, provider setup, rebuilds, and final QA.

- `PROJECT_BACKLOG.md` — session log, backlog, build checklist template
- Google auth Path A/B, iOS payment matrix, moderation SLA, supply-first metrics
- `docs/27-Platform_Maintenance_Runbook.md` §3.4 — opt-in recipe to re-add the Supabase free-tier keep-alive automation
- Full live QA pass against a disposable temp Supabase project: 73 backend checks (auth/onboarding, listings/feed, messaging/reviews/blocking, reporting/moderation, admin config, promo codes/non-Stripe boost credits) and 32 browser-level checks (every admin screen for admin + manager roles, AAL2 gating, buyer feed on desktop/mobile viewports) — all passing after the fixes below
- Role-based-access QA pass against the same temp project: 124 checks covering every admin panel read/write with revert (categories, branding, platform settings, promo codes, email templates, get-setup-status), a real end-to-end moderation flow (report → warn/pause/unpause/delete/dismiss), manager-role moderation actions confirmed allowed while every admin-only action/route/table-write is confirmed blocked (server RLS + edge-function 403s + client route-guard redirects), buyer- and anonymous-role denial of every staff surface, and a browser pass rendering the admin hub, manager "Moderation panel" hub, and buyer's no-admin-content view — all passing after the fix below

### Changed

- Project setup accepts `APP_SCHEME`; Expo deep links use that value and native permission prompts automatically use `APP_DISPLAY_NAME`.

- PRD v1.1: retention, contact rate, quality guardrails
- Database: draft status, webhook_events, listing_create_log
- App Store checklist: Guideline 1.2 + 3.1 mapping
- Documentation reconciled with the shipped DM/messaging feature (previously documented as "not built")
- Upgraded the app from Expo SDK 54 to SDK 57, including React Native 0.86, React 19.2, TypeScript 6, aligned Expo module/plugin versions, and the SDK 57 web export path.
- Added a sanitized web export command (`npm run web:build:sanitized`) that prevents local environment values from entering generated public artifacts.

### Fixed

- SDK 57 compatibility fixes: removed direct React Navigation usage from app code, updated notification permission handling, imported optional native modules through Expo, added local stack option typing for web layout helpers, switched deprecated `StyleSheet.absoluteFillObject` usages, and added Node types for dynamic Expo config.
- Security tests assert the sanitized export path keeps local Supabase/EAS settings out of generated public web bundles.
- **QA tooling:** `scripts/test-web-signed-in.mjs` seeded terms-acceptance before the location RPC that lazily creates the profile row (silently no-op'd, leaving every gated route behind the Terms modal) and never stepped its admin checks up to AAL2 (so they always got rejected post-hardening). Reordered the seed calls and added an idempotent TOTP enroll/verify step (reusing the same throwaway test user across runs by clearing old MFA factors via the admin API first)
- **Critical (live-testing pass, all staff/admin actions):** every admin/manager server-side action (`admin-action`, `admin-bulk-email`, `admin-manage`, `get-setup-status`, `upload-branding-logo`) rejected fully-verified AAL2 staff sessions with `MFA_REQUIRED`, because `requireStaff` called `admin.auth.mfa.getAuthenticatorAssuranceLevel(jwt)` on a service-role client — that client has no session of its own, and `supabase-js@2.49.1` (pinned in edge functions) silently ignores the `jwt` argument, so it always resolved to `currentLevel: null`. The entire moderation/admin pipeline was non-functional despite passing client-side checks. Fixed by decoding the already-verified JWT's `aal` claim directly instead of relying on the SDK method; caught only by live end-to-end testing (58/58 backend checks failed on this before the fix, then passed after)
- **Feed block filter was one-directional:** `get_feed_listings` only hid listings from sellers *the viewer* had blocked, not from sellers who had blocked *the viewer* — inconsistent with the DM system's bidirectional `users_are_blocked()`. Fixed in `get_feed_listings` to match
- **Review-eligibility race condition:** marking a listing sold calls `mark_listing_sold_and_end_chat`, which hard-deletes the conversation (by design) — but that cascade-deleted the contact agreement/messages `listing_review_eligible` depends on, so if the seller marked sold before the buyer's review landed, the review became permanently unobtainable. Added a `deal_review_unlocks` snapshot table written right before the delete, and updated `listing_review_eligible` to honor it
- **Critical (runtime, all platforms):** the desktop web feed sidebar (and any other consumer of `useRadiusOptions`) hit an infinite render loop (`Maximum update depth exceeded`, `The result of getSnapshot should be cached`) — the zustand selector derived a brand-new array every call instead of a stable reference, which `useSyncExternalStore` (zustand v5) detects as "changed" on every render. Wrapped the selector in `useShallow` so it only re-renders when the derived options actually change; confirmed via a live browser test (the desktop feed previously hung for minutes and never rendered)
- **Critical (account deletion / audit trail):** self-service "Delete my account" (and deleting a staff account) could fail outright with a foreign-key violation for any user who was ever the target of a moderation action (warned/banned, even if later reversed), any staff member who ever warned/banned/reviewed a report/approved a seed payout/sent a bulk email, because `moderation_actions.admin_id`/`target_user_id`, `reports.reviewed_by`, `seed_payouts.approved_by`/`paid_by`, and `email_campaigns.admin_id` had no `ON DELETE` action (Postgres default: block the delete). Same bug class already fixed once for listing deletion (migration 104) but missed for user deletion. Added migration `119_fix_account_delete_fk_blockers.sql` (`ON DELETE SET NULL` everywhere, matching the existing pattern — audit rows survive, attribution just goes blank) and verified end-to-end against `delete-account`
- **Critical (fresh-project deploy):** `assets/adaptive-icon.png`, `assets/splash-icon.png`, `assets/logo-mark.png`, `assets/favicon.png`, and `assets/web-logo-lockup.png` were missing from the repo entirely — `app.config.ts` and `useBrandLogo.ts` require them, so the web and native builds crashed immediately (`Metro error: Unable to resolve module`) on a clean clone. Regenerated from the existing placeholder mark via `npm run gen-assets:from-logo`; found by actually running `npm run web` against a fresh test Supabase project rather than static analysis alone
- **Critical (fresh-project deploy):** migration `110_listings_category_to_text.sql` dropped the `listing_category` enum *before* dropping/recreating the three functions (`insert_draft_listing`, `update_listing`, `get_feed_listings`) still bound to it, so `supabase db push` against a brand-new database failed outright with `cannot drop type ... because other objects depend on it`. Reordered the migration to drop the dependent function signatures first
- **Critical (runtime):** `src/features/listings/category-labels.ts` and `src/stores/categories-store.ts` had a circular import where the store read `CATEGORY_LABELS` at module-init time — depending on load order this threw `Cannot access 'CATEGORY_LABELS' before initialization` and blanked the entire app. Extracted the raw label map into a new dependency-free `category-static-labels.ts` so neither module needs the other at init time
- **Dev tooling (`npm run seed:listings`):** the demo-data seeder used hardcoded enum-style categories (broken since the category-to-table migration), created listings with zero photos, and had a latent bug where signing in as each seed seller mutated the *shared* service-role client's session — silently downgrading every subsequent "admin" storage/DB write to that seller's own JWT and tripping RLS. Rewrote it to pull categories live from `listing_categories`, attach real category-matched photos (fetched from the internet and uploaded through actual storage + `listing_images` rows, not just a bumped `image_count`), use realistic per-category item names/prices/descriptions, and isolate each seller's sign-in to its own throwaway client. Verified end-to-end: 60 listings across all 19 categories, with photos, rendering correctly in the live feed
- **Web (profile photo):** changing your avatar on the web app silently center-cropped the picked image with no way to reposition or zoom — `pickImageWithNativeCrop` only routed Android through the in-app crop UI (`ImageCropModal`); web fell through to the same programmatic center-crop used as iOS's last-resort fallback. Routed web through the same in-app crop modal as Android (it's a plain React Native component — gesture-handler, reanimated, and `expo-image-manipulator`'s crop action all support web already); verified end-to-end in a browser (pick → drag/zoom UI renders → Done → uploads and updates `profiles.avatar_url`)
- **Inefficiency (Mapbox quota, all platforms):** `create-listing` always called the Mapbox geocoding API for the seller's ZIP, even when that exact ZIP had already been geocoded (e.g. during their own location setup, or by any prior listing). Only `geocode-zip` checked the `zip_centroids` cache first. Extracted the cache-then-geocode logic into a shared `resolveZipCentroid` helper and wired it into both edge functions, so each ZIP only ever needs to hit Mapbox once app-wide; found while testing "Post a listing" on a temp project without a Mapbox key configured
- **Critical (fresh clone, Android):** `expo prebuild`/`npm run android:build` hard-crashed with an `ENOENT` on `google-services.json` for anyone who hadn't set up Firebase yet — `app.config.ts` unconditionally set `android.googleServicesFile`, even though that file is only needed for Android push delivery (docs/00-Developer_Setup.md §8b) and every other feature works fine without it. `googleServicesFile` is now only included in the config when the file actually exists, so a buyer/tester can build and run the app before configuring FCM
- **Dev tooling (`npm run android:build`):** the build script reported "Gradle FAILED" and aborted even after Gradle printed `BUILD SUCCESSFUL` and produced a real APK — `Start-Process -PassThru` combined with `-RedirectStandardOutput`/`-RedirectStandardError` returns an unreliable (empty) `ExitCode` on Windows PowerShell 5.1, and `$null -ne 0` evaluates true. Switched to invoking `gradlew.bat` directly and reading PowerShell's native `$LASTEXITCODE`, which is reliable; verified end-to-end with a full Android build + emulator install + sign-up/onboarding/feed/listing/settings smoke test
- **Security:** restricted raw `profiles` table reads to admins only (managers previously bypassed PII-redaction RPCs via direct REST); `waitlist_signups` admin read now enforces the same AAL2 step-up as other admin policies; `list_college_students` now redacts phone numbers for managers consistently with email
- **Critical (runtime, all platforms):** `get_listing_review_status` was declared `STABLE` (since the DM-message-gate migration) but its body conditionally `INSERT`s a `listing_interest` row the first time a buyer becomes review-eligible without ever having triggered that row another way (e.g. a DM thread opened from somewhere other than the listing detail page) — Postgres enforces volatility at execution time, so the RPC crashed outright with `INSERT is not allowed in a non-volatile function` in exactly that scenario, which would otherwise surface as the review button silently failing to appear. Found via a live role-flow QA pass (buyer hit this after exchanging 5 messages each way without a prior listing view) and fixed by redeclaring the function `VOLATILE` (migration `120_fix_review_status_volatility.sql`), since it legitimately writes
- **Security:** DM message bodies are now checked against the banned-keyword filter server-side
- Admin: added a client-side manager-vs-admin route guard, tightened the AAL2 layout gate to check actual session level, and wired moderation-action user notifications into all warn/ban/delete entry points
- App: fixed a push-token registration bug that could report success without actually storing the token; fixed a username-uniqueness check that always "passed" due to RLS; clamped feed/radius selection to the admin-configured maximum; corrected misleading error messages for listing edit/mark-sold failures
- Website: fixed the returning-user referral-share panel not appearing, added a stale-token reset on failed Turnstile submissions, and made the referral link's origin configurable instead of hardcoded

### Removed

- Supabase free-tier keep-alive GitHub Action, npm script, and helper script from the default buyer path (opt-in recipe retained in the maintenance runbook)
- Dead one-off migration/debug scripts and a script that hardcoded a personal GitHub remote

## [1.1.0-docs] — 2026-05-22

### Added

- Complete MVP documentation stack (PRD through seed strategy)
- Cursor Auto Mode prompts (`00`–`16`)
- Legal draft templates (Terms, Privacy, Guidelines, Meetup Safety)
- Developer setup guide, Edge Functions spec, user flows, brand copy
- `AGENTS.md`, `CONTRIBUTING.md`, `supabase/README.md`

## [1.0.0-docs] — 2026-05-21

### Added

- Initial documentation published to GitHub
- Cursor rules (`.cursor/rules/localmarketplace.mdc`)
- Local Marketplace foundation PRD and architecture specs
