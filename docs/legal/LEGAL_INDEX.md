# VTuber Marketplace legal document index

> **Pre-production draft.** Recommend licensed attorney review before major scaling. Entity details: [ENTITY.md](./ENTITY.md).

This folder defines how VTuber Marketplace legal policies fit together. The structure is inspired by common marketplace practice (master terms + supplemental policies, separate seller/buyer terms, a standalone DMCA policy) but written specifically for VTuber Marketplace's **marketplace-facilitator** model for pre-made digital VTuber assets.

---

## Document hierarchy

When you use VTuber Marketplace, these documents work as a **stack**:

| Layer | Document | Role |
|-------|----------|------|
| **1 — Master agreement** | [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | Binding contract: facilitator role, accounts, licensing model, digital delivery, payments, disclaimers, liability, arbitration |
| **2 — Seller terms** | [SELLER_AGREEMENT.md](./SELLER_AGREEMENT.md) | Additional terms for sellers: onboarding, representations, licensing responsibility, link-health strikes, payouts |
| **3 — Buyer terms** | [BUYER_PURCHASE_TERMS.md](./BUYER_PURCHASE_TERMS.md) | Additional terms for buyers: what a purchase grants, license acceptance, refunds, reviews |
| **4 — Copyright** | [DMCA_COPYRIGHT_POLICY.md](./DMCA_COPYRIGHT_POLICY.md) | DMCA takedown/counter-notice process and repeat-infringer policy |
| **5 — Privacy** | [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) | How we collect, use, retain, and share data |
| **6 — Community rules** | [COMMUNITY_GUIDELINES.md](./COMMUNITY_GUIDELINES.md) | What you may post and how you must behave (incorporated into Terms) |

---

## Why a facilitator model needs this structure

VTuber Marketplace is a **marketplace-facilitator model, not a merchant/retailer**: we are not the seller, not a party to the OTU/P2U license, and not a merchant of record for the underlying asset. That means the Terms of Service alone can't carry every seller- or buyer-specific obligation — so licensing and enforcement responsibilities are split out:

| Concern | Where it lives |
|---------|-----------------|
| Facilitator role, disclaimers, liability cap, arbitration | **Terms of Service** |
| Stripe Connect onboarding, seller representations (rights owned, not AI-generated, link works), link-health strikes | **Seller Agreement** |
| What a purchase actually grants, no-refund policy and its exceptions, review eligibility | **Buyer Purchase Terms** |
| Copyright takedown notices and repeat-infringer enforcement | **DMCA / Copyright Policy** |
| Data collected during Stripe KYC, order records, link-health-check records | **Privacy Policy** |
| Listing standards, AI-content ban, mature-content tagging, enforcement ladder | **Community Guidelines** |

VTuber Marketplace intentionally does **not** offer local/geo discovery, in-person meetups, or platform-hosted file storage — so we do not need meetup-safety guidance or file-hosting/escrow terms.

---

## In-app acceptance

New users must accept the current legal bundle in-app (`accept_platform_terms` RPC). Version id: `CURRENT_TERMS_VERSION` in `src/constants/legal.ts`. Bump the version when Terms or Privacy change materially.

---

## Publishing checklist

1. Canonical entity values: [ENTITY.md](./ENTITY.md)
2. Publish static site from `website/` (run `npm run generate:legal`) at:
   - `https://yourdomain.com/` — marketing landing + early-access waitlist ([website/README.md](../../website/README.md))
   - `https://yourdomain.com/legal` — legal index hub
   - `https://yourdomain.com/terms`
   - `https://yourdomain.com/privacy`
   - `https://yourdomain.com/community`
   - `https://yourdomain.com/seller-agreement`
   - `https://yourdomain.com/buyer-purchase-terms`
   - `https://yourdomain.com/dmca`
3. Match URLs in `src/constants/legal-urls.ts`.
4. Regenerate in-app bundle: `node scripts/generate-legal-content.mjs`
5. **Before commercial launch:** register the arbitration clause in [TERMS_OF_SERVICE.md §20.2](./TERMS_OF_SERVICE.md#202-agreement-to-arbitrate) with the AAA (operator/business task, not a code task) and have a licensed attorney review every document in this folder.

See [LEGAL_CHANGELOG.md](./LEGAL_CHANGELOG.md) for edit history.
