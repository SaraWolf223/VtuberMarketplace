# Local Marketplace — Legal and Compliance

**Version:** 1.1  
**Disclaimer:** This document is a **product requirements outline**, not legal advice. Have a lawyer review before launch.

---

## 1. Documents to publish before launch

| Document | Location |
|----------|----------|
| Terms of Service | Website + in-app link |
| Privacy Policy | Website + in-app link |
| Community Guidelines | Website + link from safety screen |
| Meetup Safety Tips | In-app (see 12-Moderation) |

**Host:** Simple static site (GitHub Pages, Notion public, or `yourdomain.com`).

### 1.1 In-app legal links & first sign-in

| Screen | Documents |
|--------|-----------|
| Sign-in | Checkbox + Terms + Privacy links |
| Accept terms (first login) | Full bundle + Community Guidelines |
| Settings → Legal | All four public documents |
| Settings → Safety | Safety copy + legal links |
| Premium | Terms + Privacy |

URLs: `src/constants/legal-urls.ts` (publish `docs/legal/` to `yourdomain.com` before launch). New users must accept via RPC `accept_platform_terms` (migration **077**).

---

## 2. Terms of Service — required sections

### 2.1 Platform role

Local Marketplace is a **listing platform only**. It does not:

- Process payments for items between buyers and sellers
- Guarantee transactions
- Verify item authenticity
- Provide shipping or escrow

### 2.2 User eligibility

- Age **18+** (or 13+ with parental consent — **pick one with counsel**; MVP recommend 18+)
- Valid Google account
- Accurate ZIP/location for local discovery

### 2.3 Listing rules

- Physical items only, local pickup
- Prohibited items list incorporated by reference
- Right to remove content at any time

### 2.4 User conduct

- No harassment, spam, scams
- No circumventing bans
- No scraping or automated posting

### 2.5 Payments to Local Marketplace

- Boost and Premium fees processed by Stripe
- Subscriptions auto-renew until canceled
- Refund policy: boosts non-refundable except failure to apply boost; subscriptions per Stripe policy

### 2.6 Liability limitation

- AS-IS service
- Limit liability to fees paid in last 12 months (standard template language)
- Not liable for user conduct, injuries at meetups, item defects

### 2.7 Dispute resolution

- Governing law: **[Your state]**
- Arbitration clause optional — lawyer decision

### 2.8 Termination

- Users may delete account
- Platform may terminate for violations

---

## 3. Privacy Policy — required sections

### 3.1 Data collected

| Data | Purpose |
|------|---------|
| Google account (email, name, avatar) | Auth, profile |
| ZIP / location | Feed radius |
| Listing content + images | Marketplace |
| Device push token | Notifications |
| Payment metadata (Stripe) | Boosts/premium — no card numbers stored on our servers |
| Usage analytics | Product improvement |
| Reports | Safety |

### 3.2 Data sharing

- Supabase (hosting)
- Stripe (payments)
- Google (auth)
- Mapbox (geocoding)
- Google AdMob (ads)
- Law enforcement when legally required

### 3.3 Retention

- Listings purged per **11-Storage** schedule
- Account deletion: remove PII within 30 days (define process)

### 3.4 User rights

- Access/export request email
- Deletion request email
- CCPA/GDPR notes if serving EU/CA users

### 3.5 Children

- Not directed at children under 13 (if using 18+ rule, state clearly)

### 3.6 Contact

- `privacy@yourdomain.com` (placeholder)

---

## 4. Community Guidelines (summary)

1. Physical items only
2. Local meetup only — no shipping requests
3. Honest photos and descriptions
4. Prohibited items banned
5. Be respectful
6. Report problems

---

## 5. App Store compliance

### 5.1 Apple Guideline 1.2 (UGC)

- Content filtering (keywords) ✓
- Report + block ✓
- **Remove reported content within 24 hours** — operational SLA
- Contact information in app ✓
- Custom EULA prohibiting objectionable content ✓

### 5.2 Apple Guideline 3.1 (payments)

- Item sales: offline OK
- Boost/Premium: **IAP on iOS** or disable paid features on iOS v1 (see 10-Monetization_System.md §2)

### 5.3 Liability / UGC

- Terms must state platform is **not party** to offline transactions
- Consider **Section 230**-style UGC disclaimer (US) — attorney draft
- Age **18+** in Terms

### 5.2 Google Play

- Similar UGC policies
- Data safety form
- Target audience declaration

See **18-App_Store_Release_Checklist.md**.

---

## 6. Stripe compliance

- Business verification for live mode
- Clear product descriptions for Boost and Premium
- Webhook signature verification mandatory

---

## 7. Insurance & business entity (non-technical)

- Consider LLC formation
- General liability not required for MVP but assess meetup risk
- Consult local business attorney

---

## 8. DMCA / copyright (lightweight)

- Designate agent email for takedown notices
- Process: remove listing within 48h of valid notice

---

## 9. Pre-launch legal checklist

- [ ] Terms drafted and linked in app
- [ ] Privacy drafted and linked
- [ ] Age gate decision documented
- [ ] Stripe terms of service accepted
- [ ] Mapbox/AdMob ToS accepted
- [ ] Store moderation questionnaire completed
