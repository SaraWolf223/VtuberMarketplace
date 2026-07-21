# Local Marketplace — Web QA Checklist (Desktop + Mobile Web)

**Purpose:** Verify the OfferUp-style desktop website and the app-like mobile website after the web rebuild. Both share the **same Supabase backend** as the native app. Automated checks cover signed-out flows, layout, routing, and backend health; the **signed-in** flows below need a real account (Google, or email/password — Apple Sign-In is iOS-app-only and isn't part of web QA).

Related: [28-Web_App.md](./28-Web_App.md), [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md).

---

## 0. One-time setup

- [ ] `.env` has `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (gitignored; already on dev machine)
- [ ] Supabase → Authentication → URL Configuration → **Redirect URLs** include:
  - `http://localhost:8081/callback` (local dev)
  - `https://yourdomain.com/app/callback` (production)
- [ ] Start dev server: `npm run web` → open `http://localhost:8081`

---

## 1. Automated QA (run these first — all should be green)

```bash
npm run web              # leave running in one terminal
npm run serve:website    # second terminal (landing on :3456) — only needed for web:qa

npm run web:test         # smoke + sign-in render
npm run web:qa           # 41 checks: Supabase REST + Auth health, landing, app boot, route guards, OAuth redirect
npm run web:qa:desktop   # 15 checks @ 1440px: OfferUp chrome, 5-col grid, sponsored cell, centered sign-in card
npm run web:qa:mobile    # 6 checks @ 390px: app-like search, 2-col grid, bottom tabs
node scripts/capture-web-qa-shots.mjs   # writes scripts/.web-after-*.png for visual review
```

All of the above should pass at **100%** before you consider the web build launch-ready — re-run after any change to routing, auth, or the feed grid.

> **Important after a Terms bump:** `scripts/test-web-signed-in.mjs` hardcodes `TERMS_VERSION` (must equal `CURRENT_TERMS_VERSION` in [src/constants/legal.ts](../src/constants/legal.ts)). If they drift, the harness seeds a stale acceptance and stalls on the accept-terms gate. Keep both in sync whenever you bump the Terms version.

> Note: `npm run web:test` can hit a one-off Windows libuv teardown crash (`UV_HANDLE_CLOSING`) on process exit. It is a Node/Playwright teardown quirk, not an app failure — re-run `node scripts/test-web-browser.mjs`.

### 1a. Automated **signed-in** QA (no Google needed)

`scripts/test-web-signed-in.mjs` creates/reuses a throwaway Supabase test user, mints a real session, injects it into headless Chromium's `localStorage`, and walks the signed-in routes against the live backend (screenshots → `scripts/.signed-in-shots/`).

It also exercises **interactive file-upload flows end-to-end** (not just route render):
- **Sell-page photo** — clicks "Add photos", sets a file via the OS file chooser, asserts the compressed preview renders, and that **Next** advances (web `getFileSize` fix).
- **Avatar change** — clicks "Change profile photo" on the profile panel/screen on **both** desktop and mobile web, sets a file, and verifies the `upload-profile-avatar` edge function stored a new avatar and the success dialog appeared (regression guard for the web FormData "file is required" bug — the React Native `{ uri, name, type }` shape doesn't upload on web, so a real `Blob` is appended via `src/lib/form-file.ts`).

```bash
# requires: SUPABASE_SERVICE_ROLE_KEY env var + a running `npm run web` on :8081
node scripts/test-web-signed-in.mjs --auth-only      # just verify session minting
node scripts/test-web-signed-in.mjs                  # full signed-in browser walk
node scripts/test-web-signed-in.mjs http://localhost:8082   # custom base URL
```

The service-role key is used **only** to mint the test user's session; the app itself never uses it. Rotate it anytime (Supabase → Settings → API). Test user defaults to `qa.bot@yourdomain.com` (override with `QA_TEST_EMAIL`/`QA_TEST_PASSWORD`).

---

## 2. Desktop web (>= 768px) — OfferUp parity

Open `http://localhost:8081` in a desktop-width browser and sign in.

### Top bar / chrome
- [ ] Logo (left) returns to the feed when clicked
- [ ] Location control shows `Near <ZIP> · <radius>`; opens location settings
- [ ] Prominent center search bar filters the feed as you type
- [ ] Blue **Post** button opens the create-listing screen
- [ ] Right icon nav: **Saved** (heart) → favorites, **Messages** (chat) → inbox, **Activity** (bell) → opens right slide panel, **Profile** → opens right slide panel
- [ ] Active icon shows the highlighted (tinted) state
- [ ] Category chip strip appears under the header on the feed; selected chip is a filled pill; chips filter the feed

### Feed
- [ ] Grid is responsive: 5 columns wide (>=1200px content), 4 (>=992px), 3 (>=768px)
- [ ] Listing card: square photo, bold price, title (1 line), distance/Sold/Expired
- [ ] Boost/premium border colors still render on highlighted listings
- [ ] Favorite heart overlay (top-right) toggles save state
- [ ] Pull/refresh and infinite scroll load more listings

> Also confirm feed error/empty states: 429 shows a clean "Too many requests · Try again", and a valid-but-empty ZIP shows the EmptyFeed state.

### Ads (OfferUp-style)
- [ ] **Top-of-feed leaderboard ad** ("Sponsored") appears above the grid
- [ ] **In-grid sponsored cells** (Google ad) appear every ~6 listings, sized like a listing cell

### Listing detail
- [ ] Two-column layout: large image gallery (left) + bounded info card (right) with price, title, seller, Save/Message
- [ ] Back row ("Back" + title) shows under the top nav
- [ ] Message seller / Save / Report / Block / review flows work — *UI present + reachable (automated capture); end-to-end send/report/block are destructive, exercise during device QA*

### Other desktop pages
- [ ] Settings shows the left sidebar + page title; all sub-pages reachable
- [ ] Messages inbox + thread render
- [ ] Saved (favorites) grid, Post-ad form render with desktop page titles
- [ ] Admin/manager hub (if staff account) renders

---

## 3. Mobile web (< 768px) — app parity

Resize the browser below 768px (or use device emulation / a phone browser) and sign in.

- [ ] No desktop top bar; **bottom tab bar** visible (Home, Post Ad, Favorites, Activity, Profile)
- [ ] Home header shows the location control
- [ ] App-like search row ("Search listings…") + Filters button; Filters opens a **bottom sheet**
- [ ] Feed is **2 columns**
- [ ] In-feed ads render as full-width rows between listing rows (not in-grid cells)
- [ ] Listing detail is single-column
- [ ] Navigation between tabs and into stack pages (settings/messages) works with a back header
- [ ] Create listing, favorite, message, profile flows all work

---

## 4. Shared backend verification

- [ ] Signing in on web creates a Supabase session (localStorage) and lands on the feed
- [ ] A listing created on web appears for the native app (same ZIP/radius) and vice versa
- [ ] Favorites, messages, and profile changes made on web reflect in the native app (same account)
- [ ] Sign out on web clears the session; protected routes redirect to sign-in

---

## 5. Known web limitations (by design)

- Stripe boosts/premium/banner **checkout** and AdMob are native-only; web shows placeholders.
- Phone SMS verification depends on Supabase Phone Auth being enabled.
- Programmatic (Google) in-grid/video ads are placeholders on web until an ad account is wired.

---

## 6. Device QA — native build (Google sign-in + push) — **you, on a phone**

These cannot be automated: Google sign-in needs a human at Google's screen, and push delivery needs a real device. Run after the EAS Android dev build (package `com.example.localmarketplace`) is installed and Firebase FCM + Android OAuth client + Supabase Google provider are configured.

### A. Install & launch
- [ ] Install the EAS **development** APK (allow "install unknown apps" if prompted)
- [ ] App opens to the sign-in screen (no splash hang / crash)

### B. Google sign-in (native, Path B)
- [ ] Tap **Continue with Google** → native Google account picker appears
- [ ] Pick a **test user** account → returns to the app **signed in** (no `DEVELOPER_ERROR` — that means the Android OAuth client SHA-1 / package is wrong)
- [ ] First-ever sign-in: profile shows your **Google name + photo**; ZIP setup prompt appears if no ZIP set
- [ ] Kill + reopen the app → still signed in (session persisted in SecureStore)

### C. Core flows on device
- [ ] Feed shows listings within your ZIP + radius
- [ ] Create a listing with a photo (camera + library), publish → appears in feed. Test the **price boundary**: any price `> 0` accepts, `0` or blank rejects (see §7)
- [ ] Favorite a listing; message a seller; edit profile — all succeed against the shared backend

### D. Push notifications
- [ ] Settings → Notifications → toggle **Push notifications ON** → OS permission prompt → **Allow**
- [ ] Toggle stays ON after restarting the app
- [ ] Token saved — verify in Supabase SQL editor:
  ```sql
  select user_id, push_token, notify_expiry
  from user_prefs
  where user_id = '<your-test-user-id>';
  -- push_token should be a non-null ExponentPushToken[...] value
  ```
- [ ] Trigger a notification (from a 2nd account or the web QA user): send the test user a **message**, or trigger a deal/review/listing-status event
- [ ] **Foreground:** in-app notification/alert shows
- [ ] **Background / app closed:** a system notification appears in the tray
- [ ] **Tap** the notification → opens the correct screen (message thread / listing / activity)
- [ ] Toggle **OFF** → `user_prefs.push_token` becomes null; no further pushes arrive

### E. Permission-denied path
- [ ] Deny the OS prompt → the toggle offers an **"Open settings"** action
- [ ] Enable notifications in OS settings → toggling ON now succeeds and saves a token

> If pushes never arrive but the token saved: check the EAS **FCM v1** credential is uploaded (`eas credentials` → Android → push) and the Firebase project matches package `com.example.localmarketplace`.

---

## 7. Feature QA — admin subscriptions, seed program, legal re-accept

> Covers price validation, admin premium/seed tooling, and legal re-acceptance. Run after `supabase db push` of migrations **096–098** and redeploy of `create-listing`, `finalize-listing-images`, `admin-action`. Roles: **user** (no staff role), **manager** (`role=manager`), **admin** (`role=admin`).

### 7.1 No fixed price cap (USER flow)

- [ ] **Accept any positive price:** live insert at any price `> 0` (e.g. `50.00`, `500.00`) accepted (DB CHECK)
- [ ] **Reject @ `0` or negative (client):** zod schema blocks before submit
- [ ] **Reject @ `0` or negative (edge/DB):** edge `listing-validate` returns a validation error; DB CHECK `listings_price_check` rejects non-positive prices
- [ ] **Edit existing listing:** change an existing listing's price to any positive value — same boundary applies via `update_listing`

### 7.2 Max-price filter (USER flow)

- [ ] **Feed filter (mobile/sheet):** `PRICE_OPTIONS` = **$5 / $10 / $20 / $35 / $50** + "Any" (`FeedFiltersSheet.tsx`)
- [ ] **Web sidebar filter:** same `PRICE_OPTIONS` incl. **$35 / $50** (`WebFeedSidebar.tsx`)
- [ ] Selecting a price filter / "Any" clears — wired via `p_max_price` to `get_feed_listings`
- [ ] Filter summary text reflects the chosen max price ("≤ $X")

### 7.3 Terms re-acceptance (USER flow)

- [ ] Re-accept gate wired: `CURRENT_TERMS_VERSION` in [src/constants/legal.ts](../src/constants/legal.ts); `hasAcceptedCurrentTerms` compares `profile.terms_version` (`src/lib/legal-acceptance.ts`)
- [ ] Legal content shows the correct "Last updated" + Effective date from [ENTITY.md](./legal/ENTITY.md) (`legal-content.generated.ts`; public `website/terms`/`privacy`/`community`/`safety`)
- [ ] Bumping `CURRENT_TERMS_VERSION` re-prompts existing users once, then not again on subsequent launches

### 7.4 Admin subscription controls (ADMIN flow — `app/admin/users.tsx`)

- [ ] **Grant Premium (fixed):** Admin → Users → pick a user → **Grant Premium** → choose a duration (e.g. 2 months) → success; user's `is_premium=true`, `premium_until ≈ now()+2mo`, `premium_source='comp'`
- [ ] **Grant Premium (open-ended):** grant with **no/blank duration** → `premium_until=NULL`, still premium-active
- [ ] **New listing window:** as that comped user, create a listing → it gets the **2-month** expiry window (not 21 days)
- [ ] **Stripe non-interference:** a Stripe boost/sync for that user does **not** wipe the comp (`premium_source` stays `comp`)
- [ ] **Revoke Premium:** Admin → Users → **Revoke Premium** → `is_premium=false`, `premium_until=null`
- [ ] **Audit log:** each grant/revoke writes a row to `moderation_actions`

### 7.5 Listing-expiry override (ADMIN flow)

- [ ] **Extend expiry:** from the seed/admin view, **Extend expiry** on a listing pushes `expires_at` and `purge_at` forward (default +60 days)
- [ ] **Reactivates expired:** running extend on an already-expired listing brings it back to active
- [ ] Action is logged to `moderation_actions`

### 7.6 Seed program (ADMIN flow — `app/admin/seed.tsx`)

- [ ] **Hub card:** Admin hub shows a **"Seed program"** card → opens the seed view
- [ ] **Overview:** founding sellers list with their listings, thumbnails, price, status, and a summary of **approved / paid / amount owed**
- [ ] **Approve:** approve a genuine listing → it counts toward payout; summary tally increments
- [ ] **Per-person cap:** approving an **11th** listing for one person is **blocked** (cap = 10)
- [ ] **Revoke approval:** revoke a not-yet-paid approval → removed from tally
- [ ] **Mark paid:** mark an approved listing paid → shows paid; cannot mark paid before approval
- [ ] All seed actions log to `moderation_actions`

### 7.7 Anti-farming (USER flow — new accounts)

- [ ] **New-account daily cap:** a brand-new account (< 7 days old, not premium, not founding) is capped at **3 listings/day**; the 4th is rejected
- [ ] **Exemption:** a **premium** or **founding-seller** account is exempt from the 3/day cap (still bound by the existing 10/hour quota)
- [ ] 1-photo minimum still enforced

### 7.8 Manager restrictions (MANAGER flow)

> A `manager` can moderate but must **not** access subscription/seed/expiry tools (admin-only).

- [ ] Sign in as a **manager**. Existing moderation tools still work (pause/unpause, warn, reports, keywords)
- [ ] **Grant Premium / Revoke Premium** are **not available / denied** for managers (UI hidden and the edge action rejects)
- [ ] **Extend listing expiry** is **denied** for managers
- [ ] **Seed approve / revoke / mark-paid** are **denied** for managers
- [ ] Attempting any of the above via a direct call returns a not-authorized error (managers blocked in `assertManagerActionAllowed`)

### 7.9 Cross-surface copy (positioning)

- [ ] **Landing page** (`website/index.html`): hero/stats/FAQ say "cheap local finds"; "college students and young adults — open to everyone", pickup-only
- [ ] **App Store / Play copy** (doc 18) does not reference a fixed price cap
- [ ] No stray hard-cap dollar amounts remain in user-facing copy

---

## 8. Landing-page conversion + waitlist referrals — `website/`

> Run with `npm run serve:website` (landing on :3456). Requires `website/scripts/waitlist-config.js` populated with the Supabase URL + anon key, and migration **106** + the `join-waitlist` edge fn redeployed for the referral/counter paths.

### 8.1 Above-the-fold capture + friction
- [ ] Hero shows an **email + ZIP + button** form (no scroll needed); submitting it joins the waitlist directly
- [ ] Hero success auto-scrolls to the `#waitlist` block showing the founding code
- [ ] Main `#waitlist` form: **role** and **platform** are now optional (labeled "(optional)"); submitting with only email + ZIP succeeds (role defaults to `both`)
- [ ] Invalid email / non-5-digit ZIP show inline errors and do not submit
- [ ] Honeypot (`website` field) still silently no-ops a bot submit

### 8.2 Social-proof counter (`get_waitlist_public_stats`)
- [ ] With total **≥ 250**: hero + form show "Join N+ early members…" (N floored to nearest 50)
- [ ] With **0 < total < 250**: shows qualitative "Founding sellers are already claiming their codes"
- [ ] With RPC unreachable / total 0: the counter stays **hidden** (never shows a weak/zero number)

### 8.3 Referral system (`?ref=`)
- [ ] On a fresh signup, the success block shows a **referral share** section with a `https://yourdomain.com/?ref=<code>` link, Copy link, Text a friend (`sms:`), Share on X, and native Share (mobile only)
- [ ] The share link uses the **public `referral_code`** (8-char slug), **not** the `FC-` founding code
- [ ] Visiting the site with `?ref=<code>` and signing up credits the **referrer's** `referral_count` (verify in `waitlist_signups`)
- [ ] A **returning** signup (same email) shows the message + their referral link/count but **no founding code** re-exposed
- [ ] Self-referral / unknown `ref` is ignored (no error, no bogus credit)

### 8.4 Sticky mobile CTA
- [ ] On < 900px width, a fixed bottom "Get your Founding Seller code" bar is visible
- [ ] The bar **hides** once the `#waitlist` form scrolls into view; reappears when scrolled away
- [ ] Hidden entirely on desktop (≥ 900px)

### 8.5 Backward-compat / non-regression
- [ ] Existing pre-106 waitlist rows still load in `app/admin/waitlist.tsx` (explicit column select unaffected)
- [ ] `register_waitlist_signup` called with only the legacy 5 args (no `p_ref`) still returns the same JSON keys the old client expected (plus the new optional ones)
- [ ] `join-waitlist` rate limits (10/hr IP, 3/day email), CORS, and origin checks unchanged
