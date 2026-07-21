# VTuber Marketplace Privacy Policy

> **Pre-production draft.** Recommend licensed attorney review before major scaling. Not legal advice.

**Last updated:** [LAST UPDATED DATE — see docs/legal/ENTITY.md]  
**Effective date:** [EFFECTIVE DATE — see docs/legal/ENTITY.md]

---

## 1. Introduction

VTuber Marketplace ("**we**," "**us**") explains here how we collect, use, disclose, and protect information when you use the VTuber Marketplace mobile app, website, and related services ("**Service**") — a global marketplace for pre-made digital VTuber assets.

**Operator:** [YOUR COMPANY LLC]  
**Privacy contact:** support@yourdomain.com

This Privacy Policy is incorporated into our [Terms of Service](./TERMS_OF_SERVICE.md). By using the Service, you acknowledge this Policy.

We may update this Policy. We will revise the "Last updated" date and, for material changes, provide notice in the app or by email where appropriate.

---

## 2. Information we collect

We group data into the categories below (similar to how major marketplaces disclose data for app stores and state privacy laws).

### 2.1 Identifiers and account data

| Data | Examples | Source |
|------|----------|--------|
| Account identifiers | User ID, Google/Apple subject ID | Google, Apple, or email sign-in |
| Profile | Display name, username, avatar URL, email | Google/Apple sync, or entered at sign-up |
| Phone (sellers only) | Phone number, verification timestamp | You (SMS OTP), required to unlock seller payouts |
| Terms acceptance | Version id, acceptance timestamp | In-app acceptance flow |

### 2.2 Seller verification and payouts

| Data | Purpose |
|------|---------|
| Stripe Connect Express account status | `charges_enabled`, `payouts_enabled` flags used to gate publishing and payouts |
| Stripe identity/KYC data | Collected directly by **Stripe** during Connect onboarding (identity documents, date of birth, tax ID, bank/payout details) — we receive account status and identifiers from Stripe, not the underlying documents |
| Seller phone verification | Phone number and verification timestamp, required before a seller can publish listings or receive payouts |

We do **not** collect or store home addresses, ZIP codes, or precise location for discovery — this is a global catalog, not a location-based feed.

### 2.3 Listing and commerce content

| Data | Purpose |
|------|---------|
| Listing title, description, price, photos, demo video URL, category, asset/software compatibility tags | Marketplace catalog |
| License type (OTU/P2U) and seller-authored license text | Licensing disclosure to buyers |
| Listing status, publish/pause history, mature-content (`is_mature`) flag | Lifecycle and moderation |

### 2.4 Orders and licensing records

| Data | Purpose |
|------|---------|
| Order records — what was purchased, price, commission tier applied | Transaction history, support, tax records |
| License acceptance record (`license_snapshot`) | Immutable record of the exact license text a buyer accepted at checkout |
| Payment metadata via **Stripe** | Charge/payout status, application-fee amount — **we do not store full payment card numbers**; Stripe stores those |
| Link-health-check records | URLs checked, pass/fail history, and buyer-reported link issues, used to enforce the seller strike system |
| Model-support subscription & quote billing records | Recurring support plan status, work-quote amounts, Stripe subscription/payment IDs |
| Profile bulletin posts and comments | Public profile updates and discussion |
| Seller portfolio URL, website, social links, showcase images | Public seller profile |

### 2.5 Communications

| Data | Purpose |
|------|---------|
| Direct messages between buyers and sellers | Contact, safety, abuse prevention |
| Reports, blocks, moderation notes | Trust and safety |
| Support emails | Customer support |

### 2.6 Device and usage data

| Data | Purpose |
|------|---------|
| Device type, OS, app version | Diagnostics |
| IP address (server logs) | Security, fraud prevention |
| Product analytics events | Improve the Service (e.g., PostHog) |
| Push notification token | Optional alerts (e.g., order updates, messages) |
| Advertising ID (if ads enabled) | Ad serving per applicable ad-network policies |

### 2.7 Information from third parties

| Provider | Data received |
|----------|----------------|
| **Google / Apple** | Sign-in profile (name, email, photo) |
| **Stripe** | Connect onboarding/KYC status, payment and payout status |
| **YouTube Data API** | Metadata used to validate each listing's required demo video (embeddable/made-for-kids checks) |
| **Email provider** (e.g., Resend) | Delivery status for transactional emails (verification, order receipts) |

---

## 3. How we use information

We use information to:

- Provide and improve the Service (catalog, listings, messages, search, checkout)
- Authenticate users, verify sellers, and prevent fraud
- Process orders, platform commission, and Pro Seller subscription payments via Stripe
- Enforce [Community Guidelines](./COMMUNITY_GUIDELINES.md) and respond to reports
- Monitor seller download-link health and enforce the strike system
- Send **transactional** SMS (seller phone verification) and service notifications
- Comply with law and protect rights, safety, and property
- Analyze aggregated usage to improve product decisions

We do **not** sell your personal information. We do **not** track your physical location — this is a global digital-asset catalog with no location-based discovery.

---

## 4. How we share information

| Recipient | Why |
|-----------|-----|
| **Supabase** | Database, auth, storage, edge functions |
| **Stripe** | Payment processing and Stripe Connect seller onboarding/payouts |
| **Google / Apple** | Sign-in; ad networks when ads are enabled |
| **YouTube Data API** | Demo-video validation for listings |
| **Analytics provider** (e.g., PostHog) | Product metrics |
| **Email provider** | Transactional emails (verification, order receipts) |
| **Law enforcement / regulators** | Valid legal process or to protect safety |
| **Business transfers** | Merger, acquisition, or asset sale (with notice where required) |

We may share **public profile and listing content** with other users as part of the Service (for example, seller name and license text on a listing).

---

## 5. Your choices and privacy rights

Depending on where you live (including California, Colorado, Virginia, and other U.S. states with privacy laws), you may have the right to:

- **Access** personal information we hold about you
- **Correct** inaccurate information
- **Delete** your account and associated data
- **Opt out** of certain processing (where applicable)
- **Appeal** a denial of a privacy request (where applicable)

**How to exercise rights:** email support@yourdomain.com or use in-app **Delete account** in Settings. We will verify your request and respond within timelines required by law (for example, 45 days under CCPA). See [How to delete your account](https://yourdomain.com/delete-account) for step-by-step instructions, including how to request deletion without the app.

**Account deletion** cancels subscriptions where possible, removes your profile, and triggers deletion of listings and content per our retention schedule. Completed order and payment records may be retained per [§6](#6-retention) for tax, fraud, and legal-compliance purposes even after account deletion.

We do not discriminate against you for exercising privacy rights.

### 5.1 State-specific notices

Some U.S. states require additional disclosures. If required by law, we will publish supplements at **https://yourdomain.com/privacy/states**.

---

## 6. Retention

| Data type | Typical retention |
|-----------|-------------------|
| Active listings | Until unpublished by the seller, sold under an OTU license, or auto-paused by the strike/link-health system — there is no fixed listing expiry |
| Removed/unpublished listings | Deleted per our standard content-deletion schedule, including images |
| Account profile | Until you delete your account |
| Direct messages | While accounts are active, plus up to **90 days** after account deletion for safety and abuse investigations |
| Moderation logs | ~1–2 years for safety and legal defense |
| Seller phone verification metadata | While the seller account is active |
| Stripe Connect KYC/account status | While the seller account is active, and as required by Stripe/financial regulation thereafter |
| Order, license-acceptance, and payment metadata | As required for tax and fraud prevention (often ~7 years) |
| Link-health-check records | Rolling window sufficient to evaluate the 12-month strike policy, plus a reasonable audit period |
| Terms acceptance record | While account exists + legal hold period |

We may retain information longer when required by law or to resolve disputes.

---

## 7. Security

We use technical and organizational measures including encryption in transit, access controls, and database row-level security. No system is 100% secure. Protect your account credentials, and enable two-factor authentication where available.

---

## 8. Children's privacy

The Service is **not directed to children under 18**. We do not knowingly collect personal information from anyone under 18. Contact support@yourdomain.com to request deletion if you believe a child provided data.

---

## 9. International users

VTuber Marketplace is a **global marketplace** operated from the **United States**. If you access the Service from elsewhere, your information may be processed in the U.S. where privacy laws may differ from your country.

---

## 10. Cookies and similar technologies

The mobile app does not use browser cookies. Our website (if any) and analytics providers may use cookies or similar technologies — disclosed on our website when published.

---

## 11. Changes to this Policy

We will post updates with a new "Last updated" date. Material changes may be notified in-app or by email. Continued use after notice means you accept the updated Policy where permitted by law.

---

## 12. Contact

**Privacy:** support@yourdomain.com  
**Support:** support@yourdomain.com
