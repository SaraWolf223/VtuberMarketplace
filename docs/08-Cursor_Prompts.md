# Local Marketplace — Cursor Prompts (Auto Mode)

**Version:** 1.2  
**Usage:** Copy ONE prompt block per session. Do not combine multiple phases in one run.

### Resume here (2026-05-24)

| Prompt | Status | Notes |
|--------|--------|-------|
| 00–11 | Done | Auth, feed, listings, Stripe boost/premium, fee pass-through |
| **12** | Done | Reports, blocks, auto-pause (migrations 029–030) |
| **13** | Done | Hard delete edges + purge; expiry SQL; push notifications deferred |
| **14** | Done | 2-col grid + AdMob interleave (`LISTINGS_PER_AD_SLOT=6`); native ads after `expo prebuild` + reinstall |
| **15** | Done | DMs: migration 032, inbox + thread, Message seller CTA, verify-phone stub |
| **16** | Done | Supabase SMS OTP, `complete_phone_verification`, gates (DM, publish, boost, premium) |
| **17** | Done | Categories, radius 0.5–50 mi, 2MB image enforce |
| **18** | Done | Public profile 2-col listings grid (sold overlay) |
| **20** | Up next | Admin panel v1 |

**Android dev (Windows):** `npm run android:doctor` → fix long paths → `npm run android:build` (external window). See [00-Developer_Setup.md](./00-Developer_Setup.md) §11b.

**Before every prompt:** Ensure `docs/02-Cursor_Rules.md` is active in `.cursor/rules/`.

---

## How to prompt Auto Mode

1. Open the referenced docs in `@docs` mentions.
2. Paste a single prompt below.
3. Let Auto finish; review diff.
4. Run `npx tsc --noEmit` (or `npm run typecheck`).
5. Commit with conventional message.
6. Move to next prompt only when acceptance criteria pass.

---

## 00 — Project setup

```
@docs/01-PRD.md @docs/02-Cursor_Rules.md @docs/06-Frontend_Structure.md

Scaffold Local Marketplace Expo app (TypeScript strict, Expo Router).

Requirements:
- Initialize Expo SDK 52+ with expo-router, expo-image, expo-image-manipulator
- Add: @supabase/supabase-js, @tanstack/react-query, zustand, zod, react-hook-form
- Create folder structure exactly per 06-Frontend_Structure.md
- Add src/theme/tokens.ts from 07-UI_UX_Design_System.md
- Add src/lib/supabase.ts reading EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
- Add src/lib/query-client.ts and wrap app/_layout.tsx with QueryClientProvider
- Add placeholder tabs: Home, Sell, Favorites, Profile
- Add .env.example with required keys
- Add package.json scripts: start, typecheck, lint

Do NOT implement auth, listings, or backend yet.
Acceptance: app boots to tab shell with no TypeScript errors.
```

---

## 01 — Supabase init

```
@docs/03-Database_Schemas.md @docs/05-Backend_Architecture.md

Initialize supabase/ folder for Local Marketplace.

Requirements:
- supabase init structure
- Create migrations 001-013 in order per 03-Database_Schemas.md (enums, tables, indexes, triggers, RLS, RPC get_feed_listings skeleton)
- Add supabase/functions/_shared helpers (errors, cors, supabaseAdmin)
- Seed banned_keywords with 20 sample terms
- Add README in supabase/ explaining supabase start and db reset

Do NOT build Expo features yet.
Acceptance: supabase db reset succeeds locally; PostGIS enabled; listings price CHECK requires price > 0 with no fixed maximum.
```

---

## 02 — Google auth + Google-backed profile

```
@docs/25-Google_Auth_and_Profile.md @docs/04-API_Endpoints.md @docs/06-Frontend_Structure.md @docs/03-Database_Schemas.md @docs/02-Cursor_Rules.md

Implement initial Google auth and profile sync for Local Marketplace. Current builds also include Apple and email/password auth; this prompt documents the original Google path.

Auth UI:
- app/(auth)/sign-in.tsx — add the "Continue with Google" button for the Google path; current product also includes Apple and email/password per PRD
- Subtext: provider name/photo are used for seller profile when available
- app/(auth)/onboarding.tsx (3 slides) before or after first sign-in per PRD

Google OAuth:
- supabase.auth.signInWithOAuth({ provider: 'google' }) with Expo redirect
- expo-auth-session / WebBrowser per Expo docs

Profile from Google (required):
- src/features/auth/syncProfileFromGoogle.ts — map email, full_name→display_name, picture→avatar_url
- Call on SIGNED_IN and once on app launch if session exists
- Generate unique username on first insert (see doc 25)
- profiles columns: display_name, auth_provider, username_changed_at in migration
- profiles_public view for reads
- Optional Edge: sync-google-profile + on-auth-user-created

Profile UI:
- app/(tabs)/profile.tsx — show Google avatar + display_name + @username
- settings: email read-only labeled "Google account"
- Allow username edit only (not avatar/email)

Other:
- Auth guard in app/_layout.tsx
- useAuth hook; queryKeys.session
- First login without ZIP → location modal, then tabs
- signOut clears React Query cache

Do NOT: custom avatar upload or listings feed in this prompt.
Acceptance: sign-in creates/updates profile with Google photo+name; return visit keeps same user; public profile hides email.
Run tests from docs/17-Testing_and_QA.md § Auth.
```

---

## 02b — Native Google Sign-In (fallback)

```
@docs/25-Google_Auth_and_Profile.md @docs/00-Developer_Setup.md

Implement Path B native Google if browser OAuth fails on device.

Requirements:
- @react-native-google-signin/google-signin
- GoogleSignin.configure({ webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID })
- signIn → signInWithIdToken({ provider: 'google', token: idToken })
- Same syncProfileFromGoogle flow as prompt 02
- Android SHA-1 documented in README troubleshooting

Only implement if user reports OAuth redirect issues OR prompt 02 fails device QA.
```

---

## 03 — User prefs & geocoding

```
@docs/09-Search_and_Radius_System.md @docs/04-API_Endpoints.md

Implement location preferences.

Requirements:
- Edge function geocode-zip (Mapbox) per 05-Backend_Architecture.md
- app/settings/location.tsx UI: ZIP input, radius chips (see prompt 17 for 0.5/1/2 expansion)
- src/features/profile/prefs-service.ts PATCH user_prefs
- Zustand prefs-store persisted with AsyncStorage
- On save: geocode, update home_location, invalidate feed queries
- Header on feed shows "Near {ZIP}" tappable to settings

Acceptance: changing ZIP updates stored lat/lng; invalid ZIP shows error.
```

---

## 04 — Listing create (backend + client)

```
@docs/03-Database_Schemas.md @docs/04-API_Endpoints.md @docs/11-Storage_and_Deletion_System.md

Implement listing creation pipeline.

Backend:
- Edge create-listing (keyword filter, price > 0 with no fixed maximum, insert draft listing)
- Edge finalize-listing-images
- Storage signed upload URLs

Frontend:
- Sell wizard steps per 06-Frontend_Structure.md
- Image picker + compress (max 1200px, 2MB) per 02-Cursor_Rules.md
- zod listingSchema
- draft-listing-store

Acceptance: user publishes listing with 1-5 images; listing appears in DB as active after finalize.
```

---

## 05 — Feed & search RPC

```
@docs/09-Search_and_Radius_System.md @docs/03-Database_Schemas.md @docs/07-UI_UX_Design_System.md

Implement local feed.

Requirements:
- Complete RPC get_feed_listings with boost tier, blocks, geo filter, pagination, sorts
- src/features/feed/feed-service.ts
- useFeed infinite query
- ListingCard component per design system
- FeedFilters: category, radius, price buckets, sort, search debounced
- Empty state when no results
- Pull-to-refresh

Acceptance: only listings within radius show; boosted listings sort above; blocked users hidden.
```

---

## 06 — Listing detail & contact

```
@docs/06-Frontend_Structure.md @docs/01-PRD.md

Implement listing detail screen app/listing/[id].tsx.

Requirements:
- Image carousel, price, category, distance, seller row (with rating if prompt 09 done)
- Favorite toggle
- Contact: MVP SMS + tap-to-reveal phone — **replaced in prompt 15** by Message seller
- Report entry point
- Mark listing_interest for future review
- Sold/expired visual states

Acceptance: deep link localmarketplace://listing/{id} opens screen.
Note: After prompt 15, primary contact is DM not auto SMS.
```

---

## 07 — My listings & lifecycle UI

```
@docs/01-PRD.md @docs/11-Storage_and_Deletion_System.md

Implement my-listings screen.

Requirements:
- Tabs: Active, Sold, Expired
- Edit listing (same wizard prefill)
- Mark sold, delete (soft)
- Show expires_at countdown on active
- Edge/cron not required this task — UI only

Acceptance: seller can manage own listings; sold listings leave default feed.
```

---

## 08 — Favorites

```
@docs/04-API_Endpoints.md

Implement favorites feature.

Requirements:
- favorites table CRUD
- Heart toggle on card + detail
- app/(tabs)/favorites.tsx list
- Show sold/expired badge on favorites

Acceptance: favorite persists across sessions.
```

---

## 09 — Reviews & profile aggregate rating

```
@docs/03-Database_Schemas.md @docs/04-API_Endpoints.md @docs/26-New_Features_Spec.md §1

Implement reviews system.

Requirements:
- listing_interest gate
- Review modal: 1-5 stars + optional text
- Trigger updates seller profiles.rating_avg + rating_count
- Show reviews list on public profile (limit 20)
- Under display name on EVERY public profile: combined rating line
  e.g. "4.8 ★ (23 reviews)" or "No reviews yet" if count=0
- Seller row on listing cards may show mini rating when count>0

Acceptance: cannot review without interest; cannot review twice same listing;
aggregate rating visible under username on profile/[userId].
```

---

## 10 — Stripe boost

```
@docs/10-Monetization_System.md @docs/04-API_Endpoints.md

Implement $1 listing boost.

Requirements:
- Edge create-boost-checkout + apply-boost
- stripe-webhook handles payment_intent.succeeded
- Boost extends boosted_until 24h
- My listings Boost button + Stripe PaymentSheet
- Feed shows boosted badge

Acceptance: test mode payment boosts listing to top of local feed.
```

---

## 11 — Premium subscription

```
@docs/10-Monetization_System.md

Implement $5/month premium.

Requirements:
- Stripe subscription product
- premium_subscriptions table sync via webhook
- profiles.is_premium + premium_until
- premium_boost_credits: 5/month
- app/settings/premium.tsx upsell
- Premium badge on profile and cards
- Boost uses free credit before charging $1

Acceptance: subscribed user shows badge; credit counter decrements on boost.
```

---

## 12 — Reports, blocks, listing auto-pause

```
@docs/12-Moderation_and_Safety.md @docs/04-API_Endpoints.md @docs/26-New_Features_Spec.md §3

Implement user safety tools (expand beyond MVP stub).

Requirements:
- Report listing AND report user flows; reason enum per moderation doc
- Rate limits: 5 reports/user/hour; no duplicate same target in 24h
- blocks table: blocker never sees blocked user's listings; blocked cannot DM blocker (stub OK until prompt 15)
- Feed RPC + profile queries exclude blocked users
- Listing auto-pause automation:
  - 10 reports on same listing within rolling 24h → status paused_pending_review
  - OR 50 lifetime reports on same listing → same status
  - Paused listings hidden from feed/search; seller sees "Under review" in my-listings
- moderation_actions audit log for admin
- Edge admin-action (profiles.role=admin): unpause listing, delete listing, ban user
- SQL view or table listing_moderation_queue for admin (panel UI in prompt 20)
- app/settings/safety.tsx: how to report/block + community rules link

Acceptance: blocked seller hidden from feed; 10th report in 24h pauses listing;
admin edge can unpause or delete.
```

---

## 13 — Hard delete, expiration & purge

```
@docs/11-Storage_and_Deletion_System.md @docs/05-Backend_Architecture.md @docs/26-New_Features_Spec.md §10

Implement listing lifecycle + hard delete.

Requirements:
- User delete listing → Edge deletes storage objects + DB row (no soft-delete for user-facing removal)
- Admin/moderation delete → same hard delete
- SQL cron expires standard listings after 21 days and Premium listings after 2 months (status expired)
- Edge purge-expired-listings deletes storage + DB 7 days after expiry
- Edge send-expiry-notifications about 2 days before expiry
- Register Expo push token in user_prefs
- Sold listings: remain in DB with status sold (shown faded on profile per prompt 17)

Acceptance: delete removes images from bucket; purge job removes expired rows;
deleted listings never appear in feed or profile grid.
```

---

## 14 — OfferUp-style feed grid + AdMob interleaved

```
@docs/10-Monetization_System.md @docs/01-PRD.md @docs/26-New_Features_Spec.md §6–7.1

Research OfferUp + Facebook Marketplace feed UX (grid density, ad frequency — do not copy assets).

Requirements:
- Refactor home feed to 2-column grid (FlashList numColumns=2 or equivalent)
- ListingCard compact for grid cells
- AdMob: react-native-google-mobile-ads
- Interleave pattern: ~6 listing cells → full-width AdMob ad slot → ~6 listings → ad
  (compact height ~50–60dp; not full screen)
- EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID / iOS test IDs in dev
- No ads on auth, onboarding, location-setup, DM threads
- Document ad placement rationale in docs/26-New_Features_Spec.md §6

Acceptance: feed scrolls as 2-col grid; test ad appears between listing groups in dev.
```

---

## 15 — Direct messages (privacy-first contact)

```
@docs/26-New_Features_Spec.md §2 @docs/12-Moderation_and_Safety.md @docs/04-API_Endpoints.md

Replace SMS/call-as-primary contact with in-app DMs.

Requirements:
- Tables: conversations, conversation_participants, messages (RLS: participants only)
- Listing detail: primary CTA "Message seller" (not auto SMS/dial)
- Optional secondary: "Call" / "Text" only after explicit user tap in thread or sheet (phone reveal)
- Thread list screen + thread detail with send box
- Realtime via Supabase Realtime OR 3s polling MVP
- Gate: phone-verified users only can send (prompt 16); unverified see read-only prompt to verify
- Report user + block from thread header
- Rate limit messages per minute (anti-spam, prompt 18)

Acceptance: two verified users can DM about a listing; unverified cannot send;
blocked users cannot message each other.
```

---

## 16 — Phone verification gates

```
@docs/26-New_Features_Spec.md §8 @docs/25-Google_Auth_and_Profile.md

Mandatory phone verify for gated actions.

Requirements:
- Supabase phone OTP OR Twilio Verify (document choice in supabase/README)
- profiles.phone (E.164), profiles.phone_verified_at
- app/settings/verify-phone.tsx
- Gates (show modal → verify flow):
  - Before: publish listing, send DM, boost pay, premium subscribe
- Allowed without verify: browse feed, open listing detail, view profiles
- Hook usePhoneVerificationGate(action) for reuse

Acceptance: unverified user can browse but cannot publish or DM until OTP completes.
```

---

## 17 — Categories, radius & 2MB images

```
@docs/26-New_Features_Spec.md §4 @docs/09-Search_and_Radius_System.md @docs/03-Database_Schemas.md

Update taxonomy and geo filters.

Requirements:
- Migration: remove listing_category clothing; add womens_clothing, mens_clothing,
  college_school, books, bikes, decorations, food_beverage, carpool, hobby, delivery;
  map old clothing rows
- Radius enum: 0.5, 1, 2, 5, 10, 25, 50 miles — user_prefs + get_feed_listings + UI chips
- Sell wizard + filters use new categories
- Re-enforce max 2MB per image client + server (create-listing / finalize)

Acceptance: feed filters show new categories; 0.5mi radius works; >2MB image rejected with clear error.
```

---

## 18 — Public profile listings grid (OfferUp-style)

```
@docs/26-New_Features_Spec.md §5 @docs/07-UI_UX_Design_System.md

Enhance app/profile/[userId].tsx.

Requirements:
- Section "Listings by this seller" — 2-column grid
- Active: show expires countdown on card
- Sold: visible with sold badge + faded/desaturated overlay (excluded from main feed)
- Deleted: never query (hard delete per prompt 13)
- Tap → listing detail

Acceptance: profile shows active + sold grids; expired/sold styling distinct from active.
```

---

## 20 — Admin panel v1 (moderation, promos, settings)

```
@docs/26-New_Features_Spec.md §13 @docs/12-Moderation_and_Safety.md

Admin UI (profiles.role = admin).

Requirements:
- app/admin/_layout.tsx gated by role (non-admin → redirect)
- **Queues (tabs):** paused listings, open reports
- **Moderation actions** (admin-action edge): unpause listing, delete listing, ban user, dismiss reports
- **Promo codes:** create/list/deactivate codes:
  - free_boosts (grant N paid boosts or credit-equivalent)
  - free_premium_month (1 month Premium then auto-expire via premium_until, no Stripe sub)
- **Boost settings:** adjust default boost duration (hours) and displayed base price (platform_settings)
- Edge redeem-promo-code for users (settings or premium screen)
- Service role NEVER on client

Acceptance: admin unpause paused listing; create promo for 1 free month premium and redeem test user;
adjust boost duration setting.
```

---

## 21 — Anti-spam & abuse protection

```
@docs/26-New_Features_Spec.md §9 @docs/12-Moderation_and_Safety.md

Rate limits and abuse hardening.

Requirements:
- Edge middleware helper: checkRateLimit({ key, max, windowMs }) for IP + userId
- Apply to: create-listing, send-message, report, geocode-zip, auth-heavy endpoints
- Document limits in 12-Moderation_and_Safety.md
- Optional: Supabase CAPTCHA on repeated failed auth (document setup)
- DB: statement_timeout on RPCs; connection pool notes in 05-Backend_Architecture.md

Acceptance: burst of 20 create-listing calls from one user returns 429;
DM flood returns 429.
```

---

## 22 — Legal docs (OfferUp / Facebook Marketplace research)

```
@docs/26-New_Features_Spec.md §12 @docs/legal/TERMS_OF_SERVICE.md @docs/legal/PRIVACY_POLICY.md

Research and update legal documents (not legal advice — flag attorney review).

Requirements:
- Compare OfferUp + Facebook Marketplace ToS, privacy, commerce, community standards
- Update TERMS: prohibited items, UGC license, local meetup disclaimer,
  phone/SMS consent, report/block, no escrow
- Update PRIVACY: phone number, DMs, ads, analytics, data retention
- Add COMMUNITY_GUIDELINES.md or section if missing
- Footer links in app settings

Acceptance: legal folder has updated drafts with changelog dated 2026-05-24;
"Attorney review required before production" banner at top of each file.
```

---

## 23 — Polish & performance

```
@docs/07-UI_UX_Design_System.md @docs/17-Testing_and_QA.md

Polish UX and performance (after prompts 12–22).

Requirements:
- Skeleton loaders on feed grid + profile listings grid
- Error retry states
- Haptic on favorite
- analytics events per 19-Analytics_and_Growth.md (stub provider OK)
- Image prefetch for grid scroll

Do NOT add new features.
Acceptance: feed grid scroll smooth; no layout shift on image load.
```

---

## 24 — College student badge (edu email verification)

```
@docs/26-New_Features_Spec.md §8 @docs/38-phone_verification.sql (pattern) @src/components/feed/FeedFiltersSheet.tsx

College student badge via .edu email OTP; annual re-verification; feed filter.

Requirements:
- Migration: profiles.college_edu_email, college_badge_verified_at, college_badge_expires_at (+1 year on verify);
  user_prefs.feed_college_students_only; college_email_verification_codes table (hashed OTP, TTL)
- Edge: send-college-email-code, verify-college-email-code (rate limits; .edu domain validation)
- app/settings/verify-college-email.tsx — enter edu email, OTP, show expiry + renew CTA
- Badge UI on public profile + listing detail seller row (and optional grid chip)
- FeedFiltersSheet: toggle "College students only" → persist prefs → pass to get_feed_listings
- Update get_feed_listings RPC: when filter on, seller must have college_badge_expires_at > now()
- Hide badge automatically when expired; settings prompts re-verify

Acceptance: verify test .edu flow extends expiry 1 year; feed filter shows only badged sellers' listings;
expired badge user excluded until re-verified.
```

---

## 26 — EAS build prep

```
@docs/16-Deployment_and_DevOps.md @docs/18-App_Store_Release_Checklist.md

Prepare EAS builds.

Requirements:
- eas.json profiles development, preview, production
- app.config.ts icons, splash, bundle identifiers
- Privacy manifest placeholders
- Document build commands in README

Acceptance: eas build --profile preview config validates (no need to complete cloud build if credentials missing — document blockers).
```

---

## Bugfix prompt template

```
@docs/02-Cursor_Rules.md

Bug: [describe actual vs expected]
Files likely involved: [paths]
Constraint: minimal diff only; do not refactor unrelated code.
Steps: reproduce → fix → verify with typecheck.
```

---

## Scope creep rejection template

```
@docs/15-MVP_vs_Future_Features.md

User asked for: [feature]
This is NOT in MVP. Reply with:
1. Why deferred
2. Which future doc section tracks it
3. Smallest MVP alternative if any
Do NOT implement the feature.
```
