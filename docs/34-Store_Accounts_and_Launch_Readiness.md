# Local Marketplace — Store Accounts, Closed Beta & Launch-Readiness

**Version:** 1.0
**Audience:** Project operator + development agents
**Purpose:** Everything you need to (1) create **Google Play** and **Apple Developer** accounts, (2) run a **closed beta** for founding members, and (3) stand up **staff/admin email notifications** (including waitlist sign-ups — this functionality already exists in the codebase; you just need to configure and deploy it).

**Related docs:** [00-Developer_Setup.md](./00-Developer_Setup.md) · [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md) · [18-App_Store_Release_Checklist.md](./18-App_Store_Release_Checklist.md) · [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md) · [21-Edge_Functions_Spec.md](./21-Edge_Functions_Spec.md) · [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md)

> **How to read this doc.** Parts A–C are **human account/console work** (you must do these — credentials + legal identity required). Part D is **closed-beta strategy**. Parts E–F describe **notification features that already ship in this codebase** — you mainly need to configure secrets and deploy. Part G is the **ordered checklist**.

---

## 0. Before you start (what you'll need)

Before launch, create the required store accounts, live services, and production secrets under the operating legal entity.

| Thing | You'll need to |
|-------|-----------------|
| **Legal entity** | Form an LLC (or equivalent) if you want to publish as an organization rather than an individual — see the trade-off in §1 |
| **Google Cloud OAuth** (sign-in) | Create your own OAuth clients (Web + Android + iOS) — see [00-Developer_Setup.md](./00-Developer_Setup.md) §4 |
| **Firebase / FCM (Android push)** | Create your own Firebase project, download `google-services.json` — see [00-Developer_Setup.md](./00-Developer_Setup.md) §8b |
| **EAS project** | Run `eas init` under your own Expo account — see [README.md](../README.md) EAS setup |
| **Stripe** | Create your own Stripe account, start in test mode, go live before launch |
| **AdMob** | Create your own AdMob account and ad units — see [00-Developer_Setup.md](./00-Developer_Setup.md) §7 |
| **Resend (or another email provider)** | Verify your own sending domain for transactional email |
| **Support email** | Set up `support@yourdomain.com` (or similar) and point `SUPPORT_EMAIL` at it |
| **Website + legal pages** | Publish `website/` to your own domain after filling in [ENTITY.md](./legal/ENTITY.md) |
| **Deep-link files** | Fill in your real package name, SHA-256 fingerprint, and Apple Team ID in `website/.well-known/*` (currently placeholders) |
| **Google Play Console account** | Not created — Part A |
| **Apple Developer Program membership** | Not enrolled — Part B |
| **D-U-N-S number** | Needed by **both** stores if you publish as an organization — Part A.1 |
| **Staff/admin email notifications** | Code ships in this repo — configure secrets + deploy, Part E |
| **Waitlist sign-up notifications** | Code ships in this repo — configure secrets + deploy, Part F |

**Bottom line:** if you're publishing as an organization, the two things that gate everything else are the **D-U-N-S number** and the two **developer memberships**. Start those first — they have multi-day/multi-week lead times.

---

## 1. The one blocker that gates everything (if publishing as an org): D-U-N-S number

If you publish under a business entity (an organization, not an individual), **both** Google and Apple require a **D-U-N-S® Number** to verify the legal entity.

| | Detail |
|---|---|
| **What** | Free 9-digit business identifier from **Dun & Bradstreet** |
| **Cost** | **Free** in most jurisdictions (do **not** pay a third party to "expedite") |
| **Lead time** | Up to **~5 business days** (D&B) + **~2 business days** for the store to sync. Google warns it can take **up to 30 days** if D&B has to create a new record. |
| **Requirement** | Business must be a real legal entity (an LLC or similar qualifies). DBAs/trade names are **not** accepted by Apple. |

**Action:**
1. Look up whether your company already has a D-U-N-S number (many registered businesses do): Apple's "Look up your D-U-N-S Number" tool → <https://developer.apple.com/enroll/duns-lookup/>.
2. If none, request one free from Dun & Bradstreet. Use the **exact** legal name + registered address on file with your state/country.
3. Wait for the number **before** starting either enrollment below (Apple's org enrollment literally asks for it up front).

> **Faster alternative (decision required):** You *can* enroll **Apple as an Individual** and Google as a **Personal** account to skip D-U-N-S and launch sooner — but apps then list **your personal name** as the seller (not your company name), and Google **Personal** accounts created after 2023-11-13 must complete a **12-tester / 14-day closed test** before production. **Recommendation: use Organization accounts** for brand + liability separation if you have a formed entity, and start the D-U-N-S request today. See §A.2 for the trade-off table.

---

## Part A — Google Play Console

### A.1 What it is / cost

| | Detail |
|---|---|
| **Console** | <https://play.google.com/console> |
| **Fee** | **$25 one-time** (lifetime, not annual) |
| **Account type** | **Organization** (your company) or **Personal** (your own name) |
| **Requires (Organization)** | D-U-N-S number, org legal name + address, a **developer email** + **phone** (shown on your store listing), payment profile |
| **Verification** | Google verifies identity via one-time codes to the email + phone; org verification can take a few days |

### A.2 Account type decision (Personal vs Organization)

| | Personal | **Organization** |
|---|---|---|
| Seller name on Play | your name | your company name |
| D-U-N-S required | No | **Yes** |
| 12-tester / 14-day closed test **required before production** | **Yes** (accounts after 2023-11-13) | **No** (org accounts are exempt) |
| Liability separation | Weak | Strong |

If you have a formed business entity and D-U-N-S is free, **Organization** is usually the right call — it also skips Google's mandatory pre-production closed-test gate. Either way, running a closed beta by choice (Part D) is still smart practice to seed + smoke-test before a public launch.

### A.3 What you'll need to set up (Android)

| Step | Detail |
|------|--------|
| **EAS project + package name** | Run `eas init`; choose your own package name (e.g. `com.yourcompany.yourapp`) — replace the placeholder in `app.config.ts` |
| **Play Console account** | This part |
| **Android OAuth client** | Debug SHA-1 for dev, then a **second** production client with your release-key SHA-1/SHA-256 → update `website/.well-known/assetlinks.json` |
| **FCM v1 credentials** | Create a Firebase project, upload the service account to EAS (see [00-Developer_Setup.md](./00-Developer_Setup.md) §8b) |
| **Signed AAB** | `eas build -p android --profile production` |
| **AdMob apps** | Register your own apps in AdMob; replace the test IDs in `app.config.ts` |
| **"App contains ads" declaration** | At submission |
| **Legal + privacy URLs** | Publish `website/` to your domain first |
| **Data safety form + content rating** | See doc 18 §6 |
| **App icon / splash** | Replace the placeholder art generated for this template (see [07-UI_UX_Design_System.md](./07-UI_UX_Design_System.md) and [00-Developer_Setup.md](./00-Developer_Setup.md)) |
| **Store listing assets** | Feature graphic 1024×500, phone screenshots (doc 18 §1) — the placeholder versions in `assets/store/` are not real screenshots; capture your own after rebranding |

### A.4 Setup steps (do in order)

1. Sign in at <https://play.google.com/console> with the **Google account** you want to own the listing (same one used for Google Cloud OAuth).
2. Choose **Organization** or **Personal** → enter your legal name/address, **D-U-N-S** (org only), `support@` email + phone.
3. Pay the **$25** one-time fee; complete identity verification (respond to the emailed/SMS codes).
4. **Create app** → name it, default language, "App", "Free".
5. Complete **App content**: privacy policy URL (`https://yourdomain.com/privacy`), ads declaration, data safety, content rating (**target 17+/Mature** for UGC marketplace — see doc 18 §2), target audience, news/COVID = no.
6. Set up **App signing** (let Google manage the app signing key; you keep the upload key from EAS).
7. Build + upload the AAB to the **Closed testing** track first (Part D).
8. After closed testing + fixes → **Production** submission.

---

## Part B — Apple Developer Program

### B.1 What it is / cost

| | Detail |
|---|---|
| **Enroll** | <https://developer.apple.com/enroll> |
| **Fee** | **$99 / year** |
| **Account type** | **Organization** (lists apps under your company name) or **Individual** |
| **Requires (Organization)** | D-U-N-S number, legal entity name, **legal binding authority** (you can bind the company to contracts), work email, website |
| **Timeline** | **~2–4 weeks** total (mostly D-U-N-S + Apple verification); a human may call to confirm |
| **Consoles** | Developer portal + **App Store Connect** (<https://appstoreconnect.apple.com>) |

### B.2 What you'll need to set up (iOS)

| Step | Detail |
|------|--------|
| **iOS OAuth client + bundle ID** | Register your own bundle ID (e.g. `com.yourcompany.yourapp`) in Apple Developer and replace the placeholder in `app.config.ts` |
| **Apple Developer Program membership** | This part |
| **Apple Team ID** | Replace `TEAMID` in `website/.well-known/apple-app-site-association` |
| **APNs (push)** | EAS auto-manages once enrolled — run `eas credentials -p ios` |
| **iOS reversed-client-id URL scheme** | Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`; `app.config.ts` derives the scheme automatically |
| **Payments decision** | Boosts/premium are digital goods → **IAP required on iOS**, OR disable paid seller tools on iOS v1. Decide before submission (doc 18 §5). |
| **App Store screenshots**, privacy nutrition labels, age rating 17+, review notes | Capture your own after rebranding — the placeholder assets in this repo are not real screenshots |

### B.3 Setup steps (do in order)

1. Go to <https://developer.apple.com/enroll> → sign in with the Apple ID you want to own the account (create one on your business email if needed; enable 2FA).
2. Choose **Organization** or **Individual** → enter your legal name, **D-U-N-S** (org only), website `https://yourdomain.com`, work email, confirm **legal binding authority** (org only).
3. Submit; wait for Apple verification (they may email/call). Pay **$99** once approved.
4. In **App Store Connect** → **My Apps → +** → create your app, bundle ID matching `app.config.ts`, SKU, primary language.
5. Fill **App Privacy** (nutrition labels), **Age Rating** (17+ UGC), **App Review Information** with the UGC + payments **review-notes template** from [doc 18 §5](./18-App_Store_Release_Checklist.md).
6. Copy your **Team ID** (Membership page) → update the AASA file + redeploy your website; run `eas credentials -p ios` so APNs push is provisioned.
7. Build with `eas build -p ios --profile production` → upload → **TestFlight** (Part D) → App Review.

---

## Part C — Combined gap analysis (what's missing to deploy)

Ordered by lead time (start top-down):

| # | Gap | Owner | Blocks | Lead time |
|---|-----|-------|--------|-----------|
| G-1 | **D-U-N-S number** for your company (if publishing as an org) | You | both accounts | up to ~30d |
| G-2 | **Apple Developer Program** enrollment ($99/yr) | You | iOS everything | 2–4 wk |
| G-3 | **Google Play Console** account ($25) | You | Android everything | days |
| G-4 | **Apple Team ID** → fix AASA + iOS URL scheme + APNs | You + agent | iOS deep links, iOS push | mins after G-2 |
| G-5 | **Play production SHA-1/256** → 2nd OAuth client + `assetlinks.json` | You + agent | Android OAuth on prod build | mins after first prod build |
| G-6 | **Production EAS builds** (AAB + IPA) | You | store upload | ~1h/build |
| G-7 | **Store listing assets** (screenshots, feature graphic) | You | listing review | 1–2h |
| G-8 | **Data safety / privacy labels / content rating** | You | review | 1h (doc 18) |
| G-9 | **iOS payments decision** (IAP vs disable) | You | iOS review | decision |
| G-10 | **Configure staff/admin email notifications** (already coded — Part E) | You | ops readiness | Part E |
| G-11 | **Configure waitlist sign-up notifications** (already coded — Part F) | You | growth ops | Part F |

---

## Part D — Closed beta (founding members / invited testers)

Goal you stated: a **private beta** where only **founding members** and people **you allow** can get in — to seed listings and test. Three layers work together:

### D.1 Store-level closed testing

**Google Play — Closed testing track**
- Play Console → **Testing → Closed testing** → create a track → add testers by **email list** (or a Google Group you control).
- Upload the AAB; share the **opt-in URL** with your founding members.
- Only listed emails can install from Play. You can add/remove testers anytime.
- (Org account = no forced 12-tester/14-day gate, but running ≥12 testers for 14 days is still smart practice.)

**Apple — TestFlight**
- App Store Connect → **TestFlight**.
- **Internal testers:** up to **100** (must be App Store Connect users on your team) — **no Beta App Review**, instant.
- **External testers:** up to **10,000** via email invite or a **public TestFlight link** — requires a one-time **Beta App Review** (light).
- **Builds expire after 90 days** — plan re-builds during a long beta.
- **Recommendation:** invite founding members as **external testers** with a **public link** you paste into your invite email; keep it private by only sharing the link with allowed people.

### D.2 In-app founding allowlist (already built — reuse it)

You already have the mechanics to gate/seed founding members **inside the app**, independent of the store:

- **Waitlist → founding codes:** `waitlist_signups` + `register_waitlist_signup()` issue a **founding code** (migrations `082`/`084`, live on the site).
- **Founding Seller status:** promo type `founding_seller` → profile badge + 10 free boosts/month, redeemed via `apply_promo_redemption()` (migration `080`).
- **Admin promo codes:** `/admin/promo-codes` to mint invite/founding codes for "other members I allow in."
- **Referrals:** `106_waitlist_referrals.sql` for founding-member invite chains.

So the closed-beta flow is:
1. Person joins waitlist (or you add them) → gets a **founding code**.
2. You add their email to the **Play closed track** / **TestFlight**.
3. They install the beta build, sign in with Google, **redeem the founding code** → Founding Seller badge + free boosts to seed listings.

### D.3 Optional: gate the whole app to invitees

If you want the app to **reject** non-invited users during beta (belt-and-suspenders on top of store allowlists), that's a small feature: check `is_founding_seller` OR a redeemed invite code at the post-sign-in gate and show a "You're on the waitlist" screen otherwise. **This is not built yet** — flag it if you want it; store-level closed tracks already keep the public out, so this is usually unnecessary for MVP.

---

## Part E — Staff / admin email notifications  *(build task `NS-1` — ✅ IMPLEMENTED 2026-07-01)*

> **Status:** Built. Immediate events are wired via `notifyStaff()`; high-volume signals roll into a once-daily digest. **Decisions applied:** staff channel = **id + display name only** (no user email/phone); **immediate** for high-signal events, **daily digest** for new users/listings.
>
> **What's wired now**
> | Event | Source function | Channels |
> |-------|-----------------|----------|
> | `new_report` | `submit-report` | admin (full) + staff (redacted) |
> | `user_banned` | `admin-action` (`ban_user`) | admin + staff |
> | `listing_removed` | `admin-action` (`delete_listing`) | admin + staff |
> | `account_deleted` | `delete-account` | admin |
> | `daily_digest` (new users/listings/waitlist + open-report backlog) | `staff-notify-digest` (cron) | admin |
>
> **Human steps to activate:**
> 1. Ensure Supabase secrets set: `RESEND_API_KEY`, `BULK_EMAIL_FROM`, `SUPPORT_EMAIL` (defaults to `support@`), `CRON_SECRET` (for the digest).
> 2. Deploy: `npx supabase functions deploy submit-report admin-action delete-account staff-notify-digest`
> 3. Schedule the digest: uncomment the staff-digest cron job in [supabase/scripts/cron-schedule.sql](../supabase/scripts/cron-schedule.sql) (pg_net + CRON_SECRET).
>
> The spec below documents the original design; the code follows it (with the `daily_digest` addition for high-volume events).

**Your requirement:** when an **action happens on the app**, email the team with details.
- **Admin** notifications → **`support@yourdomain.com`**.
- **Manager/staff** notifications → the **email each staff member signed up with** (their `profiles.email`).

### E.1 What already exists (reuse, don't rebuild)

- **In-app notifications:** `notifications` table + `create_notification()` + Expo **push** trigger (migrations `037`, `094`). This is *user-facing* and stays as-is.
- **Email sending:** `supabase/functions/_shared/bulk-email.ts` → `sendBulkEmails(recipients, subject, bodyText)` via **Resend** (already configured, `BULK_EMAIL_FROM` set).
- **Roles:** `profiles.role` ∈ `admin` | `manager` | (user). Helpers in [src/lib/admin-access.ts](../src/lib/admin-access.ts).

**Gap:** none of the existing notification paths email **staff** about **platform events**. `NS-1` adds that.

### E.2 Design

Add a thin **staff-notify** layer that fans an event out to email:

```
event happens ──▶ notifyStaff(event, payload)
                        │
     ┌──────────────────┼─────────────────────┐
     ▼                                          ▼
 ADMIN channel                            STAFF channel
 → SUPPORT_EMAIL (support@yourdomain.com) → each profiles.email where role IN ('admin','manager')
                                            (respecting a per-role event filter)
```

**Two implementation paths — pick based on where the event originates:**

| Event source | Mechanism |
|--------------|-----------|
| Already in an **edge function** (waitlist, report, admin action) | Call a shared `notifyStaff()` helper inline (simplest). |
| Only in the **DB** (e.g. `auth.users` insert, new listing) | `AFTER INSERT` trigger → `pg_net` POST to a new **`staff-notify`** edge function (mirror the push pattern in migration `094`). |

### E.3 Proposed pieces

**1. New shared module `supabase/functions/_shared/staff-notify.ts`**

```ts
// pseudocode — full impl in the build session
import { sendBulkEmails } from './bulk-email.ts';
import { createSupabaseAdmin } from './supabaseAdmin.ts';

type StaffEvent =
  | 'waitlist_signup' | 'new_user' | 'new_report'
  | 'listing_removed' | 'user_banned'
  | 'account_deleted';

// which channel(s) each event routes to
const ROUTES: Record<StaffEvent, ('admin' | 'staff')[]> = {
  waitlist_signup:     ['admin'],
  new_report:          ['admin', 'staff'],   // managers moderate
  user_banned:         ['admin', 'staff'],
  listing_removed:     ['admin', 'staff'],
  new_user:            ['admin'],
  account_deleted:     ['admin'],
};

export async function notifyStaff(event: StaffEvent, subject: string, body: string) {
  const routes = ROUTES[event] ?? ['admin'];
  const recipients = new Set<string>();
  if (routes.includes('admin')) {
    recipients.add(Deno.env.get('SUPPORT_EMAIL') ?? 'support@yourdomain.com');
  }
  if (routes.includes('staff')) {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'manager'])
      .not('email', 'is', null);
    for (const r of data ?? []) if (r.email) recipients.add(r.email);
  }
  if (recipients.size === 0) return;
  await sendBulkEmails([...recipients], subject, body);   // Resend
}
```

**2. New edge function `supabase/functions/staff-notify/index.ts`** (for DB-triggered events)
- `verify_jwt = false` in `config.toml`, protected by an internal secret header (`STAFF_NOTIFY_SECRET`, checked like `CRON_SECRET`).
- Body `{ event, subject, body, secret }` → calls `notifyStaff()`.

**3. Wire the inline calls** into existing functions:
- `join-waitlist` / `join-ios-waitlist` → `waitlist_signup` (this is also `NS-2`, Part F).
- `submit-report` → `new_report`.
- `admin-action` → `user_banned`, `listing_removed`.
- `delete-account` → `account_deleted`.
- `new_user`: DB trigger on `auth.users`/`profiles` insert → `pg_net` → `staff-notify`.

**4. Config / secrets** (add to `.env.example` + Supabase Edge secrets + doc 00):
```
SUPPORT_EMAIL=support@yourdomain.com
STAFF_NOTIFY_SECRET=<random>            # protects the staff-notify edge fn
# Optional throttles to avoid inbox floods:
STAFF_NOTIFY_MIN_INTERVAL_MS=0
```

### E.4 Email content (per event)

Each email includes: **event type**, **timestamp (UTC + local)**, **actor** (user id / display name / email where allowed), **target** (listing id/title, reported user, etc.), and a **deep link** to the relevant `/admin/*` screen. Keep bodies plain-text (Resend `text`) for MVP; HTML later.

> ⚠️ **Privacy guardrail:** managers must **not** receive user PII they can't already see. Migrations `101`/`102` redact staff emails. **Rule for `NS-1`:** the **admin channel** (support@) may include user email; the **staff channel** should include **user id + display name only**, not email, unless the manager already has access. Confirm before implementing.

### E.5 Rate-limiting / noise control

High-volume events (e.g. every new listing) would flood inboxes. **Recommendation:**
- Per-event **immediate** email for low-frequency, high-signal events: `new_report`, `user_banned`, `account_deleted`, `waitlist_signup`.
- **Digest** (daily summary) for high-frequency events like `new_user` / `new_listing` — a scheduled cron that batches counts. Decide per event in the build session.

---

## Part F — Waitlist sign-up notifications  *(build task `NS-2` — ✅ IMPLEMENTED 2026-07-01)*

> **Status:** Built. `_shared/staff-notify.ts` + wiring in `join-waitlist` and `join-ios-waitlist` land the admin-channel email on each **new** signup. **Remaining human step:** set Supabase secret `SUPPORT_EMAIL` (optional — defaults to `support@yourdomain.com`) and redeploy: `npx supabase functions deploy join-waitlist join-ios-waitlist`.

**Your requirement:** email the team when someone joins the waiting list → to **`support@`** (admin channel).

This is the first, simplest slice of `NS-1`. Minimal change:

1. In `supabase/functions/join-waitlist/index.ts`, **after** `register_waitlist_signup` succeeds (before returning), call:
   ```ts
   await notifyStaff(
     'waitlist_signup',
     `New waitlist signup — ${zip}`,
     `Email: ${email}\nZIP: ${zip}\nRole: ${role}\nPlatform: ${platform}\nSource: ${source}\nRef: ${ref ?? '—'}\nJoined: ${new Date().toISOString()}`
   );
   ```
2. Same in `supabase/functions/join-ios-waitlist/index.ts`.
3. `notifyStaff('waitlist_signup', …)` routes to **admin channel = `SUPPORT_EMAIL`** per §E.3.
4. **Don't block the user** on email failure — wrap in `try/catch` and `console.error`; the signup response must still return the founding code even if Resend hiccups.
5. Deploy: `npx supabase functions deploy join-waitlist join-ios-waitlist staff-notify`.

**Nice-to-have:** include the running total (`SELECT count(*) FROM waitlist_signups`) in the email so you see momentum ("#47 today / 312 total").

---

## Part G — Ordered next-steps checklist

Do these roughly top-to-bottom; items in the same group can overlap.

### Now (unblocks the long-lead items)
- [ ] **G-1** Look up / request **D-U-N-S** for your company (if publishing as an org)
- [ ] **G-2** Start **Apple Developer Program** enrollment (needs D-U-N-S if org)
- [ ] **G-3** Create **Google Play Console** account ($25, needs D-U-N-S if org)
- [ ] Decide iOS payments approach (IAP vs disable paid tools on iOS v1)

### While waiting for approvals (agent can do most)
- [ ] **NS-2** Waitlist sign-up emails (Part F) — smallest, ship first
- [ ] **NS-1** Full staff/admin email notifications (Part E)
- [ ] Prepare **store assets**: icon (have), feature graphic 1024×500, screenshots (doc 18 §1)
- [ ] Draft **Data safety** (Play) + **Privacy nutrition labels** (Apple) from doc 18 §5–6
- [ ] Draft **review-notes** (UGC + payments) from doc 18 §5

### After accounts approved
- [ ] **G-4** Add **Apple Team ID** → fix AASA, iOS URL scheme, `eas credentials -p ios` (unblocks iOS push)
- [ ] Build production: `eas build -p android --profile production` and `-p ios`
- [ ] **G-5** Add **Play prod SHA-1/256** → 2nd Android OAuth client + `assetlinks.json`; redeploy website
- [ ] Upload AAB → **Play Closed testing**; upload IPA → **TestFlight** (Part D)
- [ ] Invite founding members (email lists) + share TestFlight public link
- [ ] Run beta ≥ 1–2 weeks; seed listings via founding codes; fix issues
- [ ] Promote **Play internal/closed → production**; **TestFlight → App Review**
- [ ] Follow [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md) §10 launch-day checklist

### After launch
- [ ] Switch to monthly cadence in [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md)

---

## Revision history

| Date | Version | Change |
|------|---------|--------|
| 2026-07-01 | 1.0 | Initial: Play + Apple org account setup, D-U-N-S, gap analysis, closed-beta strategy, staff/admin + waitlist email-notification specs (`NS-1`, `NS-2`) |
