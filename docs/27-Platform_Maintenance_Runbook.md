# Local Marketplace — Platform Maintenance Runbook

**Version:** 1.1  
**Audience:** Cursor AI agents + solo founder  
**Purpose:** Keep Local Marketplace secure, compliant, and current on **Google Play** and the **App Store** after launch (and during pre-launch hardening).

**Use this doc when the user asks to:** maintain the app, patch vulnerabilities, update dependencies, prepare a store release, respond to store policy changes, or run a periodic security review.

**Related docs:** [14-Security_Best_Practices.md](./14-Security_Best_Practices.md) · [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md) · [18-App_Store_Release_Checklist.md](./18-App_Store_Release_Checklist.md) · [13-Legal_and_Compliance.md](./13-Legal_and_Compliance.md) · [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md)

---

## 1. Agent operating rules

1. **Read first:** [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md) → this doc → system-specific doc from [AGENTS.md](../AGENTS.md).
2. **One maintenance theme per session** — e.g. “monthly dependency audit” OR “Play Data safety refresh”, not both plus new features.
3. **Never violate MVP non-negotiables** (see [02-Cursor_Rules.md](./02-Cursor_Rules.md)): no item payments, feed geo, Google auth, expiry rules.
4. **Research before upgrading** — check Expo SDK compatibility, breaking changes, and store minimum OS/SDK requirements.
5. **Document every maintenance session** — append to `PROJECT_BACKLOG.md` Session log; update [CHANGELOG.md](../CHANGELOG.md) for user-visible or security changes.
6. **Human-only actions** — store console login, Stripe live keys, legal sign-off, production secret rotation in Supabase/EAS dashboards. Agent prepares diffs and checklists; user executes where credentials are required.

---

## 2. Maintenance cadence overview

| Cadence | Focus | Agent deliverable |
|---------|--------|-------------------|
| **Weekly** | Security signals, moderation SLA, cron health | Status note in backlog; hotfix PR if needed |
| **Monthly** | Dependencies, npm audit, Supabase/Stripe dashboards | Audit report + prioritized fix list |
| **Quarterly** | Expo SDK evaluation, store policy review, legal URL check | Upgrade plan or “defer” with reasons |
| **Per release** | Version bump, store metadata, QA, migration deploy | Release checklist completed |
| **On incident** | Contain → patch → postmortem | Hotfix + `docs/incidents/` entry |

---

## 3. Weekly checklist (≈30 min)

### 3.1 Platform health

- [ ] **Supabase Dashboard** — API errors, auth spikes, Edge function 5xx, database CPU/storage
- [ ] **Supabase free-tier pause** — project NOT paused, or keep-alive automation re-added (see [§3.4](#34-supabase-free-tier-keep-alive))
- [ ] **Cron jobs** — `expire_due_listings`, purge edges (`purge-expired-listings`, `purge-expired-banner-ads`, `purge-expired-college-badges`) ran successfully (see [supabase/scripts/cron-schedule.sql](../supabase/scripts/cron-schedule.sql))
- [ ] **Stripe Dashboard** — failed payments, dispute/chargeback alerts, webhook delivery failures
- [ ] **EAS / Expo** — failed builds, OTA adoption on production channel
- [ ] **Google Play Console** — policy inbox, crash/ANR spikes (Android Vitals)
- [ ] **App Store Connect** — crash reports, review replies, compliance messages

### 3.4 Supabase free-tier keep-alive

Supabase **pauses free-tier projects after 7 days with no database request** (API call, query, or Edge function). When paused, the DB goes offline, `pg_cron` jobs stop (and don't backfill), and the app shows blank/errors until manually restored from the dashboard. `pg_cron` cannot prevent this — it dies with the paused DB — so the heartbeat must come from **outside** the project.

This automation is **not shipped by default** in this template — it's dev/ops tooling most buyers on a paid Supabase plan don't need, and a scheduled workflow that pings a live database isn't something to leave running unattended without the owner's knowledge. If you're on the Supabase **free tier** and want the project to stay awake automatically, re-add it with the recipe below (≈5 minutes).

**Recipe — re-add the GitHub Actions keep-alive workflow:**

1. Create `scripts/supabase-keepalive.mjs`:

   ```js
   import { readFileSync } from 'node:fs';
   import { fileURLToPath } from 'node:url';
   import { dirname, join } from 'node:path';

   const __dirname = dirname(fileURLToPath(import.meta.url));

   function loadEnv() {
     const env = { ...process.env };
     if (env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY) return env;
     try {
       const raw = readFileSync(join(__dirname, '..', '.env'), 'utf8');
       for (const line of raw.split(/\r?\n/)) {
         const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
         if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
       }
     } catch {
       // no .env; rely on process.env
     }
     return env;
   }

   async function main() {
     const env = loadEnv();
     const url = (env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '');
     const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
     if (!url || !key || url.includes('your-project')) {
       console.error('Missing Supabase URL or anon key (env or .env).');
       process.exit(1);
     }
     // profiles_public is granted to anon, so this is a real DB read returning 200.
     const res = await fetch(`${url}/rest/v1/profiles_public?select=id&limit=1`, {
       headers: { apikey: key, Authorization: `Bearer ${key}` },
     });
     await res.text();
     if (res.status !== 200) {
       console.error(`Unexpected HTTP ${res.status}`);
       process.exitCode = 1;
       return;
     }
     console.log('Supabase keep-alive OK (HTTP 200). Inactivity timer reset.');
   }

   main().catch((e) => { console.error(e); process.exitCode = 1; });
   ```

2. Add an npm script: `"supabase:keepalive": "node scripts/supabase-keepalive.mjs"`.
3. Create `.github/workflows/supabase-keepalive.yml`:

   ```yaml
   name: Supabase keep-alive
   on:
     schedule:
       - cron: '0 9 * * 1,4' # 09:00 UTC every Monday and Thursday — gap always < 7 days
     workflow_dispatch: {}
   jobs:
     ping:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: node scripts/supabase-keepalive.mjs
           env:
             SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
             SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
   ```

4. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = value of `EXPO_PUBLIC_SUPABASE_URL`
   - `SUPABASE_ANON_KEY` = value of `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - (Both are already public in the client bundle; secrets just keep them out of the committed workflow file.)
5. Push to GitHub, then run the workflow once manually (Actions tab → **Run workflow**) to confirm it goes green.

**Notes:**

- GitHub disables scheduled workflows after **60 days of no repo activity** — normal commits reset this; if the repo ever goes idle long-term, re-enable from the Actions tab.
- A weekly ping is the minimum; twice weekly is the safety margin used above.
- Long-term alternative if pausing remains a risk: upgrade to a paid Supabase plan, or migrate to a provider whose free tier doesn't pause.

### 3.2 Trust & safety SLA

- [ ] Open reports **&lt; 24h** old addressed ([12-Moderation_and_Safety.md](./12-Moderation_and_Safety.md))
- [ ] Paused listings (`paused_pending_review`) reviewed
- [ ] Banner ad queue (if any pending approve/reject)

### 3.3 Quick security scan

```bash
npm audit
git log --oneline -20   # unexpected commits?
```

- [ ] No new secrets in git (`git grep -i "sk_live\\|service_role\\|BEGIN PRIVATE"`)
- [ ] Supabase **Auth** → unusual sign-in geography or bot bursts

**If critical CVE or active abuse:** jump to [Section 10 — Incident response](#10-incident-response).

---

## 4. Monthly checklist (≈2–4 hours)

### 4.1 Dependency & vulnerability management

**Run:**

```bash
npm audit
npm outdated
npx expo-doctor
```

**Research (official sources only):**

| Source | What to check |
|--------|----------------|
| [Expo changelog](https://expo.dev/changelog) | SDK patches, security advisories |
| [React Native releases](https://github.com/facebook/react-native/releases) | CVEs affecting bundled RN |
| [Supabase status & changelog](https://supabase.com/docs/guides/getting-started/changelog) | Auth, RLS, Edge runtime |
| [GitHub Advisory Database](https://github.com/advisories) | npm packages in `package.json` |
| [Stripe API changelog](https://stripe.com/docs/upgrades) | Breaking API version changes |
| [Google Play policy center](https://support.google.com/googleplay/android-developer/topic/9858052) | Target API, Data safety, UGC |
| [Apple Developer news](https://developer.apple.com/news/) | SDK minimums, Guideline 1.2 / 3.1 |

**Prioritize fixes:**

| Severity | Action |
|----------|--------|
| **Critical / High (runtime)** | Patch within 7 days; store release if client affected |
| **Moderate (dev toolchain)** | Batch with next Expo SDK bump |
| **Low** | Backlog unless exploitable in app context |

**Expo SDK rule:** Prefer **patch/minor** within same SDK (e.g. 54.x). **Major SDK bumps** are a dedicated session — read upgrade guide, run `npx expo install --fix`, rebuild native (`eas build`), full device QA.

### 4.2 Backend maintenance

```bash
npx supabase db push --dry-run   # pending migrations?
npx supabase functions list      # deployed set matches repo
```

- [ ] All migrations through latest in repo applied to **production**
- [ ] Edge secrets present: `CRON_SECRET`, `COLLEGE_OTP_SECRET`, `STRIPE_*`, `MAPBOX_*`, optional `CORS_ALLOWED_ORIGINS`
- [ ] RLS spot-check: two test users cannot read/write each other’s data (see [14-Security_Best_Practices.md](./14-Security_Best_Practices.md))
- [ ] Review `moderation_actions` + auth logs for anomalies
- [ ] Banner analytics tables size — purge job healthy (90-day retention)

### 4.3 Secrets & access rotation (quarterly minimum; monthly review)

- [ ] No shared passwords; service accounts documented
- [ ] Rotate if team access changed: `CRON_SECRET`, `COLLEGE_OTP_SECRET`, Stripe webhook secret, Mapbox token
- [ ] Google OAuth client still matches bundle IDs / SHA-1 (Android) / iOS URL scheme
- [ ] EAS Secrets match `.env.example` keys (no drift)

### 4.4 Analytics & privacy

- [ ] PostHog (if enabled) — no new PII fields without Privacy Policy update
- [ ] Confirm analytics excludes home ZIP in feed events (privacy hardening)
- [ ] Account deletion flow works end-to-end ([04-API_Endpoints.md](./04-API_Endpoints.md) §3.4)

---

## 5. Quarterly checklist

### 5.1 Store policy & OS targets

**Google Play**

- [ ] **Target API level** meets current Play requirement (update `expo-build-properties` / compile SDK)
- [ ] **Data safety form** matches actual data collection (email, name, photos, ZIP, purchase history)
- [ ] **Families / ads** — AdMob UMP consent if ads live in EEA
- [ ] Content rating questionnaire still accurate

**Apple App Store**

- [ ] **Xcode / iOS SDK minimum** meets App Store Connect requirements
- [ ] **Guideline 1.2 (UGC)** — report, block, moderation SLA still documented in review notes
- [ ] **Guideline 3.1 (IAP)** — if Stripe is still used for boosts/premium on iOS, confirm the iOS payments strategy (see 10-Monetization_System.md §2); IAP required for public digital goods
- [ ] **Privacy Nutrition Labels** match app behavior
- [ ] **Account deletion** — in-app path available (Apple requirement)

### 5.2 Legal & compliance

- [ ] Terms, Privacy, Community Guidelines URLs live and match in-app links
- [ ] Privacy Policy covers: Google auth, PostHog, Mapbox, Stripe, AdMob (when live), Supabase region
- [ ] Meetup safety content current ([legal/MEETUP_SAFETY.md](./legal/MEETUP_SAFETY.md))
- [ ] Lawyer review if adding new data types or monetization

### 5.3 Architecture review

- [ ] Re-read security migrations **070–076** still deployed
- [ ] Confirm no new direct REST writes bypass RPC-only paths ([03-Database_Schemas.md](./03-Database_Schemas.md))
- [ ] Deep links: `assetlinks.json` + Apple App Site Association hosted on `yourdomain.com`
- [ ] Optional hardening backlog: cert pinning, jailbreak detect, report honeypot ([14-Security_Best_Practices.md](./14-Security_Best_Practices.md))

---

## 6. Per-release checklist (every store submission)

### 6.1 Versioning

| File | Field |
|------|--------|
| `app.config.ts` | `version` (user-facing semver) |
| `app.config.ts` | iOS `buildNumber`, Android `versionCode` (or EAS `autoIncrement`) |
| `package.json` | `version` (keep in sync) |
| [CHANGELOG.md](../CHANGELOG.md) | User-facing release notes |

```bash
npm run typecheck
npm run lint
npm audit --audit-level=high
```

### 6.2 Native vs OTA decision

| Change type | Ship via |
|-------------|----------|
| JS/TS only, no native module changes | **EAS Update** (staged rollout) |
| New native module, SDK bump, permissions, icons | **New `eas build`** + store submit |
| Supabase migration | `db push` **before** or **with** client release |
| Edge function security fix | Deploy function immediately (may not need store release) |

See [16-Deployment_and_DevOps.md](./16-Deployment_and_DevOps.md) §4.3.

### 6.3 Pre-submit QA (both stores)

Use [17-Testing_and_QA.md](./17-Testing_and_QA.md) + backlog **B-1**:

- Google sign-in / sign-out
- Feed ZIP + radius, filters, banners
- Create listing, DM, phone verify, report/block
- Boost / premium / banner checkout (platform-appropriate payment method)
- Admin moderation path (founder device)
- Banned user gate, delete account

### 6.4 Store-specific submission

**Google Play** — see [18-App_Store_Release_Checklist.md](./18-App_Store_Release_Checklist.md) §6–7

- [ ] AAB uploaded to correct track (internal → closed → production)
- [ ] Release notes written
- [ ] Data safety + content rating confirmed
- [ ] Stripe live keys only in production profile

**App Store**

- [ ] TestFlight soak (recommended 1 week for first major release)
- [ ] App Review Information + demo account if needed
- [ ] Export compliance, encryption questionnaire
- [ ] Review notes template (UGC + payments) from doc 18 §5

---

## 7. Security research workflow (agents)

When the user asks to “check for vulnerabilities” or after `npm audit` / news of a CVE:

### Step 1 — Inventory

List versions from `package.json`, `app.config.ts`, Supabase project settings, and Edge Deno imports.

### Step 2 — Search authoritative sources

1. Package name + CVE on [GitHub Advisory Database](https://github.com/advisories)
2. Expo SDK security notes for current SDK
3. Supabase [security docs](https://supabase.com/docs/guides/platform/going-into-prod)
4. OWASP Mobile Top 10 (marketplace-relevant: insecure auth, insecure data storage, insufficient transport security)

### Step 3 — Assess exploitability in Local Marketplace

| Question | If yes → higher priority |
|----------|---------------------------|
| Does CVE affect production client runtime? | Patch now |
| Does it require physical device access? | Lower |
| Is it Edge/Deno or devDependency only? | Schedule with upgrade |
| Does it bypass RLS or payment flows? | **Critical** |

### Step 4 — Fix pattern

1. Minimal patch version bump OR documented mitigation
2. Run `typecheck` + targeted manual test
3. Deploy backend first if DB/Edge fix
4. Store release if native/client fix
5. Log in backlog Session log + CHANGELOG

### Step 5 — Local Marketplace-specific invariants to re-verify after any security patch

- [ ] Price validation (must be `> 0`) still enforced (client + edge + DB)
- [ ] Feed still ZIP + radius bounded
- [ ] `profiles` trusted fields not self-writable (migration 075)
- [ ] Listings not insertable via direct REST (075)
- [ ] Cron purge requires `CRON_SECRET`
- [ ] Stripe webhook signature verified
- [ ] OAuth callbacks restricted to trusted URLs

---

## 8. Component maintenance map

| System | What to keep updated | Where | Cadence |
|--------|----------------------|-------|---------|
| **Expo / React Native** | SDK, native modules | `package.json`, `app.config.ts` | Quarterly + CVE |
| **Supabase** | Migrations, RLS, Edge functions | `supabase/` | Each schema/API change |
| **Google OAuth** | Client IDs, redirect URIs, consent screen | Google Cloud Console, Supabase Auth | On bundle ID change |
| **Stripe** | API version, Products/Prices, webhooks | Dashboard + Edge secrets | Monthly review |
| **Mapbox** | Token scopes, usage | Mapbox account + Edge | Monthly usage |
| **AdMob** | Ad unit IDs, UMP, policy | `.env`, `app.config.ts` | Before ads go live |
| **EAS** | Build profiles, secrets, channels | `eas.json`, Expo dashboard | Per release |
| **Deep links** | App Links / Universal Links | `yourdomain.com/.well-known/` | On domain change |
| **Legal pages** | Terms, Privacy, Guidelines | `docs/legal/`, website | Quarterly or feature change |
| **PostHog** | Event schema, retention | `src/lib/analytics.ts` | On new events |
| **Moderation** | Banned keywords, report reasons | Admin UI + migrations | As needed |

---

## 9. Google Play ongoing obligations

1. **Target API deadline** — Google publishes annual deadline; bump `compileSdkVersion` via Expo build properties before cutoff.
2. **Data safety** — Update form when adding analytics, ads, location, or payment SDKs.
3. **UGC apps** — Maintain report/block and timely moderation ([12-Moderation_and_Safety.md](./12-Moderation_and_Safety.md)).
4. **Payments** — Digital goods (boosts, premium) use Play Billing **or** clearly non-digital physical meetup goods only; Local Marketplace item sales are offline — document in store listing.
5. **Android Vitals** — Watch crash rate, ANR, startup time after each release.
6. **Policy rejections** — Read rejection email fully; fix → resubmit with explanation in “Notes to reviewer”.

---

## 10. App Store ongoing obligations

1. **SDK minimums** — Apple requires recent Xcode/iOS SDK; rebuild with latest EAS macOS image before deadline.
2. **Guideline 1.2 (UGC)** — Same moderation SLA as Play; keep review notes updated.
3. **Guideline 3.1** — Boosts/premium are digital services; **IAP required** for broad iOS distribution unless those features are disabled on iOS.
4. **Account deletion** — Must be discoverable in-app (Settings → Delete account).
5. **Privacy labels** — Update when collection changes.
6. **TestFlight feedback** — Triage before promoting build to App Review.

---

## 11. Incident response

Follow [14-Security_Best_Practices.md](./14-Security_Best_Practices.md) §10.

**Containment options:**

| Incident | Immediate action |
|----------|------------------|
| Account takeover / RLS bypass | Ban user; deploy Edge/DB hotfix; rotate secrets if leaked |
| Stripe fraud | Refund/chargeback via Dashboard; review webhook logs |
| Cron abuse | Set `CRON_SECRET`; block caller IP at Supabase if needed |
| Malicious banner link | Pause campaign; tighten `validate_banner_link` |
| OAuth redirect attack | Verify trusted callback code; force sign-out all sessions |
| Store malware accusation | Supply build provenance (EAS build ID, git tag) |

**Postmortem:** create `docs/incidents/YYYY-MM-DD-short-title.md` with timeline, root cause, fix, prevention.

---

## 12. Maintenance session templates (for Cursor)

Copy into chat when starting a session:

### Monthly security & dependency pass

```
Read docs/27-Platform_Maintenance_Runbook.md Section 4.
Run npm audit, npm outdated, expo-doctor.
Research any High/Critical CVEs for our direct dependencies.
Produce prioritized fix list (P0/P1/P2). Implement P0 only this session.
Update PROJECT_BACKLOG.md session log.
```

### Pre-release store prep

```
Read docs/27-Platform_Maintenance_Runbook.md Section 6 and docs/18-App_Store_Release_Checklist.md.
Verify version bumps, typecheck, migration deploy status, and B-1 QA checklist.
Prepare release notes for Play + App Store. Do not submit without user confirmation.
```

### Quarterly policy review

```
Read docs/27-Platform_Maintenance_Runbook.md Section 5.
Web search current Google Play target API and Apple SDK requirements for 2026.
Compare to our app.config.ts and eas.json. List gaps and recommended timeline.
Update PROJECT_BACKLOG.md Do soon section if new deadlines found.
```

---

## 13. What to update after maintenance

| Change | Update |
|--------|--------|
| Any user-visible fix | [CHANGELOG.md](../CHANGELOG.md) |
| Security / deploy / schedule | [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md) Session log + **Do soon** |
| Schema / API | [03-Database_Schemas.md](./03-Database_Schemas.md), [04-API_Endpoints.md](./04-API_Endpoints.md) |
| New env secret | [.env.example](../.env.example), [00-Developer_Setup.md](./00-Developer_Setup.md) |
| Incident | `docs/incidents/` + backlog |

---

## 14. Revision history

| Date | Version | Change |
|------|---------|--------|
| 2026-05-26 | 1.0 | Initial runbook for Play/App Store maintenance, security cadence, agent workflows |
| 2026-07-13 | 1.1 | Removed the Supabase keep-alive GitHub Action, npm script, and helper script from the default buyer path (dev/ops cruft, not needed on paid Supabase plans); §3.4 now documents it as an opt-in recipe to re-add for free-tier projects |
