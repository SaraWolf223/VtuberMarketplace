# Local Marketplace — Analytics and Growth

**Version:** 1.1

---

## 1. North star metric

**Listings per day in active seed city** (target ZIP cluster).

---

## 2. Secondary metrics (weekly)

| Metric | Why |
|--------|-----|
| **Supply/demand ratio** | `active_listings / WAU_buyers` per ZIP — avoid ghost towns |
| **Contact rate** | `contact_tapped / listing_viewed` |
| **D7 retention** | PMF signal — target **≥40%** aspirational |
| **Repeat sellers** | Users with 2+ listings in 30 days |
| **Empty feed rate** | `feed_empty_shown / feed_viewed` |
| **Report rate** | Reports per 100 listings — alert if >2% |
| Boost conversion | `boost_purchased / active_sellers` |
| MRR | Premium subscribers |

---

## 3. Analytics provider (MVP)

| Status | Choice |
|--------|--------|
| **Decided for build** | **PostHog** (free tier) — retention + funnels |
| Fallback | Expo Insights stub until keys added |

```typescript
// src/lib/analytics.ts
export function track(event: string, properties?: Record<string, unknown>): void;
```

---

## 4. Core funnels

### 4.1 Activation (all users)

```
app_opened → onboarding_completed → sign_up_completed (google)
  → location_set → first_feed_view
```

### 4.2 Buyer funnel

```
feed_viewed → listing_viewed → contact_tapped
```

Track drop-off at each step per ZIP and radius.

### 4.3 Seller funnel

```
listing_started → listing_published → (optional) boost_purchased
```

### 4.4 Boost ROI

```
boost_purchased → listing_viewed (same listing, 24h window) — compare to pre-boost baseline
```

---

## 5. Event catalog

### 5.1 Acquisition

| Event | Properties |
|-------|------------|
| `app_opened` | platform, version |
| `onboarding_completed` | — |
| `sign_up_completed` | provider: `google` |

### 5.2 Activation

| Event | Properties |
|-------|------------|
| `location_set` | zip, radius_miles |
| `first_listing_created` | listing_id, category |
| `first_feed_view` | results_count |

### 5.3 Engagement

| Event | Properties |
|-------|------------|
| `feed_viewed` | results_count, radius, zip_cluster |
| `listing_viewed` | listing_id, distance_miles |
| `listing_favorited` | listing_id |
| `contact_tapped` | listing_id |
| `phone_revealed` | listing_id |
| `search_performed` | query_length, results |

### 5.4 Monetization

| Event | Properties |
|-------|------------|
| `boost_checkout_started` | listing_id |
| `boost_purchased` | listing_id, amount, source |
| `premium_viewed` | — |
| `premium_subscribed` | — |
| `ad_impression` | placement |

### 5.5 Trust & safety

| Event | Properties |
|-------|------------|
| `report_submitted` | reason, target_type |
| `user_blocked` | — |

### 5.6 Health

| Event | Properties |
|-------|------------|
| `feed_empty_shown` | zip, radius |

---

## 6. PostHog setup (MVP)

- **Retention insight:** start `sign_up_completed`, return `feed_viewed` or `listing_viewed`, weekly
- **Funnel:** buyer funnel §4.2
- **Dashboard:** city health — listings/day, empty feed %, contact rate
- **Feature stickiness:** `listing_created` vs `feed_viewed` cohorts

---

## 7. Privacy

- No email/phone in event properties
- UUIDs only for listing/user references

---

## 8. SQL (operator)

```sql
-- Listings per day
SELECT date_trunc('day', published_at) d, count(*)
FROM listings
WHERE zip_code LIKE '462%'
GROUP BY 1 ORDER BY 1;

-- Supply/demand rough proxy
SELECT count(*) FILTER (WHERE status = 'active') AS listings,
       count(DISTINCT seller_id) AS sellers
FROM listings
WHERE zip_code LIKE '462%';
```

---

## 9. Revision

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-05-22 | Funnels, supply/demand, D7 benchmark, boost ROI |
