# Local Marketplace — Developer Setup Guide

**Version:** 1.2  
**Audience:** You (solo founder) setting up services before Cursor builds the app.

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS (22+ often works) | https://nodejs.org |
| Expo Go on phone | **SDK 57** (must match project) | App Store / Play Store |
| Git | 2.40+ | https://git-scm.com |
| Expo CLI | via npx | `npm install -g eas-cli` (optional) |
| Supabase CLI | latest | `npm install -g supabase` |
| Cursor | latest | https://cursor.com |

---

## 2. Open the project

Clone this repository (or open your existing local copy) and open the folder in Cursor:

```bash
git clone <this-repo-url>
cd <project-folder>
```

`AGENTS.md` and `docs/02-Cursor_Rules.md` apply automatically for Cursor AI Auto Mode sessions.

---

## 2b. Phased setup (what you need when)

You do **not** need every service on day one. Use this while building locally with Cursor prompts `00`–`06`.

| Service | Set up now? | First needed |
|---------|-------------|--------------|
| **Supabase** (URL + anon key + PostGIS) | **Yes** | Prompt `01`–`02` and all data |
| **Google Cloud OAuth** + Supabase Google provider | **Yes** | Prompt `02` (sign-in) |
| **Mapbox** | Defer | Prompt `03` (ZIP → coordinates) |
| **Stripe** (test mode) | Defer | Prompts `09`–`10` (boost + premium) |
| **Google AdMob** | Defer | Prompt `14` — use Google **test** ad unit IDs from `.env.example` until then |
| **Expo / EAS** | Defer | Daily dev: `npx expo start` only. EAS before TestFlight/store (prompt `16`) |

**Optional:** `supabase start` (local Docker stack) — not required; cloud project is fine for MVP.

**Tracking:** Update the **Accounts & services** table in [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md) when each service is configured.

---

## 3. Supabase project

1. Create project at https://supabase.com (free tier OK for MVP).
2. **Authentication → Providers → Google:** enable, add OAuth client IDs from Google Cloud Console.
3. **Database → Extensions:** enable `postgis`.
4. Copy **Project URL** and **anon key** → `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   ```
5. Copy **service role key** → Supabase Edge secrets only (never in Expo app).
6. Local dev:
   ```bash
   supabase login
   supabase link --project-ref YOUR_REF
   supabase start          # optional local stack
   supabase db push        # after migrations exist
   ```

See [supabase/README.md](../supabase/README.md).

---

## 4. Google Cloud (OAuth)

> **Personal vs company account:** OK to use a **personal Google Cloud project** and personal Gmail while testing. Once your **business entity is formed**, create (or move to) a **company Google Workspace / GCP project**, recreate OAuth clients, update the Supabase Google provider + `.env`, and set the OAuth consent screen publisher to your company name before store submission.

1. https://console.cloud.google.com → APIs & Services → Credentials.
2. Create **OAuth 2.0 Client ID** (Web + Android + iOS as needed for Expo).
3. Authorized redirect URIs: add Supabase callback URL from Supabase Auth settings.
4. Paste Client ID/Secret into Supabase Google provider.
5. Ensure OAuth scopes include **email** and **profile** (default) so name + photo sync to `profiles`.

**Google Cloud (required):**

| Client | Purpose |
|--------|---------|
| Web | Supabase provider + `webClientId` for native sign-in |
| Android | SHA-1 debug + release keystores in Console |
| iOS | Bundle ID + URL scheme in `app.json` |

```bash
# Android debug SHA-1
keytool -keystore android/app/debug.keystore -list -v -alias androiddebugkey -storepass android
```

**Supabase Google provider:** add Web + Android client IDs (comma-separated). For native flow: enable **Skip nonce checks**.

See [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md) Path A vs B.

### 4.1 Supabase redirect URLs (Expo Go on phone)

**Do not use `localhost` as Site URL** — your phone cannot reach your PC at `localhost:3000`.

1. Run `npm start` and note the Metro line: `Metro waiting on exp://192.168.x.x:8081`.
2. Try Google sign-in once; the error alert (or Metro log) shows the exact **redirect URL** to add.
3. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** `exp://192.168.x.x:8081` (your LAN IP from Metro)
   - **Redirect URLs:** add the exact URL from the app, e.g. `exp://192.168.x.x:8081/--/(auth)/callback`, plus `localmarketplace://auth/callback`
4. Save, then sign in again.

Also add the equivalent `/reset-password` redirect URLs (used by the "forgot password" email link) — the in-app dev hint and `getSupabaseRedirectAllowList()` (`src/lib/auth/google-oauth.ts`) list every URL to add for both `/callback` and `/reset-password`.

### 4.2 Apple Sign In (iOS) + email/password

The app supports three sign-in methods: Google, Apple (iOS only — required by App Store Guideline 4.8 once the app offers other account-creation methods), and email/password. Email/password needs no extra provider setup beyond Supabase's built-in **Email** provider (on by default) — optionally enable **Confirm email** and the **leaked password protection** setting under Authentication → Providers → Email for stronger signups.

Apple Sign In setup:

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → your App ID → enable the **Sign In with Apple** capability.
2. Create a **Services ID** (Identifiers → **+** → Services IDs) for the Supabase redirect (only needed if you also want Apple sign-in on web/Android via OAuth — the native iOS flow used by this app does not require it).
3. Supabase → **Authentication** → **Providers** → **Apple**: enable it, and set the **Bundle ID** to match `ios.bundleIdentifier` in `app.config.ts`.
4. In EAS/Xcode, the **Sign In with Apple** capability + entitlement is added automatically by `ios.usesAppleSignIn: true` in `app.config.ts` — no manual Xcode step needed for managed/EAS builds; if using a bare/custom Xcode project, add the capability manually under **Signing & Capabilities**.
5. Rebuild the app (`eas build --platform ios` or a new dev client) — the Apple button only renders on iOS and only works in a build that includes the native module (not Expo Go).

### 4.3 Two-factor authentication (TOTP)

No extra setup needed — this uses Supabase Auth's built-in MFA, already enabled on every project. Any user can optionally enroll a TOTP authenticator (Settings → Security) by scanning a QR code. **Enrollment is mandatory for the `admin` and `manager` roles**: anyone promoted to those roles is redirected to the enrollment screen before they can reach any admin route, and server-side checks (`requireStaff` in Edge Functions, `is_app_admin()`/`is_app_staff()` in RLS) also require AAL2 — a stolen staff password/session alone cannot reach admin data or actions.

---

## 5. Mapbox (geocoding)

1. https://account.mapbox.com → create access token (public scopes: geocoding).
2. `.env`:
   ```
   EXPO_PUBLIC_MAPBOX_TOKEN=
   ```
3. Store same token in Supabase Edge secret `MAPBOX_ACCESS_TOKEN` for server geocode.

---

## 6. Stripe (boosts + premium only)

1. https://dashboard.stripe.com — start in **Test mode**.
2. Products:
   - **Listing Boost** — one-time $1.00
   - **Premium Seller** — recurring $5.00/month
3. Copy Price IDs into Edge env: `STRIPE_PRICE_BOOST`, `STRIPE_PRICE_PREMIUM`.
4. `.env`:
   ```
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
5. Edge secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
6. Webhooks (test): point to `https://YOUR_REF.supabase.co/functions/v1/stripe-webhook`.

See [10-Monetization_System.md](./10-Monetization_System.md).

### Admin bulk email (before production)

Admin → **Bulk email** uses Resend. **Required before production sends** (preview-only works without them in dev):

1. [Resend](https://resend.com) — verify your sending domain; create API key.
2. Supabase Edge secrets:
   - `RESEND_API_KEY`
   - `BULK_EMAIL_FROM` (e.g. `Local Marketplace <noreply@yourdomain.com>`)
3. Deploy: `npx supabase functions deploy admin-bulk-email`

Without `RESEND_API_KEY` in production, bulk sends will fail.

### Staff / admin notifications (waitlist signups, reports, bans)

The waitlist functions email the team on each **new** signup via the shared `notifyStaff()` helper (`supabase/functions/_shared/staff-notify.ts`), reusing the same Resend integration as bulk email. The **admin channel** goes to `SUPPORT_EMAIL`; the staff channel (reports/bans, added by `NS-1`) goes to admin/manager `profiles.email`. See [34-Store_Accounts_and_Launch_Readiness.md](./34-Store_Accounts_and_Launch_Readiness.md) §E–F.

- Supabase Edge secret: `SUPPORT_EMAIL` (defaults to `support@yourdomain.com` if unset).
- Deploy after changes: `npx supabase functions deploy join-waitlist join-ios-waitlist`
- In dev (no `RESEND_API_KEY`), sends are logged instead of delivered, so the signup still succeeds.

---

## 7. Google AdMob (optional for MVP end)

1. https://admob.google.com — create app placeholders.
2. Use **test ad unit IDs** in dev (see `.env.example`).
3. Add real IDs before store submission.

---

## 8. Expo / EAS

1. `npm install -g eas-cli`
2. `eas login`
3. After app scaffold: `eas build:configure`
4. Bundle IDs (example):
   - iOS: `com.example.localmarketplace`
   - Android: `com.example.localmarketplace`

See [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md).

---

## 8b. Push notifications (Expo + FCM)

The app registers a device push token when the user enables **Settings → Notifications → Push notifications**, stores it on `user_prefs.push_token`, and the backend sends an Expo push on every new in-app notification (DB trigger, see [21-Edge_Functions_Spec.md](./21-Edge_Functions_Spec.md) §10). Two things are required for delivery:

**1. EAS `projectId` (needed to mint push tokens)**

```bash
eas init            # creates the EAS project + projectId
```

Expose it to the app build so `getExpoPushTokenAsync` works:

```
EAS_PROJECT_ID=your-eas-project-id   # in .env / EAS build env
```

`app.config.ts` already maps `EAS_PROJECT_ID` → `extra.eas.projectId`. Without it, the toggle returns "Push is not configured yet".

**2. Android FCM credentials (needed for Android delivery)**

1. Create a Firebase project at https://console.firebase.google.com and add an Android app with package `com.example.localmarketplace`.
2. **Firebase → Project settings → Cloud Messaging:** enable the **Firebase Cloud Messaging API (V1)**.
3. Download the **service-account JSON** and upload it to Expo:
   ```bash
   eas credentials        # Android → Google Service Account → upload JSON
   ```
   (Expo uses it to deliver via FCM v1.)
4. iOS uses APNs, which EAS manages automatically when you build with a paid Apple account.

> A **native rebuild** is required after adding `expo-notifications` (`npm run android:build:device` for the phone APK, or an EAS build). Local notifications work in any dev build; **remote** delivery needs steps 1–2 above.

---

## 9. Environment file

The fastest path is the interactive setup wizard. It collects account/build values into the git-ignored local `.env` file and can prepare initial branding, radius, boost, and moderation defaults in `.buyer-setup.local.json`:

```bash
npm run setup
```

The collection phase makes no network requests. Native name, domain, bundle/package identifiers, EAS identity, and AdMob app IDs are read from `.env` by `app.config.ts`, so buyers do not need to edit configuration source code.

The wizard is deliberately **terminal-only**. It has no web route, opens no listening server, makes no network requests, refuses non-interactive/hosted execution, and writes only git-ignored local files. Never copy `.env` or `.buyer-setup.local.json` to web hosting. Never turn this wizard into an admin webpage.

After migrations have been applied, validate and apply the allowlisted non-secret runtime defaults from the same local machine:

```bash
npm run setup:apply:dry
npm run setup:apply
npm run setup:check
```

`setup:apply` uses the locally stored Supabase service-role key, sends only allowlisted non-secret rows to `public_app_config` and `platform_settings`, and never stores a secret in either table. Logo upload, categories, and email templates remain in the MFA-protected in-app Admin screens. Re-run the wizard safely whenever an account value or default changes.

Prefer to do it by hand:

```bash
cp .env.example .env
# Fill all EXPO_PUBLIC_* values
```

Either way, once the app is running, sign in and open **Admin → White-label → Setup status** (`/admin/setup-status`) for a live checklist of every account/key — client values and server-only Edge Function secrets — showing what's still missing or a placeholder, with a pointer to the relevant section of this doc for each.

### 9a. Bot protection (Cloudflare Turnstile, optional)

The website waitlist form and the web sign-up form support Cloudflare Turnstile (a free, privacy-friendly CAPTCHA) to block bots and spam signups. It's **optional** — without it, the website falls back to a honeypot field and the app's Edge Functions simply skip verification (no hard failure).

1. https://dash.cloudflare.com → **Turnstile** → **Add site** → widget mode "Managed".
2. Copy the **Site key** into `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (`.env`) and into `website/scripts/waitlist-config.js`'s `turnstileSiteKey` (copy from `waitlist-config.example.js`).
3. Copy the **Secret key** into the `TURNSTILE_SECRET_KEY` Edge Function secret (`supabase secrets set TURNSTILE_SECRET_KEY=...`), used by `join-waitlist`, `join-ios-waitlist`, and Supabase's own sign-up captcha check.
4. Also paste the secret key into Supabase Dashboard → **Authentication** → **Attack Protection** ("Bot and Abuse Protection") → **Enable CAPTCHA protection**, provider **Turnstile**, so it's enforced on the email/password sign-up endpoint itself, not just the app's own request.

---

## 9b. Branding: logo, colors, and the app icon/splash

For the complete buyer workflow—including app identity, deep links, landing-page copy, legal details, native regeneration, and final QA—follow [36-Reskinning_Guide.md](./36-Reskinning_Guide.md).

Most branding is **runtime-configurable** — promote your account to `admin` (see the admin panel's own instructions if it isn't yet), then use **Admin → White-label → Branding** to upload a logo, set the app display name/support email, and pick brand colors. Changes there apply instantly across the app and website — no rebuild.

The **app icon, splash screen, Android adaptive icon, and web favicon** are the one exception: they're compiled into the native binary/web build, so changing them always needs a rebuild (true of any app, not a limitation of this one). Regenerate all of them from a single master logo with:

```bash
npm run gen-assets:from-logo -- <path-to-logo.png> [--name "Your App"] [--bg "#0A0A0F"] [--text "#111827"]
```

This writes `assets/splash-icon.png`, `assets/adaptive-icon.png`, `assets/logo-mark.png`, `assets/logo-mark-trim.png`, `assets/favicon.png`, and `assets/web-logo-lockup.png` (already referenced by `app.config.ts` and the web header). Use a square-ish PNG with a transparent background for best results — the same file you'd upload in the Branding screen. After running it, rebuild (`eas build` or a new dev client) for the app icon/splash to actually change; the website favicon/wordmark update on the next `npm run web`/deploy without a native rebuild.

---

## 10. Build the app (Cursor)

1. Read [08-Cursor_Prompts.md](./08-Cursor_Prompts.md).
2. Run prompt **00** (scaffold), then **01** (Supabase), then **02** (auth), in order.
3. Do not skip prompts.

---

## 11. Verify setup checklist

**Before prompt `02` (auth):**

- [ ] Supabase project linked (or cloud URL + anon key in `.env`)
- [ ] PostGIS enabled
- [ ] Google auth sign-in works on device/simulator

**Before prompts `03` / `09` / `14` / `16` (finish deferred services):**

- [ ] Mapbox geocodes a test ZIP (e.g. 10001 NYC or 90001 LA)
- [ ] Stripe test boost payment succeeds
- [ ] AdMob test banners (or real units before store)
- [ ] EAS configured for beta builds
- [ ] Git push to GitHub works

---

## 11b. Android dev build on Windows (important)

Native builds can use **8+ GB RAM** and **GPU VRAM** (emulator). This project is configured so builds **do not run inside Cursor**.

**PowerShell blocks `npm`?** Use **Command Prompt** (`cmd`), or `npm.cmd run …`, or the `.bat` files in `scripts/`. To fix PowerShell permanently (optional): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**One-time setup**

1. Enable long paths (Administrator) — pick one:
   - Double-click `scripts\enable-windows-long-paths.bat` → Run as administrator
   - Or **cmd:** `npm.cmd run android:long-paths`
   - Or **PowerShell:** `powershell -ExecutionPolicy Bypass -File scripts\enable-windows-long-paths.ps1`
2. **Reboot Windows**
2. Optional: move repo to `C:\dev\Local Marketplace` for shorter paths

**First dev client (once, or after native plugin changes)**

```bash
npm run android:build
```

This opens a **separate PowerShell window** (Gradle max **1 GB** heap, emulator uses **software GPU** and **2 GB RAM**). Close Chrome/games first; closing Cursor during that window helps.

**Every day (no recompile — saves RAM)**

```bash
npm run start
npm run android:install   # reuses existing APK, starts light emulator
```

**Free RAM / VRAM**

```bash
npm run android:emu-stop
```

| Script | RAM impact |
|--------|------------|
| `android:build` | High — external window only |
| `android:install` | Low — no Gradle |
| `android:emu-stop` | Frees emulator + Java |
| `android:clean` | Clears caches (external window) |

Do **not** use `expo run:android` on Windows (`npm run android:run-expo` is disabled).

---

## 12. Troubleshooting

| Issue | Fix |
|-------|-----|
| Android build blocked / long paths | `npm run android:long-paths`, reboot, then `npm run android:build` |
| Cursor or PC froze during build | Close extra apps; script stops emulator during compile and caps Gradle RAM. Do not run builds until long paths are on. |
| Build failed after crash | `npm run android:clean` then `npm run android:build` |
| OAuth redirect fails | Match redirect URI exactly in Google + Supabase; for **https** App Links host `https://yourdomain.com/.well-known/assetlinks.json` (Android) and Apple App Site Association (iOS) |
| PostGIS errors | `CREATE EXTENSION postgis;` in Supabase SQL |
| Edge function 401 | Pass `Authorization: Bearer <user_jwt>` |
| Expo env not loading | Restart Metro; check `app.config.ts` loads dotenv |

---

## 13. Cost estimate (MVP)

| Service | Expected |
|---------|----------|
| Supabase | $0–25/mo |
| Mapbox | $0 (free tier) |
| Stripe | % per paid boost/sub only |
| EAS | Free tier builds limited |
| AdMob | $0 until traffic |
