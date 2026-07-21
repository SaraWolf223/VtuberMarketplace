# Local Marketplace Terms of Service

> **Pre-production draft.** This document has not been reviewed by a licensed attorney. Recommend licensed attorney review before commercial launch or major scaling. Not legal advice.

**Last updated:** [LAST UPDATED DATE — see docs/legal/ENTITY.md]  
**Effective date:** [EFFECTIVE DATE — see docs/legal/ENTITY.md]

---

## 1. Agreement to these Terms

These Terms of Service ("**Terms**") are a binding agreement between you and **[YOUR COMPANY LLC]** ("**Local Marketplace**," "**we**," "**us**," or the "**Platform**") governing your access to and use of the Local Marketplace mobile application, website, and related services (collectively, the "**Service**") — a global marketplace for pre-made digital VTuber assets (2D Live2D models, 3D/VRM/FBX models including VRChat avatars and props, PNGtuber models, accessories, and backgrounds/overlays).

**By creating an account, checking the acceptance box at sign-in, or using the Service, you agree to these Terms and to the documents incorporated by reference:**

| Document | Purpose |
|----------|---------|
| [Privacy Policy](./PRIVACY_POLICY.md) | Data practices |
| [Community Guidelines](./COMMUNITY_GUIDELINES.md) | Content and conduct rules |
| [Seller Agreement](./SELLER_AGREEMENT.md) | Additional terms that apply if you list or sell assets |
| [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md) | Additional terms that apply when you buy an asset |
| [DMCA / Copyright Policy](./DMCA_COPYRIGHT_POLICY.md) | Copyright takedown and counter-notice process |

If you do not agree, do not use the Service.

We may update these Terms. We will post a new "Last updated" date and, when required, notify you in the app. **Continued use after changes means you accept the updated Terms**, unless applicable law requires a different consent process. If you disagree with an update, stop using the Service and delete your account.

---

## 2. What Local Marketplace is (and is not) — our role as a facilitator

Local Marketplace is a **marketplace facilitator**: we operate the technology that lets independent sellers list pre-made digital VTuber assets and lets buyers discover, purchase, and download them. We connect buyers and sellers; we do not create, own, sell, or license the assets ourselves.

**Local Marketplace is not:**

- The seller of any asset listed on the Service, and **not a party to the license** a buyer and seller enter into for that asset
- A **merchant of record** for the underlying digital asset (Stripe, as payment processor, and the seller, as the party granting the license, are the substantive parties to the sale; see [§9](#9-payments-stripe-connect-and-commission))
- A file host, CDN, or backup provider for sold assets — see [§7](#7-digital-delivery-seller-hosted-links-only)
- An author, editor, or guarantor of any listing's OTU/P2U license text — see [§6](#6-listings-and-licensing-otu-vs-p2u)
- An escrow agent, insurer, or guarantor of any transaction's outcome

**Local Marketplace does not:**

- Verify that a seller owns sufficient rights to sell a given asset, beyond the representations sellers make under the [Seller Agreement](./SELLER_AGREEMENT.md) and our moderation review
- Guarantee that any listing, license, or download link is accurate, complete, non-infringing, or will remain available
- Guarantee compatibility of any asset with any particular software, engine, or platform (including VRChat)
- Provide purchase protection, refunds beyond [§10](#10-buyer-purchases-and-refunds), or binding dispute mediation between buyers and sellers

This is a **marketplace-facilitator model, not a merchant/retailer model.** We disclaim liability for the outcome of any buyer/seller transaction to the fullest extent permitted by law — see [§16](#16-disclaimers) and [§17](#17-limitation-of-liability).

---

## 3. Acknowledgment of marketplace risks

**There are inherent risks** in buying and selling digital goods created by independent third parties, including the risk that a listing misrepresents the asset, that a seller's rights in the underlying artwork or model are incomplete or disputed, that a download link becomes unavailable, or that a buyer misuses a license. You assume these risks when you use the Service.

Local Marketplace provides seller verification steps, listing moderation, licensing disclosure, link-health monitoring, reporting tools, and a strike system (see [Seller Agreement §5](./SELLER_AGREEMENT.md)), but **we do not guarantee a safe, accurate, or successful transaction.**

---

## 4. Eligibility

You must be **at least 18 years old** and able to enter a binding contract where you live. By using the Service, you represent that you meet this requirement.

You may not use the Service if you have been permanently banned, if you are violating another agreement with us, or if your use would violate applicable law.

---

## 5. Accounts and security

- **Sign-in:** You may create an account with **Google**, **Apple** (iOS), or **email and password**. Your display name and profile photo may be populated from Google or Apple when available, or collected at sign-up for email accounts.
- **Two-factor authentication:** TOTP-based two-factor authentication is **mandatory** for admin/manager accounts and optional for all other accounts.
- **Accuracy:** Keep your profile information reasonably accurate.
- **Security:** You are responsible for activity on your account. Notify **support@yourdomain.com** if you suspect unauthorized access.
- **One person, one account:** Do not create accounts to evade bans or moderation.
- **Verification is contextual, not universal:** Email verification is required to send direct messages. Phone verification and Stripe Connect identity (KYC) verification are required only for **sellers**, before they can publish listings or receive payouts — see [Seller Agreement §1](./SELLER_AGREEMENT.md).

---

## 6. Listings and licensing: OTU vs. P2U

Every listing on the Service must carry one of two seller-authored license types:

| License | Meaning |
|---------|---------|
| **OTU** (One-Time-Use) | Full rights/copyright transfer to the buyer. The listing automatically delists after it sells. |
| **P2U** (Pay-to-Use) | A non-exclusive usage license. The listing stays live and may be sold to multiple buyers. |

**Sellers write their own license text.** Local Marketplace does not provide a mandatory platform license template, does not warrant that a listing's license text is legally sufficient or enforceable, and does not interpret or arbitrate license terms between a buyer and seller. The exact license text shown on a listing at the moment of purchase is captured verbatim into that order's `license_snapshot` and becomes the buyer's permanent record of what was purchased — see [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md).

Listings have **no fixed expiry.** A listing stays live until the seller unpublishes it, it sells under an OTU license, or it is automatically paused by our strike or link-health system (see [Seller Agreement §5](./SELLER_AGREEMENT.md)).

Every listing requires **at least three (3) photos** and **exactly one validated YouTube demo video** before it can publish. See [Community Guidelines](./COMMUNITY_GUIDELINES.md) for full listing standards, prohibited content, and the mature-content policy.

You retain ownership of your listing content. By posting, you grant Local Marketplace a **non-exclusive, worldwide, royalty-free license** to host, store, reproduce, display, and distribute your listing content (photos, description, embedded video, license text) **only to operate and promote the Service.** This license ends when the content is deleted, except as needed for backups, legal compliance, or moderation records.

We may review, remove, hide, pause, or refuse any listing or account **at any time**, with or without notice, if we believe it violates these Terms, our Guidelines, or applicable law, or if it creates risk for users or the Platform.

---

## 7. Digital delivery: seller-hosted links only

Local Marketplace is a **digital delivery marketplace with no platform-side file storage.** We never store, host, mirror, proxy, or back up the asset files that are bought and sold on the Service. Every listing's `download_url`, and every order's `deliverable_url`, point at hosting the **seller** controls and operates (their own file host, cloud storage, or download service).

**We explicitly do not:**

- Host, cache, or make a copy of any sold asset file
- Guarantee that a seller's download link will remain online, unblocked, or unchanged after purchase
- Act as a backup or recovery service if a seller's link goes offline or a seller deletes the file

Sellers are solely responsible for their download link's uptime and content. A broken link is enforced through the strike system described in the [Seller Agreement](./SELLER_AGREEMENT.md), not through platform-side file recovery.

---

## 8. Messaging and contact

- The Service offers **direct messages** between buyers and sellers related to a specific listing or order — not general social chat.
- **Sending a direct message requires a verified email address.** Phone verification is a separate requirement that applies only to sellers unlocking Stripe Connect payouts (see [§5](#5-accounts-and-security)) — it is **not** required to message.
- Do not harass, spam, or use messages to solicit off-platform payment or file transfer that circumvents the licensing and order record described in these Terms.
- Messages may be stored and reviewed for safety, moderation, and legal compliance.

---

## 9. Payments: Stripe Connect and commission

All real-money payments on the Service are processed through **Stripe Connect Express** as **destination charges**:

- The buyer's payment is charged to the seller's connected Stripe account, with a **platform commission** deducted automatically as a Stripe application fee before the seller is paid.
- The platform commission is **10%** for free-tier sellers and **8%** for active Pro Seller subscribers. Both rates are admin-configurable and shown before checkout.
- The **buyer** is responsible for Stripe's payment-processing fee and any applicable tax, shown at checkout.
- A seller must have `charges_enabled`, `payouts_enabled`, and a verified phone number on file before any listing of theirs can go live — see [Seller Agreement §1](./SELLER_AGREEMENT.md).

Local Marketplace does not custody buyer or seller funds outside of Stripe's processing flow and is not a bank, money transmitter, or escrow agent.

---

## 10. Buyer purchases and refunds

Purchasing a listing grants the buyer exactly the rights described in that listing's OTU or P2U license, as captured in the order's `license_snapshot` at the time of purchase — nothing more and nothing less. Full purchase, refund, and review-eligibility terms are in the [Buyer Purchase Terms](./BUYER_PURCHASE_TERMS.md), which are incorporated into these Terms.

In summary: sales are **final** except for (a) non-delivery, (b) fraud, or (c) an uncorrectable broken/corrupt file the seller cannot fix within a reasonable window.

---

## 11. Content policy summary

Full rules are in the [Community Guidelines](./COMMUNITY_GUIDELINES.md), which are incorporated into these Terms. In summary:

- **Mature content is allowed if age-gated.** Suggestive, non-explicit content may be listed with the `is_mature` flag enabled and is blurred by default.
- **Explicit sexual content is banned outright** — no age-gate exception.
- **AI-generated content is banned outright.** A confirmed violation escalates directly to an **account ban**, skipping the normal warn-first enforcement ladder.
- **Stolen or unauthorized use of another artist's work is banned** and may also be handled as a copyright matter under our [DMCA / Copyright Policy](./DMCA_COPYRIGHT_POLICY.md).

---

## 12. Reports, blocks, and enforcement

| Tool | What it does |
|------|----------------|
| **Report** | Flags a listing, message, or user for review |
| **Block** | Hides a user's listings and prevents new DMs between you |
| **Moderation** | We may pause listings, warn, restrict, or ban accounts |

Enforcement may include content removal, listing pause, warning, temporary restriction, or permanent ban. See [Community Guidelines](./COMMUNITY_GUIDELINES.md) for the enforcement ladder, appeals process, and the AI-generated-content exception (straight to ban, no warning).

Automated signals (for example, a link failing repeated health checks, or many reports in a short period) may auto-pause a listing pending human review.

---

## 13. Third-party services

The Service integrates with third parties, including **Google**, **Apple**, **Supabase**, **Stripe**, and the **YouTube Data API** (used to validate each listing's required demo video). Your use of those services may be subject to their own terms. Local Marketplace is not responsible for third-party outages or acts.

### 13.1 YouTube Terms of Service

Because every listing embeds a YouTube demo video and we call the YouTube Data API to validate it, **your use of the Service is also subject to the [YouTube Terms of Service](https://www.youtube.com/t/terms)**, and you acknowledge and agree to be bound by them. This clause is included as required by the YouTube API Services' Required Minimum Functionality policy. Google's general Privacy Policy, available at [https://policies.google.com/privacy](https://policies.google.com/privacy), also applies to data handled through the YouTube API Services.

### 13.2 Third-party file hosts (seller download links)

Sellers deliver assets through links to third-party file hosts of their own choosing — for example, Google Drive, Dropbox, Mega, itch.io, or a personal web host — as described in [§7](#7-digital-delivery-seller-hosted-links-only). **Local Marketplace is not a party to, and disclaims all responsibility for, those third-party file hosts:** we do not control their uptime, terms, pricing, content-scanning practices, or account policies, and a seller's or buyer's use of any such host is governed solely by that host's own terms of service and privacy policy, not by us.

---

## 14. Intellectual property and copyright

Local Marketplace names, logos, and app design are our property. Do not use our branding without permission.

If you believe content on the Service infringes your copyright, follow the notice-and-takedown process in our [DMCA / Copyright Policy](./DMCA_COPYRIGHT_POLICY.md). We may remove or disable access to reported content and terminate repeat infringers.

---

## 15. User conduct

You agree not to:

- Violate law or others' rights
- Harass, threaten, or defraud other users
- Circumvent bans, blocks, or moderation
- Scrape, crawl, or automate access without permission
- Manipulate ratings or reviews, including leaving a review without a completed (`fulfilled`) order for that listing
- Impersonate another person or business
- Post or sell AI-generated assets, or assets you do not have sufficient rights to sell

---

## 16. Disclaimers

THE SERVICE, AND EVERY ASSET LISTED ON THE SERVICE, IS PROVIDED "**AS IS**" AND "**AS AVAILABLE**" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components, and we do not warrant the accuracy, quality, safety, legality, functionality, or continued availability of any listing, license, or seller-hosted download link.

---

## 17. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE PLATFORM AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM:

- Your use of the Service
- Any transaction between a buyer and seller, including any dispute over a listing's license, condition, or download link
- Content posted by users, including listing descriptions, license text, and demo videos
- Unauthorized access to your account

OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF **(A)** AMOUNTS YOU PAID US (I.E., PLATFORM FEES, NOT THE FULL PRICE OF ANY ASSET) IN THE **12 MONTHS** BEFORE THE CLAIM OR **(B)** **$100 USD**.

Some jurisdictions do not allow certain limits; in those cases, our liability is limited to the fullest extent permitted by law.

---

## 18. Indemnity

**If you are a seller**, you agree to defend, indemnify, and hold harmless Local Marketplace from claims, damages, and expenses (including reasonable attorneys' fees) arising from:

- Any intellectual-property or licensing dispute arising from a listing you posted, including a claim that you did not own or control sufficient rights to sell the asset
- Any breach of your representations that your content is not AI-generated and that your download link is accurate and functional
- Your conduct or your violation of these Terms, the [Seller Agreement](./SELLER_AGREEMENT.md), or applicable law

**All users** agree to defend, indemnify, and hold harmless Local Marketplace from claims, damages, and expenses arising from their content, their conduct, or their violation of these Terms or law.

---

## 19. Termination and account deletion

You may stop using the Service at any time and delete your account in Settings. We may suspend or terminate your account at any time for any reason, including an immediate ban following a confirmed AI-generated-content violation (see [§11](#11-content-policy-summary)).

Sections that by nature should survive termination (licenses for moderation records, disclaimers, liability limits, indemnity, dispute-resolution terms) survive termination.

---

## 20. Dispute resolution — informal resolution, arbitration, and class action waiver

**Please read this section carefully. It affects your legal rights, including your right to file a lawsuit in court.**

### 20.1 Informal resolution first

Before filing any claim, starting arbitration, or filing suit, you agree to send **written notice** to us at **support@yourdomain.com** describing the dispute, the specific Terms provision(s) at issue, and the relief you are seeking, in enough detail for us to evaluate it. We will do the same if we have a claim against you. Both parties agree to negotiate in good faith for **60 days** after that written notice is received before either party may compel arbitration or file suit. This 60-day period may be extended by mutual written agreement.

### 20.2 Agreement to arbitrate

If informal resolution does not resolve the dispute, you and Local Marketplace agree that any dispute, claim, or controversy arising out of or relating to these Terms, the Service, or any transaction on the Service will be resolved by **binding individual arbitration**, rather than in court, except as set out in [§20.5](#205-small-claims-carve-out) and [§20.6](#206-30-day-opt-out).

Arbitration will be administered by the **American Arbitration Association ("AAA")** under its **Consumer Arbitration Rules**, which are incorporated into this agreement by reference. The AAA's rules and forms are available at [adr.org](https://www.adr.org).

> **Operator note (not a code task):** Registering this arbitration clause with the AAA (as required for certain consumer arbitration clauses under the AAA's Consumer Due Process Protocol) and confirming filing-fee/venue details is a **business/legal operations task for a human operator**, not something implemented in the application. Complete this step, together with attorney review, before relying on this clause commercially.

Arbitration will take place in **[YOUR COUNTY], [YOUR STATE]**, or another mutually agreed location, or may be conducted by phone, video, or written submissions where the AAA's rules allow. The arbitrator's decision will be final and binding, subject only to very limited court review under the Federal Arbitration Act.

### 20.3 Class, collective, and representative action waiver

**This section is a waiver of your right to participate in a class action. Read it carefully.**

To the maximum extent permitted by law, **you and Local Marketplace agree that any arbitration or proceeding will be conducted only on an individual basis and not as a class, collective, consolidated, or representative action.** The arbitrator has no authority to combine more than one person's claims, to preside over any form of class or representative proceeding, or to award relief to anyone other than the individual party bringing the claim.

**You and Local Marketplace each also waive any right to a jury trial** for any claim not resolved through the process above.

If this class/collective-action waiver is found unenforceable for a particular claim, that claim (and only that claim) will proceed in court, and the remainder of this arbitration agreement will still apply to the fullest extent possible.

### 20.4 Claim-filing time limit

Any claim arising out of or relating to these Terms or the Service must be filed within **one (1) year** of the date the claim first arose, to the extent permitted by law. Claims filed after that period are permanently barred.

### 20.5 Small-claims carve-out

Either party may instead bring an individual claim in **small-claims court** in a jurisdiction that has proper authority, if the claim qualifies for that court's jurisdictional limits, instead of arbitration.

### 20.6 30-day opt-out

**You may opt out of this arbitration agreement and the class-action waiver in §20.3 entirely.** To opt out, you must send written notice within **30 days of creating your account** to:

- **Email:** support@yourdomain.com (subject line: "Arbitration opt-out"), or
- **Mail:** the designated address in [ENTITY.md](./ENTITY.md), once published

Your notice must include your account username or email, and a clear statement that you wish to opt out of arbitration. If you timely opt out, neither you nor Local Marketplace will be required to arbitrate disputes between you, and instead the governing-law and venue terms in [§21](#21-governing-law) apply, but all other parts of these Terms (including the limitation of liability) remain in effect. Opting out does not affect any other Terms.

---

## 21. Governing law

These Terms are governed by the laws of **[YOUR STATE], United States**, without regard to conflict-of-law rules, except where preempted by federal law (including the Federal Arbitration Act) or, for a user who has validly opted out under [§20.6](#206-30-day-opt-out), except as set by the courts identified below.

For any dispute not subject to arbitration (small-claims matters, or disputes from a user who opted out under §20.6), you and Local Marketplace agree that the dispute will be resolved exclusively in the **state or federal courts located in [YOUR COUNTY], [YOUR STATE]**, and you consent to personal jurisdiction in those courts.

---

## 22. General

- **Entire agreement:** These Terms and incorporated documents are the entire agreement between you and Local Marketplace regarding the Service.
- **Severability:** If any provision is unenforceable, the rest remains in effect.
- **No waiver:** Failure to enforce a provision is not a waiver.
- **Assignment:** You may not assign these Terms; we may assign them in connection with a merger or sale.

---

## 23. Contact

**Support:** support@yourdomain.com  
**Privacy:** support@yourdomain.com  
**Copyright / DMCA:** see [DMCA / Copyright Policy](./DMCA_COPYRIGHT_POLICY.md)
