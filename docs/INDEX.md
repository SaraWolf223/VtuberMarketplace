# VTuber Marketplace — Documentation Index

**Purpose:** Master index for Cursor AI Auto Mode. Read documents in order during implementation.

**Version:** 1.2

---

## Quick links

| Role | Start here |
|------|------------|
| **Continue work** | [../PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md) |
| **Maintain stores / security** | [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md) |
| Founder / PM | [01-PRD.md](./01-PRD.md), [20-Seed_Content_Strategy.md](./20-Seed_Content_Strategy.md) |
| Cursor Auto Mode | [08-Cursor_Prompts.md](./08-Cursor_Prompts.md), [AGENTS.md](../AGENTS.md) |
| New developer | [00-Developer_Setup.md](./00-Developer_Setup.md) |
| Legal (pre-launch) | [legal/README.md](./legal/README.md) |

---

## How to use this stack

1. Read **01-PRD.md** once before any coding.
2. Complete **00-Developer_Setup.md** (Supabase, Stripe, YouTube Data API accounts).
3. Apply **02-Cursor_Rules.md** via `.cursor/rules/`.
4. Implement backend: **03** → **04** → **05** → **21**.
5. Implement frontend: **06** → **07** → **22** (flows).
6. Execute builds: **08-Cursor_Prompts.md** (one prompt per task).
7. Cross-reference domain docs **10–14** when touching those systems (doc **09** is retired).
8. Use **15** to reject scope creep.
9. Before launch: **16–18**, publish **legal/**, run **17**.

---

## Document map

### Setup & meta

| File | Purpose |
|------|---------|
| [00-Developer_Setup.md](./00-Developer_Setup.md) | Accounts, env vars, first run |
| [../AGENTS.md](../AGENTS.md) | Cursor agent entry point |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Workflow for changes |
| [../CHANGELOG.md](../CHANGELOG.md) | Doc/code history |

### Foundation (01–08)

| # | File | When to read |
|---|------|----------------|
| 01 | [01-PRD.md](./01-PRD.md) | Always — source of truth |
| 02 | [02-Cursor_Rules.md](./02-Cursor_Rules.md) | Every Auto session |
| 03 | [03-Database_Schemas.md](./03-Database_Schemas.md) | Migrations / RLS |
| 04 | [04-API_Endpoints.md](./04-API_Endpoints.md) | Hooks / edge functions |
| 05 | [05-Backend_Architecture.md](./05-Backend_Architecture.md) | Supabase setup |
| 06 | [06-Frontend_Structure.md](./06-Frontend_Structure.md) | Expo Router |
| 07 | [07-UI_UX_Design_System.md](./07-UI_UX_Design_System.md) | UI work |
| 08 | [08-Cursor_Prompts.md](./08-Cursor_Prompts.md) | Copy-paste build prompts |

### Domain systems (09–14)

| # | File | Topic |
|---|------|-------|
| 09 | [09-Search_and_Radius_System.md](./09-Search_and_Radius_System.md) | **RETIRED** — geo feed stub (see `01-PRD.md` §10) |
| 10 | [10-Monetization_System.md](./10-Monetization_System.md) | Stripe, ads |
| 11 | [11-Storage_and_Deletion_System.md](./11-Storage_and_Deletion_System.md) | Images, expiry |
| 12 | [12-Moderation_and_Safety.md](./12-Moderation_and_Safety.md) | Reports, bans |
| 13 | [13-Legal_and_Compliance.md](./13-Legal_and_Compliance.md) | Compliance requirements |
| 14 | [14-Security_Best_Practices.md](./14-Security_Best_Practices.md) | RLS, secrets |

### Scope & extended specs (15–24)

| # | File | Topic |
|---|------|-------|
| 15 | [15-MVP_vs_Future_Features.md](./15-MVP_vs_Future_Features.md) | Scope guard |
| 16 | [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md) | EAS, CI, cron |
| 17 | [17-Testing_and_QA.md](./17-Testing_and_QA.md) | Test plans |
| 18 | [18-App_Store_Release_Checklist.md](./18-App_Store_Release_Checklist.md) | Store submission |
| 19 | [19-Analytics_and_Growth.md](./19-Analytics_and_Growth.md) | Events, metrics |
| 20 | [20-Seed_Content_Strategy.md](./20-Seed_Content_Strategy.md) | City launch |
| 21 | [21-Edge_Functions_Spec.md](./21-Edge_Functions_Spec.md) | Edge function detail |
| 22 | [22-User_Flows.md](./22-User_Flows.md) | Mermaid user flows |
| 24 | [24-Brand_and_Marketing_Copy.md](./24-Brand_and_Marketing_Copy.md) | App Store, marketing copy templates |
| 25 | [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md) | **Google sign-in + profile** |
| 26 | [26-New_Features_Spec.md](./26-New_Features_Spec.md) | Post-MVP feature specs: ratings, DMs, report/block automation, college badge |
| 27 | [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md) | **Play/App Store upkeep, security cadence, agent maintenance** |
| 28 | [28-Web_App.md](./28-Web_App.md) | **Expo web app at `/app`, landing integration** |
| 29 | [29-Web_QA_Checklist.md](./29-Web_QA_Checklist.md) | Web (desktop + mobile browser) QA checklist |
| 31 | [31-Launch_and_Growth_Plan.md](./31-Launch_and_Growth_Plan.md) | **Reusable local-launch playbook: seeding supply, creator marketing, metrics gates** |
| 34 | [34-Store_Accounts_and_Launch_Readiness.md](./34-Store_Accounts_and_Launch_Readiness.md) | **Google Play + Apple Dev account setup (D-U-N-S/org), closed beta, staff/admin + waitlist email notifications** |

### Reference notes

| File | Purpose |
|------|---------|
| [DEVICE_QA_SETUP.md](./DEVICE_QA_SETUP.md) | Emulator / physical Android + iPhone dev-build setup |
| [fullscreen-ads.md](./fullscreen-ads.md) | App Open + Interstitial AdMob ad spec |
| [google-feed-video-ads.md](./google-feed-video-ads.md) | In-feed native/video AdMob ad spec |

### Legal ([legal/](./legal/))

| File | Purpose |
|------|---------|
| [LEGAL_INDEX.md](./legal/LEGAL_INDEX.md) | Document hierarchy (marketplace-facilitator stack) |
| [TERMS_OF_SERVICE.md](./legal/TERMS_OF_SERVICE.md) | Master agreement + arbitration |
| [SELLER_AGREEMENT.md](./legal/SELLER_AGREEMENT.md) | Seller terms (Connect, links, strikes, support plans) |
| [BUYER_PURCHASE_TERMS.md](./legal/BUYER_PURCHASE_TERMS.md) | Buyer purchase / license / subscription terms |
| [DMCA_COPYRIGHT_POLICY.md](./legal/DMCA_COPYRIGHT_POLICY.md) | DMCA / copyright policy |
| [PRIVACY_POLICY.md](./legal/PRIVACY_POLICY.md) | Privacy |
| [COMMUNITY_GUIDELINES.md](./legal/COMMUNITY_GUIDELINES.md) | Listing + conduct rules |

### Backend folder

| File | Purpose |
|------|---------|
| [../supabase/README.md](../supabase/README.md) | Migrations & Edge deploy |

---

## Recommended build order (Auto Mode)

```
Setup     → 00-Developer_Setup.md
Phase A   → 08 prompt 00, 01
Phase B   → 08 prompts 02, 03
Phase C   → 08 prompts 04, 05 + docs 03, 11
Phase D   → 08 prompt 06 + doc 03 (discovery filters — doc 09 retired)
Phase E   → 08 prompts 07, 08
Phase F   → 08 prompts 09, 10, 11 + doc 10
Phase G   → 08 prompts 12, 13 + docs 12, 11
Phase H   → 08 prompts 14, 15, 16 + docs 17, 16, 18
Launch    → legal/*, 20, 24
```

---

## Hard constraints (never violate)

- No fixed max listing price — price must be greater than $0
- Every listing requires ≥3 photos and exactly one validated YouTube demo video before publish
- **Real payments via Stripe Connect Express** — tiered platform commission (10% free / 8% Pro Seller)
- **Digital delivery only** — seller-hosted links; the platform never stores asset files
- **OTU or P2U licensing** on every listing; seller-authored license text snapshotted at checkout
- **Global catalog** — no ZIP/radius geo discovery (`09-Search_and_Radius_System.md` is retired)
- Purchase-verified reviews only; DMs require email verification — see [01-PRD.md](./01-PRD.md)

---

## Environment variables

See **00-Developer_Setup.md** and **16-Deployment_and_DevOps.md**.
