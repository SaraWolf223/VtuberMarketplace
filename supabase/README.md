# Local Marketplace — Supabase Backend

PostgreSQL schema, RLS, and Edge Function shared helpers for Local Marketplace.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm install -g supabase`
- Docker Desktop (for **local** `supabase start` only)
- PostGIS enabled on cloud project (Dashboard → Database → Extensions)

## Link your cloud project

```bash
supabase login
cd path/to/local-marketplace
supabase link --project-ref YOUR_PROJECT_REF
```

## Apply migrations to cloud (recommended)

```bash
supabase db push
```

Or run each file in order via **Supabase Dashboard → SQL Editor** (001 through 017).

## Local development (optional)

```bash
supabase start          # Docker: local Postgres + Studio
supabase db reset       # Apply all migrations + seed.sql
supabase stop
```

Local Studio: http://localhost:54323

## Migration files (order)

| File | Contents |
|------|----------|
| `001_extensions.sql` | postgis, pg_trgm |
| `002_enums.sql` | All enum types |
| `003_profiles.sql` | profiles + profiles_public view |
| `004_user_prefs.sql` | ZIP / radius prefs |
| `005_listings.sql` | initial listings table (later migration `096` removes the fixed price cap; final rule is price > $0) |
| `006_listing_images.sql` | images + storage bucket |
| `007_social.sql` | favorites, reviews, blocks, interest |
| `008_moderation.sql` | reports, banned_keywords |
| `009_monetization.sql` | boosts, premium |
| `010_rls_policies.sql` | RLS + storage policies |
| `011_rpc_feed.sql` | `get_feed_listings` RPC |
| `012_triggers.sql` | expiry dates, listing_count, updated_at |
| `013_seed_keywords.sql` | 20 banned keywords |
| `014_support_tables.sql` | webhook_events, listing_create_log |
| `015_upsert_user_prefs_rpc.sql` | `upsert_user_prefs_location` RPC (ZIP save) |
| `016_fix_upsert_user_prefs_rpc.sql` | PostGIS path fix + profile check |
| `017_upsert_prefs_ensure_profile.sql` | **Required for ZIP save** — creates profile from `auth.users`, then saves prefs |
| `018_zip_centroids.sql` | ZIP geocode cache for `geocode-zip` edge function |
| `019_listing_location_helper.sql` | `insert_draft_listing` RPC for PostGIS draft inserts |
| `020_enhance_feed_rpc.sql` | Full `get_feed_listings` (geo, boost, blocks, search, cursor) |

**Edge functions:** `geocode-zip`, `create-listing`, `finalize-listing-images`

## Verify after push

In SQL Editor:

```sql
-- Final price constraint requires price > 0 with no fixed maximum
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'listings'::regclass AND conname LIKE '%price%';

-- PostGIS
SELECT PostGIS_Version();

-- Keywords seeded
SELECT count(*) FROM banned_keywords;
```

## Phone verification (Prompt 16)

1. **Supabase Dashboard** → Authentication → Providers → **Phone** → enable.
2. Configure **Twilio** (or MessageBird) with your SMS credentials.
3. Client flow: `updateUser({ phone })` → SMS OTP → `verifyOtp` → RPC `complete_phone_verification`.
4. Migration `038_phone_verification.sql` syncs `auth.users.phone` → `profiles.phone` + `phone_verified_at`.
5. **Dev:** Settings → Verify phone → “Dev: skip SMS” uses `mark_phone_verified_stub` when `__DEV__` is true.

Gated server-side: `send_conversation_message`, `create-listing` edge (`PHONE_NOT_VERIFIED`).

## Generate TypeScript types

```bash
supabase gen types typescript --linked > ../src/types/database.ts
```

## Edge Functions (`functions/_shared/`)

| Module | Purpose |
|--------|---------|
| `cors.ts` | CORS headers |
| `errors.ts` | JSON error envelope |
| `supabaseAdmin.ts` | Service-role client |

Deploy functions later: `supabase functions deploy <name>`

## Secrets (Dashboard → Edge Functions)

- `SUPABASE_SERVICE_ROLE_KEY` (auto in Edge runtime)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MAPBOX_ACCESS_TOKEN`

## Docs

- [docs/03-Database_Schemas.md](../docs/03-Database_Schemas.md)
- [docs/05-Backend_Architecture.md](../docs/05-Backend_Architecture.md)
- [docs/08-Cursor_Prompts.md](../docs/08-Cursor_Prompts.md) — prompt `01`
