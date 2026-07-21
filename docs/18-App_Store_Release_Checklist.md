# Local Marketplace — App Store Release Checklist

**Version:** 1.1

---

## 1. Assets required

| Asset | iOS | Android |
|-------|-----|---------|
| App icon 1024×1024 | ✓ | ✓ |
| Adaptive icon | | ✓ |
| Splash screen | ✓ | ✓ |
| Screenshots 6.7" | 3–10 | |
| Screenshots phone | | 3–8 |
| Feature graphic | | 1024×500 |

**Screenshot scenes:** Feed with listings, Detail, Sell flow, Google sign-in, onboarding.

---

## 2. App metadata

| Field | Draft |
|-------|-------|
| Name | Local Marketplace |
| Subtitle | Cheap local pickup deals |
| Category | Shopping |
| Age rating | **17+** recommended for UGC marketplace — complete questionnaire |
| Keywords | local, marketplace, cheap, garage, deals |
| Support URL | https://yourdomain.com/support |
| Privacy URL | https://yourdomain.com/privacy |

---

## 3. Permissions declarations

| Permission | Reason |
|------------|--------|
| Photos | Listing images |
| Location (optional) | Approximate ZIP only — not continuous tracking |
| Notifications | Listing expiry alerts |

---

## 4. Apple Guideline 1.2 — User-Generated Content (map to app)

| Apple requirement | Local Marketplace implementation |
|-------------------|---------------------------|
| Filter objectionable content | `banned_keywords` + Edge validation |
| Report mechanism | Report listing/user flow |
| Block mechanism | Block user |
| **Act on reports promptly** | Set your own SLA (e.g. 24h); log in `moderation_actions` |
| Published contact | support@ URL in app |
| Terms prohibiting abuse | `legal/TERMS` + `COMMUNITY_GUIDELINES` |

---

## 5. Apple Guideline 3.1 — Payments

| Item type | Allowed payment |
|-----------|-----------------|
| Physical items (meetup) | **Outside app** — OK |
| Boost / Premium (digital promotion) | **In-App Purchase** on iOS OR disable paid features on iOS v1 |
| Android boosts/premium | Stripe |

**Review notes template:**

> Local Marketplace is a local classifieds app for physical goods. Users meet offline to exchange items; the app does not process item payments. Optional seller tools (listing promotion) [use IAP on iOS / are not offered on iOS in v1]. UGC moderation: report, block, keyword filter, prompt human review.

---

## 6. Google Play — Data safety

Declare: email, name, photos, approximate location (ZIP), purchase history (boosts/subscription).

---

## 7. AdMob

- [ ] UMP consent (EEA)
- [ ] Test units in dev only
- [ ] No ads until feed has minimum listings (**10-Monetization**)

---

## 8. Pre-submission technical

- [ ] Production bundle IDs
- [ ] No dev keys in production build
- [ ] Google OAuth redirect / universal links work
- [ ] Terms/Privacy links live in app
- [ ] TestFlight 1 week minimum

---

## 9. Launch sequence

1. Android internal → production (Stripe)
2. iOS TestFlight (UGC compliance; see §5 for IAP decision)
3. Seed city listings live before marketing push
