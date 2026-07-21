# Local Marketplace static website

Marketing landing + legal pages for **yourdomain.com**.

Buyer overview and production checklist: [docs/35-Included_Landing_Page.md](../docs/35-Included_Landing_Page.md).

Complete reskinning workflow: [docs/36-Reskinning_Guide.md](../docs/36-Reskinning_Guide.md).

| Path | Purpose |
|------|---------|
| `/` | Marketing landing (college students / young adults) + waitlist |
| `/app/` | **Web app** (Expo export — run `npm run web:build`) |
| `/terms`, `/privacy`, … | Legal pages (generated from `docs/legal/`) |
| `/legal` | Legal index hub |

## Local preview

From repo root:

```bash
npm run serve:website
```

Open http://localhost:3456 (landing) · http://localhost:8081 (web app dev with `npm run web`)

See [docs/28-Web_App.md](../docs/28-Web_App.md) for web app setup and `npm run web:build`.

### App-accurate feed preview

The hero uses **example listing photos** (`assets/marketing/` → copied to `website/assets/listings/`) in a 2-column grid matching the app’s `ListingCard` layout.

For a **pixel-perfect app screenshot** (optional):

1. Run the app and open `/marketing-capture` (real `ListingCard` components + staged data).
2. Screenshot on device/simulator, or install web support (`npx expo install react-native-web`) and run `node scripts/capture-marketing-screenshots.mjs`.
3. Or screenshot the landing mock: `node scripts/capture-landing-phone.mjs` (with `npm run serve:website` running).

## Waitlist + Founding Seller codes

There is **one unified waitlist** (iPhone + Android launch together). Every signup automatically creates a **unique Founding Seller promo code** (`FC-XXXXXXXX`) via the Supabase Edge Function `join-waitlist`, and records a `platform` value (`ios` / `android` / `web`) for launch planning.

> **Deprecated:** the separate iPhone waitlist (`join-ios-waitlist`, table `ios_waitlist_signups`) is no longer used by the landing page as of migration `099`. The table/function/admin screen are retained but receive no new rows.

### Setup

1. Apply migrations (`npx supabase db push`) — includes `082` (waitlist + founding codes) and `099` (unified `platform` field).
2. Deploy: `npx supabase functions deploy join-waitlist`.
4. Copy `website/scripts/waitlist-config.example.js` → `waitlist-config.js` (or edit the existing file).
5. Set the **same** project URL and anon key as the mobile app:

```javascript
window.LOCAL_MARKETPLACE_WAITLIST = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  source: 'landing-page',
  formspreeEndpoint: '', // optional: duplicate submissions to Formspree
  turnstileSiteKey: '', // optional: Cloudflare Turnstile bot check on the waitlist forms
};
```

6. Redeploy `website/`.

**Optional bot protection:** create a Cloudflare Turnstile widget, put its **site key** in `turnstileSiteKey` above, and set the matching **secret key** as the `TURNSTILE_SECRET_KEY` Supabase Edge Function secret. Leave both blank to skip — the waitlist works either way.

### User flow (Android waitlist)

1. Visitor submits email + home ZIP on the landing page.
2. Page shows their **Founding Seller code** immediately (copy button).
3. After app launch, they sign in with the **same email**, verify phone, and redeem under **Settings → Redeem promo code**.
4. Codes are **email-locked** to the waitlist address (cannot be shared to another account).

### User flow (iPhone waitlist) — deprecated, kept for reference only

The landing page no longer has a separate iPhone-only form; every visitor (iOS or Android) goes through the **one unified waitlist** described above and gets the same `FC-` founding code, with `platform` recorded from the form. This section describes the old, no-longer-live flow that existed before migration `099`:

1. ~~Visitor uses the **Join iPhone waitlist** form (email + optional ZIP).~~
2. ~~No founding code — confirmation message only.~~
3. ~~Admin emails this list separately under **Bulk email → iPhone waitlist**.~~

The `ios_waitlist_signups` table and `join-ios-waitlist` function still exist (so historical rows aren't lost) and the admin **Bulk email → iPhone waitlist** audience still works for anyone already in that table, but no new rows are ever added to it.

If Supabase is not configured, the form shows an error (or use optional Formspree-only mode via `formspreeEndpoint` without auto codes).

## Regenerate legal pages

Does **not** overwrite the marketing home (`website/index.html`).

```bash
npm run generate:legal
```

Writes `website/legal/index.html` and `website/{terms,privacy,...}/index.html`.

## Deploy

The static `website/` folder can be deployed to Cloudflare Pages, Netlify, Vercel, or any static host. Use your own project name, production branch, and custom domain.

### Cloudflare Pages example (from repo root)

```bash
npx wrangler pages deploy website --project-name=YOUR_PAGES_PROJECT --branch=production
```

- Requires Wrangler auth (`npx wrangler login`) on your machine.
- Use the branch your host treats as production; other branches usually create preview URLs.
- Point your custom domain to the host after the first successful deploy.

### Cache-busting (IMPORTANT)

Static assets are served with `cache-control: max-age=14400` and **no automatic fingerprint**, so browsers can run a **stale** `waitlist.js` after you ship JS/CSS changes (symptom: forms reload the page / "nothing changed").

When you edit `styles/*.css` or `scripts/*.js`, **bump the version query string** on every reference in `index.html`:

```html
<link rel="stylesheet" href="/styles/landing.css?v=YYYYMMDDx" />
<script src="/scripts/waitlist.js?v=YYYYMMDDx"></script>
```

(Search `?v=` in `index.html` — keep all asset versions in sync.) HTML itself is revalidated by Pages, so the new `?v=` is picked up on the next load.

### Test before deploy

1. Serve locally: `npm run serve:website` → http://localhost:3456
2. Form/no-reload smoke test (headless Chromium, **mocks Supabase so no real signups are written**):
   - `npx playwright install chromium` (first time only)
   - Throwaway test scripts go in `scripts/_*.mjs` (delete after) — route `**/functions/v1/join-waitlist` and `**/rest/v1/rpc/get_waitlist_public_stats` to fake responses, then assert the hero + main forms reveal the founding code **without a page navigation**.
3. Manual checklist: [docs/29-Web_QA_Checklist.md](../docs/29-Web_QA_Checklist.md).

### Backend (Supabase) deploys separately

```bash
npx supabase db push                              # migrations
npx supabase functions deploy join-waitlist       # edge function
```

Project ref: see your own linked project in [supabase/README.md](../supabase/README.md). Verify the public counter with a read-only call to the `get_waitlist_public_stats` RPC; **never** test the live function in a way that writes junk signups (they're permanent and count toward the public counter).

### Host requirements (any host)

- `/` serves `index.html`
- `/terms` → `terms/index.html` (clean URLs / trailing slash per host)
- `waitlist-config.js` deployed with production Supabase keys

Brand tokens: [docs/07-UI_UX_Design_System.md](../docs/07-UI_UX_Design_System.md)
