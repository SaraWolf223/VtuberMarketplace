# Local Marketplace — Web App (Expo Web)

**Purpose:** Browser version of the mobile app at **`https://yourdomain.com/app/`**, sharing the same Supabase backend. Advertise the landing page only; visitors open the web app or install the iOS/Android app when ready.

> **Launch status:** `website/app/` is **not deployed yet**, so the landing page's "Open app" CTAs currently point at the waitlist (`#waitlist`) to avoid 404s. Once `npm run web:build` output is deployed, re-add the "Open app" → `/app/` CTAs (header button, hero primary, nav link, hero browser line) — at that point web becomes the always-on browser channel for anyone who wants to try the app before installing. Don't flip that switch until a ZIP cluster is seeded, though, so first impressions aren't an empty feed.

---

## Phase 1 scope (current)

| Feature | Web |
|---------|-----|
| Sign-in (Google OAuth redirect, email/password; Apple is iOS-app-only) | Yes |
| Feed (ZIP + radius) | Yes |
| Listing detail | Yes |
| Create / edit listings | Yes |
| Favorites, profile, DMs | Yes |
| Stripe boosts / premium checkout | **No** (Android app) |
| AdMob banners | **No** |
| Phone SMS verify | Depends on Supabase Phone Auth in browser |

---

## Local development

```bash
npm run web
```

Open **http://localhost:8081**

### Supabase Auth URLs

Add to **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:8081/callback`
- `https://yourdomain.com/app/callback` (production)

**Site URL** can stay your primary marketing URL (`https://yourdomain.com`).

---

## Production build (landing + app same domain)

```bash
npm run web:build
```

This:

1. Sets `EXPO_PUBLIC_WEB_BASE_PATH=/app`
2. Runs `expo export --platform web`
3. Copies `dist/` → `website/app/`

Deploy the whole **`website/`** folder. Routes:

| URL | Content |
|-----|---------|
| `/` | Marketing landing |
| `/app/` | Web app |
| `/terms`, … | Legal pages |

Landing **Open app** buttons link to `/app/`.

---

## Environment variables

| Variable | When | Example |
|----------|------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Always | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Always | Anon key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Optional on web | Same Web client as Supabase Google provider |
| `EXPO_PUBLIC_WEB_BASE_PATH` | Production export | `/app` (set by `web:build`) |
| `EXPO_PUBLIC_WEB_APP_ORIGIN` | Production export | `https://yourdomain.com` |

---

## Architecture notes

- Same Expo Router app as Android; Metro resolves `.web.tsx` stubs for native-only modules (`AppStripeProvider`, Stripe hooks).
- Google auth on web uses full-page OAuth redirect (not `expo-web-browser` auth session).
- Native modules blocked on web: `@stripe/stripe-react-native`, `react-native-google-mobile-ads`, `@react-native-google-signin/google-signin`.

### Desktop layout (web) — **current priority**

Breakpoint: **768px** and up (`WEB_DESKTOP_BREAKPOINT`). Ship and QA **desktop first**. Below 768px, the app falls back to an app-like layout (bottom tabs, 2-col feed) — **mobile-web polish is deferred** until desktop is signed off.

Based on [OfferUp](https://offerup.com/) desktop (explore/category pages):

| OfferUp pattern | Local Marketplace desktop web |
|-----------------|------------------------|
| Location + radius first | `FeedLocationHeader` left of search |
| Large “Search for sale” bar | Pill search row under nav (`WebTopBar`) |
| Horizontal category chips | `WebCategoryNav` on home feed |
| Utility links (Saved, Activity, Profile) | Centered text nav with underline active state |
| **Promoted** listings inline | Boost/premium border on `ListingCard` |
| **Sponsored** grid cells (Bing/eBay product cards) | `FeedInGridGoogleAd` — **one grid cell**, not full-width strips |
| Uniform multi-column grid (~250px thumbs) | 5-column grid, listing-sized ad cells |
| Post CTA top-right | **Post ad** button |

### Mobile web (< 768px) — deferred

Fallback only for now (reuse native-like chrome). Dedicated mobile-web design comes **after** desktop web is complete.
- **Desktop web** inserts ads as in-grid sponsored cards every 6 listings (alternating platform + programmatic).
- **Website-style shell (desktop):** gray page chrome (`WEB_DESKTOP_CHROME_BG`), white content column, persistent `WebTopBar`, text nav links, `WebPageTitle` on tab routes, `WebSubpageHeader` on stack routes, settings left sidebar, listing detail two-column layout, centered sign-in card.
- **QA (desktop focus):** `npm run web:qa:desktop` (1440px). Mobile: `npm run web:qa:mobile` — smoke only, polish later.

---

## Related docs

- [website/README.md](../website/README.md) — landing + deploy
- [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md) — OAuth setup
- [06-Frontend_Structure.md](./06-Frontend_Structure.md) — app structure
