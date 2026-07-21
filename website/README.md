# VTuber Marketplace static website

Marketing landing + legal pages for **yourdomain.com**.

| Path | Purpose |
|------|---------|
| `/` | Marketing landing + early-access waitlist |
| `/app/` | **Web app** (Expo export — run `npm run web:build`) |
| `/terms`, `/privacy`, … | Legal pages (generated from `docs/legal/`) |
| `/legal` | Legal index hub |

See [docs/28-Web_App.md](../docs/28-Web_App.md) for web app setup and `npm run web:build`.

## Local preview

From repo root:

```bash
npm run serve:website
```

Open http://localhost:3456 (landing) · http://localhost:8081 (web app dev with `npm run web`)

### App-accurate feed preview

The hero uses **example listing photos** (`assets/marketing/` → copied to `website/assets/listings/`) in a 2-column grid matching the app’s `ListingCard` layout.

For a **pixel-perfect app screenshot** (optional):

1. Run the app and open `/marketing-capture` (real `ListingCard` components + staged data).
2. Screenshot on device/simulator, or install web support (`npx expo install react-native-web`) and run `node scripts/capture-marketing-screenshots.mjs`.
3. Or screenshot the landing mock: `node scripts/capture-landing-phone.mjs` (with `npm run serve:website` running).

## Waitlist (early access)

The landing page can collect early-access signups via the Supabase Edge Function `join-waitlist`. Configure `website/scripts/waitlist-config.js` (copy from `waitlist-config.example.js`) with the same project URL and anon key as the mobile app.

```javascript
window.LOCAL_MARKETPLACE_WAITLIST = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  source: 'landing-page',
  formspreeEndpoint: '', // optional duplicate submissions
  turnstileSiteKey: '', // optional Cloudflare Turnstile
};
```

**Optional bot protection:** create a Cloudflare Turnstile widget, put its **site key** in `turnstileSiteKey`, and set the matching **secret key** as the `TURNSTILE_SECRET_KEY` Edge Function secret.

> **Note:** The waitlist flow still carries legacy founding-seller promo-code behavior from the original hyperlocal prototype. Treat it as optional launch plumbing — the product domain is a global VTuber asset marketplace, not a ZIP-based local pickup app.

## Regenerate legal pages

Does **not** overwrite the marketing home (`website/index.html`).

```bash
npm run generate:legal
```

Writes `website/legal/index.html` and `website/{terms,privacy,...}/index.html`.

## Deploy

The static `website/` folder can be deployed to Cloudflare Pages, Netlify, Vercel, or any static host.

### Cache-busting (IMPORTANT)

When you edit `styles/*.css` or `scripts/*.js`, **bump the version query string** on every reference in `index.html`:

```html
<link rel="stylesheet" href="/styles/landing.css?v=YYYYMMDDx" />
<script src="/scripts/waitlist.js?v=YYYYMMDDx"></script>
```

Brand tokens: [docs/07-UI_UX_Design_System.md](../docs/07-UI_UX_Design_System.md)
