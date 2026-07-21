# VtuberMarketplace — Moderation and Safety

**Version:** 2.1

---

## 1. Moderation philosophy

- **Lightweight automation** + **human review** for reports and confirmed violations
- No AI image moderation in MVP (add when scale requires)
- Focus on content-integrity violations (AI-generated assets, explicit content, stolen art) and delivery accountability (broken download links), not subjective price disputes
- Two distinct enforcement ladders: a normal **warn-first** ladder for most violations, and a **direct-to-ban** path reserved for confirmed AI-generated content (§3)

---

## 2. Prohibited content (hard ban)

| Category | Detail |
|----------|--------|
| AI-generated assets | Any listing whose asset (model, rig, artwork) was AI-generated is banned outright — see §3 for the enforcement path |
| Explicit sexual content | Banned, no exceptions — contrast with mature-but-non-explicit content, which is allowed and age-gated (§4) |
| Stolen/unauthorized art | Listing an asset the seller doesn't hold rights to (traced, ripped, or otherwise unauthorized use of another artist's work) — backed by the DMCA policy in the legal stack |
| Physical goods | Out of scope for this domain entirely — this is a digital-asset-only marketplace |
| Freelance/bespoke commissions | Made-to-order work is out of scope — this is a pre-made-asset marketplace, not a commission board |
| Illegal content | Anything violating applicable law |

**Enforcement:** keyword filter (title/description/DM bodies) + user reports + scheduled link-health checks + admin removal.

---

## 3. AI-generated content — direct-to-ban path

This is the one violation category that **skips the normal warn-first ladder** (§6):

```
Report (reason = ai_generated_content) OR admin proactive review
  → Admin investigates (may request seller evidence: source files, working files, process history)
  → Confirmed AI-generated → immediate account ban (banned_at = now()), listing removed
  → Not confirmed → dismiss report, no action against the seller
```

Rationale: AI-generated assets are a category-integrity issue, not a one-off content mistake — allowing a warn-then-ban ladder here would let sellers repeatedly test the boundary with low-value throwaway listings. Every other violation type (explicit content, stolen art, banned-keyword violations, etc.) still uses the standard warning → removal → ban ladder in §7.

---

## 4. Mature content — age-gating (not a ban)

- Sellers flag a listing `is_mature = true` at creation/edit for suggestive-but-non-explicit content (skimpy outfits, suggestive poses, horror/gore short of graphic — use judgment, defaults to admin discretion on edge cases)
- Mature listings are **blurred by default** in feed thumbnails and detail view; buyer must tap through an interstitial to view unblurred (client-side toggle, persisted per-session, not a permanent account setting in MVP)
- Mature listings still appear in the global feed unless the buyer has the mature-content filter set to hide them (`01-PRD.md` §6.3 filter set)
- **Explicit sexual content is never allowed regardless of the `is_mature` flag** — `is_mature` age-gates suggestive content, it does not legitimize explicit content. A report or admin review confirming explicit (not just suggestive) content follows the standard warn-first ladder (§7) unless it's also confirmed AI-generated, in which case §3 applies.

---

## 5. Banned keywords (starter list)

Seed `banned_keywords` with (non-exhaustive, VTuber-domain-relevant):

```
ai generated, midjourney, stable diffusion, dall-e, ai art, ai rigged,
traced, stolen art, ripped model, unauthorized use,
cp, loli, shota, child, minor,
onlyfans, escort, wire transfer, gift card code, paypal fee outside app
```

**Matching:** case-insensitive substring on `title + description` in the listing create/edit path, and on DM message bodies in `send_conversation_message`.

**False positives:** admin can whitelist via keyword `active = false` in **Admin → Banned keywords** (`app/admin/banned-keywords.tsx`).

Removed from the original starter list (physical-goods-specific, not applicable to a digital asset marketplace): `weapon, gun, ammo, knife, drug, weed, cocaine, vape, tobacco, cigarette, alcohol, beer, wine, counterfeit, replica, prescription, viagra, shipping only`.

---

## 6. Report system

### 6.1 Report reasons (enum)

| Reason | Scope | Ladder |
|--------|-------|--------|
| `ai_generated_content` | Listing | Direct-to-ban (§3) |
| `explicit_content` | Listing | Warn-first (§7), unless also confirmed AI-generated |
| `stolen_content` | Listing | Warn-first (§7) — backed by DMCA takedown process |
| `download_link_not_working` | Order-scoped (`reports.order_id`) | Not a normal report ladder at all — routes into the link-health grace-period/strike pipeline (`11-Storage_and_Deletion_System.md` §5–§7) |
| `misleading` | Listing | Warn-first (§7) — e.g. license type or asset compatibility misrepresented |
| `scam` | Listing/user | Warn-first (§7) |
| `spam` | Listing/user | Warn-first (§7) |
| `harassment` | User (DM/reviews) | Warn-first (§7) |
| `other` | Listing/user | Admin discretion |

**Removed** (physical-goods-specific, not applicable): `prohibited_item`, `counterfeit`, `stolen` (superseded by the more specific `stolen_content`, scoped to unauthorized-art claims rather than "stolen goods").

### 6.2 Flow (standard reports, excludes `ai_generated_content` and `download_link_not_working`)

```
User submits report → status open →
Admin reviews queue → actioned OR dismissed →
moderation_actions audit log
```

**Auto-pause listing:** when a listing receives **≥10 reports in 24 hours** or **≥50 lifetime** (admin-editable defaults, `public_app_config` keys `pause_reports_24h` / `pause_reports_lifetime`), the report-submission path sets `listings.status = 'paused_pending_review'` and hides it from the feed until an admin unpauses or deletes it. This is a separate auto-pause trigger from the link-health auto-pause in `11-Storage_and_Deletion_System.md` §7.2 — both land on the same `paused_pending_review` status but for unrelated reasons (report volume vs a confirmed broken link).

**Admin queue (app):** `app/admin/moderation.tsx` — open reports show listing thumbnail/title (tap → listing detail) and seller/reported user (tap → profile). Reports whose listing was deleted are auto-dismissed via `purge_orphan_reports` on queue refresh. Report cards show age and flag items older than 24h. Actions: dismiss, warn user (optional note in audit log), ban user, delete listing. `download_link_not_working` reports do not appear here — they surface in the **link health queue** instead (§6.4).

### 6.3 Rate limits

- 5 reports per user per hour
- Duplicate report on the same target within 24h → reject
- **10 promo redemption attempts per user per hour** (success or fail); invalid codes return a generic error to limit guessing
- **Each promo code: one redemption per user** (`promo_redemptions` unique on `promo_code_id + user_id`)
- **10 listing creates per user per hour** (`create-listing` + `listing_create_log`)
- **15 DMs per minute per thread** (`send_conversation_message` RPC)
- Shared bucket table: `rate_limit_events` (`checkRateLimit` in edge functions)
- **Pro Seller free-trial/comp promos: one per account lifetime** (partial unique index on `promo_redemptions.user_id` where a Pro Seller grant is involved)
- DM sending requires **email verification** (not phone — phone verification is reserved for Stripe Connect payout gating, see `01-PRD.md` §5.5)

Removed (not applicable to this domain): the 60/hour `geocode-zip` limit and the 3/hour + 10/day college `.edu` OTP limits — no ZIP geocoding and no college-verification feature exist in this domain.

### 6.4 Link health queue (moderation surface, distinct from §6.2)

The admin **link health queue** (`app/admin/link-health.tsx` or a tab within `app/admin/moderation.tsx`) is where broken-download-link issues that survived the grace period land for human confirmation before a strike is recorded. Full pipeline detail lives in `11-Storage_and_Deletion_System.md` §5–§7; from a moderation-surface perspective it behaves like a specialized report queue:

```
Grace period elapsed, issue still open → appears in link health queue
  → Admin confirms broken → seller_strikes row inserted, listing auto-paused
  → Admin confirms fixed/false positive → issue closed, no strike
```

3 active (non-expired) strikes → automatic ban, same `banned_at` mechanism as any other ban action.

---

## 7. Standard warn-first sanction ladder

Applies to every violation **except** confirmed AI-generated content (§3, direct-to-ban):

| Sanction | Effect |
|----------|--------|
| **Warning** | Email/push + note in `moderation_actions` |
| **Remove listing** | `status = 'deleted'`, storage cleanup queued |
| **Shadow ban** | `shadow_banned = true`; listings invisible in feed; admin: All users → tap user → Shadow ban |
| **Ban** | `banned_at = now()`; app signs the user out on next open via `BannedAccountGate`; users cannot self-clear `banned_at` / `shadow_banned` |

Repeat/escalating violations of the same non-AI category typically progress warning → remove listing → ban, at admin discretion based on severity and history — there's no rigid strike-count trigger for this ladder (that mechanism is reserved for the link-health strike system, which has its own explicit 3-strike threshold).

---

## 8. Escalation matrix

| Severity | Action |
|----------|--------|
| Confirmed AI-generated content | Direct-to-ban (§3) — no warning step |
| Explicit sexual content | Remove listing + warn-first ladder (§7); escalates to ban on repeat |
| Confirmed stolen/unauthorized art | Remove listing + DMCA process + warn-first ladder |
| Illegal content | Remove + ban + preserve logs |
| Threats/harassment | Ban + consider law-enforcement referral |
| Confirmed broken download link (3rd active strike) | Automatic account ban |

---

## 9. Block system

- Blocked user: hide all their listings from feed RPC
- Blocker cannot see the blocked user's profile/listings
- Blocking does not notify the blocked user
- Blocking immediately blocks new DMs between the two users; existing message history stays visible to both

---

## 10. Admin workflow (MVP)

**Tools:** `app/admin/moderation.tsx` (reports + paused listings), `app/admin/link-health.tsx` (strike confirmation queue), `app/admin/banned-keywords.tsx`, audit trail in `moderation_actions`.

**Daily routine (5–10 min at seed stage):**

1. Review open reports (excluding link-health issues, which have their own queue)
2. Review the link-health queue for issues past their grace period
3. Remove confirmed content violations; escalate confirmed AI-generated content straight to ban
4. Ban repeat offenders / confirm strikes that push a seller past the ban threshold
5. Note false reports/false-positive link checks dismissed

---

## 11. User-generated content policy

- Seller is responsible for the accuracy of listing content, license text, and asset compatibility claims
- Platform may remove any listing without notice for a policy violation
- No formal appeals process in MVP — email support only

See `13-Legal_and_Compliance.md` and the legal stack in `docs/legal/`.

---

## 12. Metrics

| Metric | Target |
|--------|--------|
| Open reports age (excluding link-health queue, which runs on its own grace-period SLA) | < 24h |
| % listings reported / week | < 2% |
| Link-health issues resolved within grace period (no strike needed) | Track weekly — a high resolve-in-grace rate means the pipeline is doing its job without punitive strikes |
| Ban rate (both ladders combined) | Track weekly, split AI-content direct-bans from warn-first-ladder bans |

---

## 13. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.2 | 2026-05-22 to 2026-07 | Original hyperlocal-marketplace moderation system (prohibited physical items, meetup safety copy, college-verification-adjacent rate limits — superseded) |
| 2.0 | 2026-07-21 | Full rewrite for VtuberMarketplace: new report reasons (`ai_generated_content`, `download_link_not_working`, `stolen_content`), AI-content direct-to-ban path contrasted with the standard warn-first ladder, mature-content age-gating rules, the strike/link-health confirmation queue as a moderation surface, VTuber-domain banned-keyword list; removed meetup-safety and college-verification content entirely |
| 2.1 | 2026-07-21 | Corrected the report-driven auto-pause status literal from `paused` to `paused_pending_review` to match migration 121's enum reuse (no new `paused` value was added to `listing_status`) |
