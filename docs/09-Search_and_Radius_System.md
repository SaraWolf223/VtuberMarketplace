# RETIRED — Search and Radius System

**Version:** 2.0 (retired)
**Status:** This document is a stub. It is intentionally kept in place (not deleted) to preserve history and avoid dangling references, but it no longer describes an active system.

---

## What this doc used to cover

This document originally specified the **ZIP + radius geo-discovery system** for the original hyperlocal, physical-goods marketplace prototype: ZIP-code geocoding (Mapbox), `GEOGRAPHY(POINT)` columns + PostGIS `ST_DWithin`/`ST_Distance` queries, admin-configurable radius options, and a "near me" feed filtered by distance.

## Why it's retired

**VtuberMarketplace is a global digital catalog, not a hyperlocal marketplace.** There is no local/geo discovery of any kind — every listing is visible to every buyer worldwide, filtered by category, license type, price, asset type, compatible software, file format, and mature-content toggle instead of distance. The `postgis` extension, `zip_centroids` table, and all `location`/`home_zip`/`radius_miles` columns are dropped (see `03-Database_Schemas.md` §3.2, §3.3, §1).

## Where to look instead

- **`01-PRD.md` §10 ("Discovery, no geo/radius")** — the current discovery model and filter set
- **`04-API_Endpoints.md` §6 (`get_feed_listings`)** — the feed/search RPC contract that replaced the old geo-filtered feed query
- **`15-MVP_vs_Future_Features.md` §3** — ZIP/radius discovery is listed there as a retired, not-applicable-to-this-domain concept (not a deferred future feature)

---

## Revision history

| Version | Date | Changes |
|---------|------|---------|
| 1.1–1.2 | 2026-05-22 to 2026-07-13 | Original hyperlocal-marketplace ZIP + radius geo-discovery spec (superseded) |
| 2.0 | 2026-07-21 | Retired — replaced with this stub; VtuberMarketplace is a global digital catalog with no geo discovery |
