# Local Marketplace — Backend Architecture

**Version:** 1.1  
**Platform:** Supabase

---

## 1. Architecture diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Expo React Native App                     │
│  React Query │ Zustand │ Supabase JS │ Stripe SDK           │
└────────────┬───────────────────────────────┬────────────────┘
             │ JWT                           │ Webhooks (server)
             ▼                               ▼
┌──────────────────────── Supabase ────────────────────────────┐
│  Auth (Google, Apple, email) │ PostgREST │ Storage │ Realtime (opt) │
│  PostgreSQL + PostGIS + RLS + RPC + pg_cron                  │
│  Edge Functions: create-listing, feed helpers, stripe, cron  │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
      Mapbox Geocoding API              Stripe API
```

**No separate Node server in MVP.**

---

## 2. Supabase project setup

### 2.1 Projects

| Environment | Project | Purpose |
|-------------|---------|---------|
| `development` | `localmarketplace-dev` | Local + TestFlight internal |
| `production` | `localmarketplace-prod` | App Store / Play Store |

### 2.2 Enable extensions

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 2.3 Auth configuration

- Providers: Google OAuth, Apple Sign-In, and email/password
- Redirect URLs: Expo scheme `localmarketplace://` + dev URLs
- Email confirmations: configure to match your email/password launch policy
- JWT expiry: default; refresh handled by SDK

### 2.4 Storage

- Bucket: `listing-images`
- Public read: **yes** (MVP simplicity)
- Max file size: 2MB (bucket policy)
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`

---

## 3. Edge Functions catalog

| Function | Auth | Purpose |
|----------|------|---------|
| `on-auth-user-created` | service | Create profile stub |
| `geocode-zip` | user | ZIP → lat/lng |
| `create-listing` | user | Validate + insert draft listing + signed upload URLs |
| `finalize-listing-images` | user | Attach images, set active |
| `create-boost-checkout` | user | Stripe PaymentIntent |
| `apply-boost` | user/service | Extend boosted_until |
| `create-premium-checkout` | user | Stripe subscription session |
| `stripe-webhook` | stripe signature | Payment events |
| `purge-expired-listings` | service cron | Delete DB + storage |
| `purge-expired-college-badges` | service cron | Clear college badge after 10-day re-verify grace |
| `send-expiry-notifications` | service cron | Expo push |
| `admin-action` | admin | Moderation |

**Shared modules** (`supabase/functions/_shared/`):

- `supabaseAdmin.ts` — service role client
- `stripe.ts` — Stripe SDK init
- `errors.ts` — envelope helpers
- `moderation.ts` — keyword check
- `cors.ts`

---

## 4. Listing creation flow (backend)

```
Client → create-listing (validate price, keywords, zip)
       → returns listing_id (status draft) + signed URLs
Client → PUT images to Storage
Client → finalize-listing-images
       → inserts listing_images rows
       → sets listing status active, image_count
       → triggers search_vector update
```

**Draft status:** Optional `listing_status` value `draft` — if added, finalize transitions to `active`. Otherwise create as `active` only after finalize.

**Recommendation:** Use `draft` to avoid empty-image listings in feed.

---

## 5. Feed query architecture

- Primary: RPC `get_feed_listings` (see **03-Database_Schemas.md**)
- **Two-phase query:** filter `status=active` (+ category/price) before `ST_DWithin`
- **Radius:** only values 5, 10, 25, 50 (index-friendly)
- Distance: `ST_Distance(...)` / 1609.34 as miles; closest sort may use `<->` KNN
- Boost tier: `CASE WHEN boosted_until > now() THEN 0 ELSE 1 END` ASC

**Do not** compute distance client-side for filtering — server only.

---

## 6. Stripe integration

### 6.1 Products (Stripe Dashboard)

| Product | Price ID variable | Amount |
|---------|-------------------|--------|
| Listing Boost | `STRIPE_PRICE_BOOST` | $1.00 one-time |
| Premium Seller | `STRIPE_PRICE_PREMIUM` | $5.00/month recurring |

### 6.2 Webhook flow

```
Stripe → stripe-webhook edge
       → verify signature
       → insert webhook_events (idempotency)
       → branch on event type
       → update listings / premium_subscriptions / profiles.is_premium
```

### 6.3 Premium boost credits

On `invoice.paid` for premium subscription:

- Upsert `premium_boost_credits` for current month with `credits_used = 0`
- When boost with `source = premium_credit`, increment `credits_used` if `< credits_total`

---

## 7. Cron & scheduled jobs

Prefer **Supabase pg_cron** for status transitions; **Edge scheduled** for storage purge (needs Storage API).

| Job | Implementation |
|-----|----------------|
| Expire listings | SQL: `UPDATE listings SET status='expired' WHERE ...` |
| Purge + storage delete | Edge `purge-expired-listings` daily |
| College badge purge | Edge `purge-expired-college-badges` daily (or pg_cron `purge_expired_college_badges()`) |
| Expiry notifications | Edge `send-expiry-notifications` |
| Monthly boost credits | SQL on 1st of month |

---

## 8. Realtime (optional MVP)

**Defer** Realtime subscriptions unless needed for admin dashboard.

Feed refresh: pull-to-refresh + React Query `staleTime: 60_000`.

---

## 9. Secrets management

| Secret | Where |
|--------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge only, EAS secrets, CI |
| `STRIPE_SECRET_KEY` | Edge only |
| `STRIPE_WEBHOOK_SECRET` | Edge only |
| `MAPBOX_ACCESS_TOKEN` | Edge geocode + optional client |
| `EXPO_PUBLIC_SUPABASE_*` | App bundle |

**Never** commit secrets to git.

---

## 10. Observability

- Supabase Logs for Edge Functions
- Stripe Dashboard for payment failures
- MVP analytics: PostHog or Expo Insights (see **19-Analytics_and_Growth.md**)

---

## 11. Backup & recovery

- Supabase Pro: daily backups (when on paid plan)
- Storage: rely on purge job; no versioning MVP
- Document restore runbook in **16-Deployment_and_DevOps.md**

---

## 12. Local development

```bash
supabase init
supabase start
supabase db reset   # applies migrations
supabase functions serve
```

Use `.env.local` for keys; `app.config.ts` injects `EXPO_PUBLIC_*`.

---

## 13. Scaling thresholds (when to change architecture)

| Signal | Action |
|--------|--------|
| Feed p95 > 300ms | Add materialized view or Redis (later) |
| Storage > 50GB | Move to R2 + CDN (later) |
| Edge cold starts painful | Combine small functions |
| National scale | Regional read replicas (much later) |

MVP stays on single Supabase project.
