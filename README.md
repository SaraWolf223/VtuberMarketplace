# VTuber Marketplace

A global marketplace for pre-made digital VTuber assets — 2D Live2D models, 3D VRM/FBX models (incl. VRChat avatars/props), PNGtuber models, accessories, and backgrounds/overlays — with real payments via **Stripe Connect**. Built with **Expo React Native** + **Supabase**, designed for **Cursor AI Auto Mode**.

This repository is the single product the team builds and operates — it is not distributed, licensed, or resold as a template/codebase. Start with [docs/00-Developer_Setup.md](./docs/00-Developer_Setup.md) to configure services, branding, and secrets.

**Continue where you left off:** [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md) — update after every session.

---

## Documentation status

**MVP documentation is complete** (v1.2). Start at [docs/INDEX.md](./docs/INDEX.md).

| Start here | Purpose |
|------------|---------|
| [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md) | Session log, backlog, build checklist |
| [MEDIA_PROVENANCE.md](./MEDIA_PROVENANCE.md) | Provenance and permitted use of bundled sample media |
| [docs/INDEX.md](./docs/INDEX.md) | Master index (all 30+ docs) |
| [docs/01-PRD.md](./docs/01-PRD.md) | Product source of truth |
| [docs/00-Developer_Setup.md](./docs/00-Developer_Setup.md) | Supabase, Stripe, YouTube Data API setup |
| [docs/08-Cursor_Prompts.md](./docs/08-Cursor_Prompts.md) | Build prompts `00` → `16` |
| [AGENTS.md](./AGENTS.md) | Cursor agent instructions |

---

## Documentation tree

```
docs/
├── INDEX.md
├── 00-Developer_Setup.md
├── 01-PRD.md … 24-Brand_and_Marketing_Copy.md   # Product + engineering
├── legal/          # Terms, Privacy, Guidelines (drafts)
└── …
AGENTS.md, CONTRIBUTING.md, CHANGELOG.md
supabase/README.md
```

---

## Auto Mode workflow

1. Complete [docs/00-Developer_Setup.md](./docs/00-Developer_Setup.md).
2. Run prompts in [docs/08-Cursor_Prompts.md](./docs/08-Cursor_Prompts.md) **one at a time**.
3. Do not ask Auto to build the entire app in one shot.

---

## Quick start (after code exists)

```bash
npm install
npm run setup
npm run setup:check
npx expo start
```

`npm run setup` is a local terminal wizard, not a deployable web installer. It writes only git-ignored local configuration. After Supabase migrations, `npm run setup:apply` can apply the allowlisted non-secret platform defaults; finish logo, categories, and email templates in the MFA-protected Admin screens.

---

## EAS builds (prompt 26)

Cloud builds use [EAS](https://docs.expo.dev/build/introduction/). Config: [`eas.json`](./eas.json), [`app.config.ts`](./app.config.ts).

| Profile | Use |
|---------|-----|
| `development` | Internal APK / iOS simulator — dev testing |
| `preview` | Internal TestFlight / APK — QA before store |
| `production` | Play App Bundle / App Store |

### One-time setup

```bash
npm install -g eas-cli   # or: npx eas-cli@latest
eas login
npm run eas:init         # links Expo project; add EAS_PROJECT_ID to .env
```

Set **EAS Secrets** (Dashboard → Project → Secrets) for preview/production:

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_TOKEN`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, AdMob IDs, etc. (see [docs/16-Deployment_and_DevOps.md](./docs/16-Deployment_and_DevOps.md)).

### Validate config (no cloud build)

```bash
npm run eas:validate   # parses eas.json + resolves app.config.ts
eas whoami             # optional — full cloud build needs: eas login && eas init
```

### Build commands

```bash
npm run eas:build:preview:android
npm run eas:build:preview:ios
npm run eas:build:production:android
npm run eas:build:production:ios
```

Submit after a production build: `eas submit --platform android --profile production`

### Common blockers

| Blocker | Fix |
|---------|-----|
| Not logged in | `eas login` |
| No Expo project linked | `npm run eas:init` + `EAS_PROJECT_ID` in `.env` |
| Missing Android keystore | First build prompts to generate; or `eas credentials` |
| Missing Apple team / ASC app | Apple Developer account; create app in App Store Connect |
| Stripe / Google Sign-In on device | Use **preview** profile with secrets; OAuth redirect URIs must include the build scheme |
| Local Windows APK script | Still uses `npm run android` (x86_64 emulator); EAS preview builds **arm64** for real phones |

Store checklist: [docs/18-App_Store_Release_Checklist.md](./docs/18-App_Store_Release_Checklist.md).

### EAS setup walkthrough (first time)

1. **Install CLI and log in**
   ```bash
   npm install -g eas-cli
   eas login
   ```
   Use the Expo account that should own the app (company account before public launch if possible).

2. **Link this repo to an Expo project**
   ```bash
   cd <your-project-folder>
   npm run eas:init
   ```
   Copy the project ID into `.env`:
   ```env
   EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
   Re-run `npm run eas:validate` — `app.config.ts` will include the EAS Update URL when `EAS_PROJECT_ID` is set.

3. **Add environment variables as EAS Secrets** (Project → Secrets → preview + production):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_MAPBOX_TOKEN`
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - AdMob unit IDs (test IDs OK for preview)

4. **First Android preview build** (installable APK on a real phone):
   ```bash
   npm run eas:build:preview:android
   ```
   - CLI will offer to create an Android keystore — accept and let EAS store it.
   - When the build finishes, open the build page URL and download/install the APK.

5. **First iOS preview build** (optional; needs Apple Developer membership):
   ```bash
   npm run eas:build:preview:ios
   ```
   - Register bundle ID `com.example.localmarketplace` in Apple Developer.
   - EAS can manage credentials; follow CLI prompts.

6. **Production** (store): use `npm run eas:build:production:*` after legal pages are live and Stripe is in live mode.

**Note:** Daily Windows dev still uses `npm run android` (local emulator). EAS preview builds target **arm64** phones, not the x86_64 emulator image.

### Native Google sign-in (prompt 02b)

If browser OAuth fails on a **dev or EAS build**, use **Use native Google sign-in** on the sign-in screen.

Requirements:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` (Web client ID from Google Cloud)
- **Development build** — not Expo Go (`npm run android` or EAS preview)
- **Android:** add your app **SHA-1** to the Google Cloud OAuth Android client:
  ```bash
  eas credentials -p android
  ```
  Or from debug keystore: `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`

See [docs/25-Google_Auth_and_Profile.md](./docs/25-Google_Auth_and_Profile.md).

---

## Hard product rules

- No fixed max listing price (must be greater than $0)
- **Real payments via Stripe Connect Express** — destination charges with tiered platform commission (10% free tier / 8% Pro Seller)
- **Digital delivery only** — seller-hosted download links; the platform never stores asset files
- **OTU or P2U licensing** on every listing; seller-authored license text is snapshotted at checkout
- **Global catalog** — no ZIP/radius geo discovery; mature content is age-gated; AI-generated content is banned
- Purchase-verified reviews only; DMs require email verification — see [docs/01-PRD.md](./docs/01-PRD.md)

---

## Repo status

The Expo app and Supabase backend live in this repo. Follow the guided setup and deployment documentation, and track your own work in [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md).

---

## Tech stack

- Expo Router + TypeScript
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Stripe Connect Express (orders, Pro Seller subscriptions, Featured placements)
- YouTube Data API (listing demo video validation)

---

