# Local Marketplace — Cursor Rules

**Purpose:** Persistent rules for Cursor AI Auto Mode. Copy sections into `.cursor/rules/*.mdc` or reference this file in every session.

**Version:** 1.1

---

## 1. Project identity

You are building **Local Marketplace**, a hyperlocal marketplace (Expo + Supabase). Read `docs/01-PRD.md` before architectural changes.

**Non-negotiables:**

- No fixed max listing price (price must be greater than $0)
- No shipping, escrow, or item payment processing in MVP. In-app DM is shipped (phone-verified senders, rate-limited, banned-keyword filtered) — see [01-PRD.md](./01-PRD.md) §5.4
- Listings expire after **21 days** (standard) or **2 months** (Premium); hard delete **7 days after expiry**
- Geo-filtered feed is mandatory — never show nationwide listings without radius

---

## 2. Repository structure (required)

```
Local Marketplace/
├── app/                    # Expo Router screens
├── src/
│   ├── components/         # Presentational UI
│   ├── features/           # Feature modules (listings, auth, etc.)
│   ├── hooks/              # Shared hooks
│   ├── lib/                # supabase client, stripe, geo, analytics
│   ├── stores/             # Zustand stores
│   ├── types/              # Shared TypeScript types (mirror DB enums)
│   └── utils/              # Pure helpers
├── supabase/
│   ├── migrations/         # SQL migrations only (ordered)
│   └── functions/          # Edge functions
├── docs/                   # DO NOT delete or rename without user ask
└── assets/
```

**Rules:**

- Do not create `src/screens` if `app/` exists — use Expo Router in `app/`
- One feature folder per domain: `src/features/listings`, `auth`, `profile`, `monetization`, `moderation`
- No business logic inside `app/_layout.tsx` beyond providers

---

## 3. TypeScript standards

- `"strict": true` in `tsconfig.json`
- No `any` — use `unknown` + narrowing or generated Supabase types
- Generate types: `npx supabase gen types typescript --local > src/types/database.ts`
- Shared enums in `src/types/enums.ts` MUST match Postgres enums in **03-Database_Schemas.md**
- Prefer `interface` for object shapes, `type` for unions
- All exported functions in `lib/` and `utils/` need explicit return types

---

## 4. Naming conventions

| Item | Convention | Example |
|------|------------|---------|
| React components | PascalCase | `ListingCard.tsx` |
| Hooks | camelCase, `use` prefix | `useListingsFeed.ts` |
| Files (non-component) | kebab-case or camelCase consistent per folder | `listing-service.ts` |
| DB tables | snake_case plural | `listings`, `user_profiles` |
| DB columns | snake_case | `boosted_until` |
| API / edge routes | kebab-case | `purchase-boost` |
| Env vars | `EXPO_PUBLIC_*` for client-safe only | `EXPO_PUBLIC_SUPABASE_URL` |

---

## 5. Supabase rules

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in the Expo app
- All tables have **RLS enabled** — no exceptions
- Migrations are additive and idempotent where possible; one concern per migration file
- Use Postgres enums for `category`, `listing_status`, `report_reason`
- Geospatial: use `geography(Point,4326)` + GiST index — see **09-Search_and_Radius_System.md**
- Prefer RPC functions for complex feed queries (single round-trip)
- Storage paths: `{user_id}/{listing_id}/{image_index}.webp`

---

## 6. React / Expo rules

- Functional components only
- Data fetching: **TanStack React Query** — no raw `useEffect` fetch except one-off geo init
- Mutations invalidate precise query keys: `['listings','feed', zip, radius]`
- Images: `expo-image` with blurhash/thumb URL from storage
- Forms: `react-hook-form` + `zod` schemas duplicated from API validation
- Navigation: typed routes via Expo Router; params validated with zod
- No inline styles > 3 properties — use `StyleSheet` or shared tokens from **07-UI_UX_Design_System.md**

---

## 7. State management split

| State type | Tool |
|------------|------|
| Server data | React Query |
| Auth session | Supabase listener + React Query `['session']` |
| User prefs (radius, zip) | Zustand `usePrefsStore` persisted with AsyncStorage |
| Draft listing (create flow) | Zustand ephemeral |
| UI (modals, sheets) | Local `useState` or Zustand `useUiStore` |

Do not put server listings in Zustand.

---

## 8. API and error handling

- Wrap Supabase calls in feature services (`listing-service.ts`)
- Standard error shape:

```typescript
type AppError = {
  code: string;
  message: string;
  details?: unknown;
};
```

- User-facing errors: short, actionable ("Price must be greater than $0")
- Log technical errors with `__DEV__` guard only
- Never swallow errors in mutations — surface toast via shared `showErrorToast`

---

## 9. Security rules

- Validate price is greater than $0 on client AND rely on DB constraint; there is no fixed maximum listing price
- Sanitize title/description length: title ≤ 80, description ≤ 500
- Rate limit listing creation: max 10/hour/user (edge function or DB trigger log)
- Phone numbers: store encrypted or not at all in MVP — prefer "seller provides at meetup" + optional profile phone with RLS owner-only
- Block list checked in feed RPC
- Admin actions require `profiles.role = 'admin'`

---

## 10. Image handling rules

- Compress with `expo-image-manipulator` before upload (max width 1200px, quality 0.7)
- Reject upload if still > 2MB
- Generate and upload `_thumb.webp` (400px) in edge function or client
- Delete storage files when listing purged — **11-Storage_and_Deletion_System.md**

---

## 11. Monetization rules

- Stripe only for `boost` and `premium_subscription`
- Webhook handler idempotent on `event.id`
- Boost extends `boosted_until = GREATEST(boosted_until, now()) + interval '24 hours'`
- Premium grants 5 boosts/month — track in `premium_boost_credits` table

---

## 12. Testing expectations

- Pure utils: unit tests (Jest)
- Critical RPC: integration test against local Supabase
- Do not add snapshot tests for entire screens unless asked
- See **17-Testing_and_QA.md**

---

## 13. Git and commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- One logical change per commit
- Do not commit `.env`, keys, or `google-services.json` with secrets
- Update `docs/` when changing API contracts

---

## 14. Auto Mode workflow (mandatory)

1. Read the specific **08-Cursor_Prompts.md** section for the task
2. Implement **only** that section's scope
3. Run typecheck / lint before marking done
4. Do not refactor unrelated files
5. If PRD conflict, stop and ask user

**Forbidden prompts to accept from user without splitting:**

- "Build the entire app"
- "Add full marketplace like OfferUp"

---

## 15. UI consistency

- Import colors, spacing, typography from `src/theme/tokens.ts` (create from **07-UI_UX_Design_System.md**)
- Primary CTA: one per screen
- Listing cards identical in feed, profile, and favorites

---

## 16. Performance

- Feed: **FlashList** (not FlatList) with fixed card height
- Feed pagination: 20 items per page, cursor on `(boosted_sort, created_at, id)`
- Prefetch next page at 70% scroll
- Skeleton loaders on feed — target **&lt;3s** perceived load
- `staleTime` 60s on feed; pull-to-refresh invalidates
- Thumbnail URLs in lists; full images in detail only

## 16b. Navigation (Expo Router)

- Route groups: `(auth)`, `(tabs)`, listing/detail **outside** tabs
- Modals and `/listing/[id]` must not be nested inside tab navigator
- QueryClientProvider in root `app/_layout.tsx` only

## 16c. Mutations

- Favorites: **optimistic update** with rollback on error

---

## 17. Accessibility

- Minimum touch target 44×44
- `accessibilityLabel` on icon-only buttons
- Support dynamic type where feasible

---

## 18. When unsure

Default choices:

- Simpler implementation
- Fewer dependencies
- Match existing file patterns in repo
- Defer to **15-MVP_vs_Future_Features.md** (if not in MVP, don't build)
