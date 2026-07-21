# VtuberMarketplace — Storage, Digital Delivery, and Strike System

**Version:** 2.0
**Goal:** Minimize Supabase Storage cost for preview images (unchanged mechanism); guarantee accountable, working seller-hosted download links for the assets actually being sold (new — this is the biggest change from the physical-marketplace version of this doc).

**Scope split:**

- **§1–§3: Preview image storage** — the platform-hosted listing photo bucket. Mechanism is unchanged from the original build.
- **§4–§9: Digital delivery & the strike system** — the platform *never* stores the sold asset file (`listings.download_url` / `order_deliverables.deliverable_url` point at the seller's own hosting). This section covers how the platform verifies those seller-hosted links stay healthy and holds sellers accountable when they don't.
- **§10: Draft cleanup** — the only "purge" job that survives from the old fixed-expiry system, and it's unrelated to expiry (listings no longer expire at all — see `01-PRD.md` §9).

---

## 1. Preview image storage architecture

| Bucket | Access | Path |
|--------|--------|------|
| `listing-images` | Public read | `{seller_id}/{listing_id}/{sort_order}.webp` |
| Thumbnails | Public read | `{seller_id}/{listing_id}/{sort_order}_thumb.webp` |

This bucket holds **only preview photos** of the listing (screenshots/renders of the asset) — never the sold file itself. The sold asset is delivered exclusively via `listings.download_url` (or `order_deliverables.deliverable_url` for add-on orders), both pointing at the seller's own hosting (Google Drive, Dropbox, Mega, itch.io, personal host, etc.). See `01-PRD.md` §5.2.

---

## 2. Preview image upload pipeline

### 2.1 Client compression

```typescript
// src/lib/image-compress.ts
// - Pick image
// - Resize max width 1200px
// - Compress quality 0.7 WebP
// - If still > 2MB, reduce quality to 0.5
// - Strip EXIF metadata (GPS, device) before upload — privacy
// - Throw if still > 2MB
```

Use **TUS resumable upload** (Supabase) if the compressed file is still >6MB (edge case).

### 2.2 Upload steps

1. `create-listing` returns signed URLs per `sort_order`
2. Client PUT to Storage
3. `finalize-listing-images` records metadata in `listing_images`, and now enforces a **minimum of 3** images (raised from 1) alongside the existing maximum of 5, before the listing can move out of `draft`

### 2.3 Thumbnails

**Option A (in use):** client generates a 400px thumbnail and uploads both files alongside the full-size image.
**Option B (deferred):** edge image transform on read — not worth the added complexity at current scale.

---

## 3. Preview image limits (enforced)

| Limit | Layer |
|-------|-------|
| Min 3 / max 5 images | Client + DB `listings.image_count` CHECK (`>= 3 AND <= 5`) |
| Max 2MB/file | Client + bucket policy |
| Formats jpg/png/webp | Bucket MIME policy |
| Max resolution 1200px width | Client |

---

## 4. Digital delivery model

### 4.1 Principle

The platform is a **facilitator, not a file host**. `listings.download_url` (delivered immediately on a no-add-on order) and `order_deliverables.deliverable_url` (submitted by the seller once a customization/setup add-on order is complete) are both plain URLs into the seller's own file hosting. The platform:

- **Never** downloads, mirrors, caches, or proxies the sold file
- **Never** scans the sold file's contents (only the storefront preview images and video are moderated — see `12-Moderation_and_Safety.md`)
- **Does** periodically verify the *link itself* resolves (§5) and holds the seller accountable via strikes if it stops working (§6–§7)

### 4.2 Delivery paths

| Order type | Delivery mechanism | Timing |
|---|---|---|
| No add-ons selected | Buyer's Library shows `listings.download_url` directly | Immediately on `checkout.session.completed` |
| Customization and/or setup add-on(s) selected | Seller must submit a deliverable via the seller-scoped `order_deliverables` RPC | On order reaching `awaiting_fulfillment`; buyer sees "awaiting fulfillment" until the seller submits |

---

## 5. Link health checks

### 5.1 Scheduled check (`check-listing-links` cron, every 6h)

For every `active` listing's `download_url`, and every open (non-terminal) order's `order_deliverables.deliverable_url`:

1. HTTP HEAD (fallback GET if HEAD unsupported) request to the URL
2. Record `last_checked_at`, `last_status_code` on `link_health_checks`
3. On failure (non-2xx, timeout, DNS failure): increment `consecutive_failures`; if this is the first failure, open an issue — `issue_open = true`, `grace_period_ends_at = now() + link_health_grace_period_hours` (config, default 48h)
4. On success after a prior failure: reset `consecutive_failures = 0`, close the issue (`issue_open = false`) — the seller fixed it in time, no strike

### 5.2 Buyer-reported issue

A buyer can report **"Download link not working"** from their Library against a specific order (`reports.reason = 'download_link_not_working'`, `reports.order_id` set). This opens or extends a `link_health_checks` row the same way an automated failure does (same grace-period pipeline, §6) — a buyer report is just an alternate trigger into the same pipeline, distinguished by `link_health_checks`/`seller_strikes.source = 'buyer_report'` vs `'automated_check'`.

### 5.3 Scope — paid link only

Strikes and the grace-period pipeline apply **only** to the paid download/deliverable link. A broken YouTube demo video is a separate, lower-severity concern (§8) — it degrades the buyer's pre-purchase experience but doesn't affect anyone who already paid, so it is never a strike.

---

## 6. Grace-period pipeline

```
Issue opens (automated failure OR buyer report)
  → issue_open = true, grace_period_ends_at = now() + grace period (default 48h)
  → Seller notified (email + in-app) with the affected listing/order and a deadline
  → Seller fixes the link (updates download_url / re-submits order_deliverables)
       → next check succeeds → issue closes automatically, no strike, no admin involvement
  → OR grace period elapses with the issue still open
       → Issue routes to the admin strike-confirmation queue (§7) — NOT an automatic strike
```

The grace period exists so a seller who's traveling or whose cloud-storage link expired gets a fair chance to fix it before any penalty. `public_app_config.link_health_grace_period_hours` is admin-configurable.

---

## 7. Admin confirmation queue → strikes

A human admin reviews every issue that survives the grace period before a strike is recorded — this is a deliberate manual gate, not an automatic penalty, since automated checks can false-positive (seller's host temporarily rate-limiting, a transient outage, etc.):

```
Admin → Moderation → Link health queue
  → Confirm broken → insert seller_strikes row (source, listing_id, reason, confirmed_by = admin, expires_at = now() + strike_expiry_months)
                   → listings.status auto-paused if still active
  → Confirm fixed / false positive → close issue, no strike
```

### 7.1 Strike expiry & ban threshold

- Each strike expires **12 months** after issue (`public_app_config.strike_expiry_months`, rolling window — not a calendar reset)
- Active strike count = `COUNT(*) FROM seller_strikes WHERE seller_id = ? AND expires_at > now()`
- **3 active strikes** (`public_app_config.strike_ban_threshold`) → automatic account ban, reusing the existing ban infrastructure (`banned_at`)

### 7.2 Auto-pause on confirmed strike

A confirmed strike against a still-`active` listing sets `listings.status = 'paused'` (delisted from the feed, not deleted — the seller can fix the link and request an admin/automated re-check via `recheck-listing-link` to restore it to `active`). A `paused` listing that never gets fixed simply stays paused; there's no separate purge tied to `paused` status (contrast with §10's unrelated draft cleanup).

---

## 8. YouTube demo video health (separate from strikes)

- Submission-time validation (oEmbed + YouTube Data API v3 `videos.list` for `embeddable`/`madeForKids`) happens in `validate-youtube-video`, called from the listing create/edit flow — see `21-Edge_Functions_Spec.md`
- Ongoing re-check is oEmbed-only (`check-youtube-videos` cron, daily) — the Data API call is submission-time-only to conserve the daily quota (1 unit/call)
- A dead video sets `listings.youtube_video_status = 'removed'` and auto-flags the listing for the seller to fix (banner in seller dashboard, listing stays otherwise live)
- **This never writes a `seller_strikes` row** — it's a quality flag on the pre-purchase experience, not a penalty on a paid transaction

---

## 9. Reports/removal, unrelated to strikes

Admin removal of a listing for a non-link reason (banned content, keyword violation, etc. — see `12-Moderation_and_Safety.md`) is independent of this pipeline:

1. `status = 'deleted'` immediately
2. Preview images queued for storage delete within 24h (or immediate purge in the admin-action edge function)
3. This does **not** touch `seller_strikes` — content removal and link-health strikes are tracked separately since they represent different kinds of seller accountability

---

## 10. Stale draft cleanup (unrelated to the retired expiry system)

There is **no fixed listing expiry** in this domain (`01-PRD.md` §9) — an `active` listing stays live until unpublished, sold (OTU), or auto-paused by §7. The only surviving cleanup job is for **abandoned drafts**, which is a storage-hygiene concern, not a lifecycle/expiry one:

**Cron:** `purge_stale_drafts`, daily 02:00 UTC

```
FOR each listing WHERE status = 'draft' AND draft_created_at < now() - interval '24 hours':
  1. List all storage paths from listing_images
  2. Delete storage objects (batch)
  3. DELETE listing_images rows
  4. DELETE the listing row
  5. Log count to a cron log table
```

**Idempotent:** safe to re-run; missing storage files are ignored. This is the same mechanism the original build used for orphan-upload cleanup — only the *reason* a listing gets cleaned up (abandoned draft, not "expired") has changed, since `expires_at`/`purge_at` are dropped columns (`03-Database_Schemas.md` §3.3).

---

## 11. Orphan prevention

| Risk | Mitigation |
|------|------------|
| Draft listing without finalize | §10 cron deletes drafts > 24h old |
| Upload without finalize | Same cron removes the draft row + its storage prefix |
| DB row deleted without storage cleanup | Admin removal / draft cleanup always deletes storage objects as part of the same job |
| Seller-hosted asset link rot | Not a platform storage problem by design — handled entirely by the strike system (§5–§7), never by the platform mirroring the file |

---

## 12. CDN / caching

- Public preview-image bucket URLs are cacheable
- Feed uses `_thumb.webp` only
- Listing detail uses the full image
- The platform sets no cache headers on seller-hosted delivery URLs — those are entirely outside platform infrastructure

---

## 13. Cost estimates (preview images only)

| Scale | Images | Est. storage |
|-------|--------|---------------|
| Seed catalog (500 listings × 3 imgs avg × 300KB) | 1,500 images | ~450 MB |
| 10k listings × 4 imgs avg × 300KB | 40,000 images | ~12 GB |

There is **no** delivery/bandwidth cost for sold assets — that traffic never touches platform infrastructure, since sellers host their own files (`01-PRD.md` §5.2, §3.3 of the PRD cost targets table).

---

## 14. Monitoring

- Weekly Supabase Storage dashboard review (preview images)
- Alert if the preview-image bucket exceeds 20GB
- Weekly review of the `link_health_checks` open-issue count and average grace-period-to-resolution time — a leading indicator of catalog link rot
- Monthly review of `seller_strikes` volume vs ban threshold — flags if the grace period or confirmation queue is under- or over-triggering

---

## 15. Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-05-22 | Original hyperlocal-marketplace storage/expiry system (tiered expiry, purge-at-day-28, superseded) |
| 2.0 | 2026-07-21 | Full rewrite for VtuberMarketplace: retired the fixed listing-expiry/purge pipeline entirely; added the seller-hosted digital delivery model, link-health-check scheduling, grace-period pipeline, admin strike-confirmation queue, and 12-month rolling strike expiry; kept preview-image storage mechanism and stale-draft cleanup unchanged |
