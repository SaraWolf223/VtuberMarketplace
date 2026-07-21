# Local Marketplace — Testing and QA

**Version:** 1.1

---

## 1. Test pyramid

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| Unit | Jest | utils, zod schemas, price validation |
| Integration | Supabase local + jest | RPC feed, RLS |
| E2E | Manual TestFlight | Critical paths |
| Payments | Stripe test mode | Boost + subscription |

---

## 2. Unit tests (required)

### `src/utils/price.test.ts`

- Accept 0.01, 20.00, 20.01, 9999.99
- Reject 0, negative, non-numeric input

### `src/utils/zip.test.ts`

- Valid 5-digit ZIP
- Reject 4 digit, letters

### `listingSchema` zod tests

- Title length, price greater than $0

---

## 3. Integration tests

### Feed RPC `get_feed_listings`

Setup seed data:

- User at test city center
- Listing A: 2 miles away, active
- Listing B: 15 miles away, active
- Listing C: 2 miles, expired

**Assert:**

- radius 10 → A yes, B no, C no
- boosted A sorts above non-boosted same distance

### RLS (required — test via client SDK)

- User A cannot update User B listing
- User A cannot read User B `profiles` email (only `profiles_public`)
- User A cannot upload to User B storage path
- Banned user cannot insert listing
- Anon cannot insert into `reports` without auth

---

## 4. Manual QA checklist (pre-release)

### Auth (real device required)

- [ ] Google sign-in works iOS + Android (Path A OAuth)
- [ ] If OAuth fails: test Path B native Google (prompt 02b)
- [ ] Profile shows Google **name + photo** after sign-in
- [ ] Email only in settings, read-only
- [ ] Sign-out → sign-in same account preserves listings
- [ ] Logout clears session
- [ ] New user forced through ZIP setup

### Listings

- [ ] Create with 1 and 5 images
- [ ] Reject 6th image
- [ ] Reject price $25
- [ ] Edit title as owner
- [ ] Non-owner cannot edit

### Feed

- [ ] Empty state at impossible ZIP
- [ ] Radius change refreshes
- [ ] Search finds keyword
- [ ] Category filter works
- [ ] Boosted listing appears first

### Contact

- [ ] SMS opens with listing text
- [ ] In-app DM: opening a listing thread creates/reuses one conversation per buyer, blocked users can't message or be messaged
- [ ] DM send is blocked until phone is verified, and rejects messages over 2000 chars or containing a banned keyword
- [ ] DM send is rate-limited at 15 messages/minute per conversation
- [ ] Phone numbers only reveal after both sides accept a meet/deal agreement in the thread

### Monetization

- [ ] Boost payment applies `boosted_until` (Android Stripe test card)
- [ ] iOS: boosts disabled OR IAP consumable works (see 10-Monetization_System.md §2)
- [ ] Webhook idempotency: replay same `stripe_event_id` once
- [ ] Premium badge shows
- [ ] Free boost credit decrements

### Lifecycle

- [ ] Mark sold removes from active feed
- [ ] Expired hidden (simulate with SQL)
- [ ] Purge deletes images from storage

### Safety

- [ ] Report submits
- [ ] Block hides seller
- [ ] Banned keyword rejects create

### Ads

- [ ] Test banner shows in feed
- [ ] No ad on sign-in

---

## 5. Device matrix

| Device | OS |
|--------|-----|
| iPhone 12+ | iOS 17+ |
| Pixel 6 | Android 13+ |
| Low-end Android | API 30 |

---

## 6. Performance tests

- Feed scroll 200 items without crash
- Cold start < 3s
- Image upload < 10s on LTE

---

## 7. Stripe test cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

---

## 8. Regression before each release

Run manual checklist §4 + unit tests + typecheck.

---

## 9. Beta feedback

- TestFlight group: 10–20 local users in seed city
- Form: Google Form for bugs + "empty feed" reports
