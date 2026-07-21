# Local Marketplace Seller Agreement

> **Pre-production draft.** This document has not been reviewed by a licensed attorney. Recommend licensed attorney review before commercial launch or major scaling. Not legal advice.

**Last updated:** [LAST UPDATED DATE — see docs/legal/ENTITY.md]  
**Effective date:** [EFFECTIVE DATE — see docs/legal/ENTITY.md]

This Seller Agreement is **incorporated into** our [Terms of Service](./TERMS_OF_SERVICE.md) and applies in addition to it whenever you list or sell a digital VTuber asset on Local Marketplace. If you only buy, this document does not apply to you — see the [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md) instead.

---

## 1. Becoming a seller

Before any of your listings can go live, you must complete:

| Requirement | Detail |
|--------------|--------|
| **Stripe Connect Express onboarding** | You must connect a Stripe Express account and reach `charges_enabled: true` and `payouts_enabled: true` |
| **Phone verification** | You must verify a phone number via SMS one-time code |
| **Terms acceptance** | You must accept these Terms, the [Terms of Service](./TERMS_OF_SERVICE.md), and the [Community Guidelines](./COMMUNITY_GUIDELINES.md) |

We may decline, suspend, or revoke your ability to sell at our discretion, including if Stripe restricts, rejects, or closes your connected account.

---

## 2. Seller representations

By listing an asset, you represent and warrant that, for that listing and every file linked from it:

1. **You own it, or you have sufficient rights to sell it.** You either created the asset yourself, or you hold a license, assignment, or other legal right sufficient to list, sell, and transfer or license it on the terms you describe.
2. **It is not AI-generated.** The asset (model, artwork, rig, texture, or accessory) was not generated, in whole or material part, by generative AI tools. See [Community Guidelines](./COMMUNITY_GUIDELINES.md) for the platform's AI-content ban.
3. **It is not stolen or unauthorized use of another artist's work.** You did not copy, trace, rip, or otherwise take another creator's copyrighted work without their authorization.
4. **Your download link is accurate and functional.** The `download_url` you provide actually delivers the asset described in your listing, is not gated behind an unrelated paywall, survey, or unrelated signup, and works for a buyer at the time of purchase.
5. **Your listing is honest.** Your photos, description, license type (OTU/P2U), price, and any customization/setup add-ons accurately describe what a buyer will receive.

A false representation under this section is a material breach of these Terms and may result in listing removal, a strike, order refund liability, and/or account termination, in addition to any indemnification obligation under [Terms of Service §18](./TERMS_OF_SERVICE.md#18-indemnity).

---

## 3. Your license text — you author it, we don't

Local Marketplace does **not** provide a mandatory or recommended license template. You are solely responsible for:

- Writing the OTU or P2U license text that appears on your listing
- Making sure that text accurately reflects what rights you are actually granting
- Enforcing your license against a buyer who exceeds it (for example, reselling a P2U-licensed asset as if it were OTU)

We display whatever license text you write. We do not review it for legal sufficiency, do not warrant it is enforceable, and take **no position** in a dispute between you and a buyer over how your license should be interpreted or enforced. The exact license text shown at checkout is captured verbatim into the order's `license_snapshot` — this is the buyer's permanent record of what they agreed to, and also yours.

---

## 4. Pricing, payments, and payouts

- There is **no platform-mandated price cap**. You set your own price, which must be greater than $0.
- Every sale is processed as a **Stripe Connect Express destination charge**. The buyer pays your listed price plus Stripe's processing fee and any applicable tax.
- The **platform commission** — **10%** of the sale for free-tier sellers, or **8%** for active Pro Seller subscribers — is deducted automatically as a **Stripe application fee** before funds reach your connected account. Both rates are admin-configurable and shown to you before you publish.
- **Payout timing and schedule** are handled by Stripe Connect according to your account's payout settings, not by Local Marketplace directly.
- **Taxes are your responsibility.** If your sales meet the applicable IRS/Stripe reporting threshold, Stripe will issue you a **Form 1099-K**. You are solely responsible for reporting and paying any tax owed on your sales.

---

## 5. Link health and the strike system

You are solely responsible for your download link's **uptime and content** for as long as your listing is live and for any post-sale support window you offer.

**How enforcement works:**

1. **Automated health checks.** Our systems periodically check that your `download_url` resolves and responds successfully.
2. **Buyer reports.** A buyer may report a broken, missing, or corrupted download.
3. **Grace period.** When a link fails an automated check or is reported, you get a reasonable grace period to fix it before a strike is issued.
4. **Strike.** If the link still fails after the grace period — whether caught by an automated check or confirmed via a buyer report — you receive a **strike** and the affected listing may be auto-paused.
5. **Account ban threshold.** **Three (3) non-expired strikes within a rolling 12-month window** result in an **automatic account ban**. Strikes expire from the rolling window over time as described in-app.

This strike system is the mechanism by which we enforce your link-hosting responsibility under [Terms of Service §7](./TERMS_OF_SERVICE.md#7-digital-delivery-seller-hosted-links-only) — we do not, and cannot, fix or host your files for you.

---

## 6. AI-generated content — zero-tolerance enforcement

Unlike most content violations, which follow a warn-first enforcement ladder (see [Community Guidelines](./COMMUNITY_GUIDELINES.md)), **AI-generated content is a zero-tolerance violation.** Once moderation confirms that a listing contains AI-generated content, the consequence is an **immediate account ban** — there is no warning, no restriction stage, and no opportunity to simply remove the listing and continue selling. This applies even to first-time, otherwise-compliant sellers.

---

## 6A. Model-support subscriptions and work quotes

If you enable a **monthly support plan** on an eligible listing (full 2D/3D VTuber models or VRChat-category listings), you represent that the offerings text accurately describes what subscribers receive (support, updates, assets, etc.). You are solely responsible for delivering that ongoing support. Platform commission on subscription renewals and on accepted **support work quotes** uses the same Connect fee tier as one-off sales. Cancelling a plan does not automatically refund past subscription periods. Informal coordination may still happen in DMs; formal paid extra work should use the in-app quote → accept → pay flow.

Pro Seller subscribers may create **seller-scoped promo codes** and **timed sale periods** on their own listings only. Misuse (misleading discounts, bait pricing) may result in suspension of Pro Seller benefits or account action.

---

## 7. Reviews and disputes with buyers

Buyers may only leave a review after a **completed (`fulfilled`) order** for your listing. You may not incentivize, solicit, or manipulate reviews. See [Community Guidelines](./COMMUNITY_GUIDELINES.md) for the full review-integrity policy.

Local Marketplace does not mediate or arbitrate disputes over license interpretation, asset quality, or compatibility between you and a buyer. We may still act on reports that a listing violates these Terms or the Community Guidelines independent of any buyer/seller dispute.

---

## 8. Suspension and termination

We may suspend or terminate your ability to sell, pause any or all of your listings, or terminate your account for:

- A false representation under [§2](#2-seller-representations)
- Reaching the strike threshold in [§5](#5-link-health-and-the-strike-system)
- A confirmed AI-generated-content violation under [§6](#6-ai-generated-content--zero-tolerance-enforcement)
- Any other violation of these Terms, the [Terms of Service](./TERMS_OF_SERVICE.md), or the [Community Guidelines](./COMMUNITY_GUIDELINES.md)
- Stripe restricting, rejecting, or closing your connected account

Termination does not entitle you to a refund of platform fees already collected on completed sales, and open orders are handled per the [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md).

---

## 9. No employment or partnership

Selling on Local Marketplace does **not** create an employment, agency, partnership, or joint-venture relationship between you and Local Marketplace. You are an independent seller responsible for your own business, tax, and legal compliance.

---

## 10. Contact

**Seller support:** support@yourdomain.com

**Related:** [Terms of Service](./TERMS_OF_SERVICE.md) · [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md) · [Community Guidelines](./COMMUNITY_GUIDELINES.md) · [DMCA / Copyright Policy](./DMCA_COPYRIGHT_POLICY.md)
