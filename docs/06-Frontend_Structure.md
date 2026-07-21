# Local Marketplace — Frontend Structure

**Version:** 1.1  
**Framework:** Expo Router + TypeScript

---

## 1. Directory tree (target)

```
app/
├── _layout.tsx                 # Providers: QueryClient, Theme, Auth listener
├── index.tsx                   # Redirect: auth → tabs, else onboarding
├── (auth)/
│   ├── _layout.tsx
│   ├── onboarding.tsx
│   └── sign-in.tsx
├── (tabs)/
│   ├── _layout.tsx             # Tab bar: Home, Sell, Favorites, Profile
│   ├── index.tsx               # Feed
│   ├── sell.tsx                # Create listing wizard entry
│   ├── favorites.tsx
│   └── profile.tsx
├── listing/
│   └── [id].tsx                # Detail
├── profile/
│   └── [userId].tsx            # Public seller profile
├── settings/
│   ├── index.tsx
│   ├── location.tsx            # ZIP + radius
│   ├── safety.tsx
│   └── premium.tsx
├── my-listings/
│   └── index.tsx
└── admin/
    └── reports.tsx             # Optional MVP

src/
├── components/
│   ├── ui/                     # Button, Input, Card, Badge, Toast
│   ├── listing/                # ListingCard, ListingGrid, PriceTag
│   ├── feed/                   # FeedList, FeedFilters, EmptyFeed
│   └── ads/                    # AdBannerSlot
├── features/
│   ├── auth/
│   ├── listings/
│   ├── feed/
│   ├── favorites/
│   ├── profile/
│   ├── reviews/
│   ├── moderation/
│   └── monetization/
├── hooks/
│   ├── useAuth.ts
│   ├── useFeed.ts
│   └── useLocationPrefs.ts
├── lib/
│   ├── supabase.ts
│   ├── query-client.ts
│   ├── stripe.ts
│   ├── analytics.ts
│   └── image-compress.ts
├── stores/
│   ├── prefs-store.ts
│   ├── draft-listing-store.ts
│   └── ui-store.ts
├── theme/
│   ├── tokens.ts
│   └── typography.ts
└── types/
    ├── database.ts             # generated
    └── enums.ts
```

---

## 2. Navigation map

| Route | Screen | Auth |
|-------|--------|------|
| `/(auth)/onboarding` | 3-slide intro | No |
| `/(auth)/sign-in` | Multi-provider sign-in | No |
| `/(tabs)/` | Feed | Yes |
| `/(tabs)/sell` | Listing wizard | Yes |
| `/(tabs)/favorites` | Saved | Yes |
| `/(tabs)/profile` | Own profile | Yes |
| `/listing/[id]` | Detail | Yes |
| `/profile/[userId]` | Seller | Yes |
| `/settings/*` | Prefs | Yes |
| `/my-listings` | Manage | Yes |

**Guard:** `app/_layout.tsx` redirects unauthenticated users to `/(auth)/sign-in` except onboarding.

### Route group rules (required)

| Group | Contains | Must NOT contain |
|-------|----------|------------------|
| `(auth)` | onboarding, sign-in | tabs |
| `(tabs)` | feed, sell, favorites, profile | full-screen modals, listing detail |
| `listing/` | `[id].tsx` detail | tab bar |
| `settings/` | stack screens | — |

Listing detail and sell wizard use **stack** presentation above tabs or as separate stacks — never register detail as a fifth tab.

---

## 3. Screen specifications

### 3.1 Onboarding

- Slide 1: "Cheap finds, near you"
- Slide 2: "Meet locally — no shipping"
- Slide 3: "Stay safe" + link to safety doc
- CTA: Continue → Sign-in

### 3.2 Sign-in (Google, Apple, email/password)

- CTAs: “Continue with Google”, “Continue with Apple” where available, and email/password sign-in/sign-up
- Subtext: provider name/photo are used for the seller profile when available; email users provide display name during sign-up
- Terms + Privacy links (required)
- Loading state during OAuth redirect
- **No** guest mode
- On `SIGNED_IN`: call `syncProfileFromAuthUser` before routing (see [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md))

### 3.3 Location setup (first login modal)

- ZIP input (5 digits, mask)
- Radius picker: chips 5/10/25/50 mi
- Save → geocode → home feed

### 3.4 Feed (`/(tabs)/index`)

**Components:**

- `FeedFilters` — sticky horizontal: search, category, radius, sort
- `FeedList` — FlashList / FlatList with `ListingCard`
- `AdBannerSlot` — every 8 listings
- `EmptyFeed` — seed city CTA

**Actions:** pull-to-refresh, infinite scroll

### 3.5 Listing detail

- Image carousel (full res)
- Title, price (large), category chip, distance, time ago
- Seller row → tap to profile
- Boost badge if active
- Buttons: Favorite, Contact seller, Report
- Contact: bottom sheet with SMS + tap-to-reveal phone

### 3.6 Sell flow (multi-step)

| Step | Fields |
|------|--------|
| 1 Photos | 1–5 images, compress |
| 2 Details | title, price, category |
| 3 Location | ZIP (default prefs) |
| 4 Preview | summary + Publish |

Use `draft-listing-store` between steps.

### 3.7 My listings

- Tabs: Active | Sold | Expired
- Actions per row: Edit, Boost, Mark sold, Delete
- Show `expires_at` countdown on active

### 3.8 Favorites

- List with thumbnail, price, status overlay (sold/expired)

### 3.9 Profile (self)

- **Avatar:** `avatar_url` from Google (expo-image, circular)
- **Name:** `display_name` (Google) + `@username` subtitle
- Premium upsell card
- Stats: rating, listings
- Links: My listings, Settings, Premium
- Settings → email row read-only (“Signed in with Google”)

### 3.10 Public profile

- Google avatar + `display_name` + `@username`
- No email; list seller's active listings

### 3.11 Premium screen

- Benefits list
- Stripe subscribe button
- Remaining boost credits

---

## 4. React Query keys

```typescript
export const queryKeys = {
  session: ['session'] as const,
  profile: (id: string) => ['profile', id] as const,
  prefs: ['prefs'] as const,
  feed: (params: FeedParams) => ['feed', params] as const,
  listing: (id: string) => ['listing', id] as const,
  myListings: (status?: string) => ['my-listings', status] as const,
  favorites: ['favorites'] as const,
  premiumCredits: ['premium-credits'] as const,
};
```

**staleTime:**

- Feed: 60s
- Listing detail: 30s
- Profile: 120s

---

## 5. Key hooks

### `useAuth`

- Subscribes `supabase.auth.onAuthStateChange`
- Exposes `user`, `session`, `isLoading`, `signInWithGoogle`, `signOut`

### `useFeed`

- Reads prefs from Zustand
- Calls `feed-service.getFeed`
- Infinite query with `getNextPageParam: lastPage.next_cursor`

### `useLocationPrefs`

- Syncs ZIP/radius to Supabase `user_prefs`
- On ZIP change: call `geocode-zip`, invalidate feed

---

## 6. Form validation (Zod)

```typescript
export const listingSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  price: z.number().positive('Price must be greater than $0'),
  // Categories are admin-configurable at runtime; validate slug presence
  // client-side and let server RPCs enforce the current allowed set.
  category: z.string().min(1),
  zip_code: z.string().regex(/^\d{5}$/),
});
```

Mirror in Edge `create-listing`.

---

## 7. Contact seller

Two paths, both available from listing detail:

- **In-app DM** (primary): `app/messages/[id].tsx` opens/creates a thread via `getOrCreateListingConversation()` (`src/features/messages/dm-service.ts`). Sending requires phone verification and passes the banned-keyword filter; phone numbers reveal only after both sides accept a meet/deal agreement in the thread.
- **SMS / call** (lower-friction fallback):

```typescript
function openContactSeller(listing: Listing, seller: Profile) {
  // 1. Log analytics contact_tapped
  // 2. Show ActionSheet: Message (opens DM thread), SMS, Call (if phone revealed)
  Linking.openURL(`sms:&body=${encodeURIComponent(listingShareText)}`);
}
```

Phone reveal: require tap "Show phone" (gated on an accepted contact agreement, see **01-PRD.md** §5.4) → log `phone_revealed`.

---

## 8. Ads integration

- `AdBannerSlot` wrapper with consent / ATT (iOS)
- Load ad only when `items.length > 5` to avoid empty feed clutter

---

## 9. Error & empty states

| State | UX |
|-------|-----|
| Feed loading | Skeleton cards × 6 |
| Feed error | Retry button |
| Feed empty | Illustration + "Change radius" + "Post first listing" |
| Network offline | Banner from NetInfo |

---

## 10. Deep linking

| Link | Route |
|------|-------|
| `localmarketplace://listing/{id}` | `/listing/[id]` |
| OAuth redirect | handled by Expo AuthSession |

---

## 11. Performance checklist

- [ ] FlashList for feed
- [ ] expo-image + thumb URLs
- [ ] Memoized `ListingCard`
- [ ] Debounced search 300ms

---

## 12. Platform-specific notes

**iOS:** ATT prompt before AdMob (if required)  
**Android:** back button on wizard goes to previous step

---

## 13. File creation order (Auto Mode)

1. `app/_layout.tsx` + providers
2. `src/lib/supabase.ts` + `src/theme/tokens.ts`
3. Auth screens
4. Tab layout + empty feed
5. Listing components
6. Sell wizard
7. Detail + contact
8. Favorites, profile, settings
9. Monetization screens
10. Ads slot
