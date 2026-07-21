-- Seed open reports for admin moderation queue testing.
-- Run in Supabase SQL Editor (same project as the app) or:
--   npx supabase db query --linked -f supabase/scripts/seed-moderation-queue.sql
--
-- Safe to re-run: skips duplicates (same open report already pending).

-- ─── Open listing reports (up to 8) ───────────────────────────────────────────
WITH active_listings AS (
  SELECT
    l.id AS listing_id,
    l.seller_id,
    l.title,
    ROW_NUMBER() OVER (ORDER BY l.created_at DESC) AS rn
  FROM listings l
  WHERE l.status = 'active'
  LIMIT 8
),
report_rows AS (
  SELECT
    al.listing_id,
    al.seller_id,
    al.rn,
    (
      SELECT p.id
      FROM profiles p
      WHERE p.id <> al.seller_id
        AND p.banned_at IS NULL
      ORDER BY md5(p.id::text || al.listing_id::text)
      LIMIT 1
    ) AS reporter_id,
    (ARRAY[
      'scam'::report_reason,
      'spam'::report_reason,
      'prohibited_item'::report_reason,
      'misleading'::report_reason,
      'counterfeit'::report_reason,
      'stolen'::report_reason,
      'other'::report_reason
    ])[1 + (al.rn % 7)] AS reason
  FROM active_listings al
)
INSERT INTO reports (
  reporter_id,
  target_type,
  listing_id,
  reason,
  details,
  status,
  created_at
)
SELECT
  rr.reporter_id,
  'listing'::report_target_type,
  rr.listing_id,
  rr.reason,
  'Moderation seed — listing report #' || rr.rn::text || ' (' || LEFT(al.title, 40) || ')',
  'open'::report_status,
  NOW() - (rr.rn || ' hours')::interval
FROM report_rows rr
JOIN active_listings al ON al.listing_id = rr.listing_id
WHERE rr.reporter_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM reports r
    WHERE r.listing_id = rr.listing_id
      AND r.reporter_id = rr.reporter_id
      AND r.status = 'open'
  );

-- ─── Open user reports (up to 3) ──────────────────────────────────────────────
WITH sellers AS (
  SELECT
    p.id AS reported_user_id,
    p.username,
    ROW_NUMBER() OVER (ORDER BY p.created_at DESC) AS rn
  FROM profiles p
  WHERE p.banned_at IS NULL
  LIMIT 5
),
user_report_rows AS (
  SELECT
    s.reported_user_id,
    s.username,
    s.rn,
    (
      SELECT p.id
      FROM profiles p
      WHERE p.id <> s.reported_user_id
        AND p.banned_at IS NULL
      ORDER BY md5(p.id::text || s.reported_user_id::text)
      LIMIT 1
    ) AS reporter_id,
    (ARRAY[
      'harassment'::report_reason,
      'spam'::report_reason,
      'scam'::report_reason
    ])[1 + (s.rn % 3)] AS reason
  FROM sellers s
  WHERE s.rn <= 3
)
INSERT INTO reports (
  reporter_id,
  target_type,
  reported_user_id,
  reason,
  details,
  status,
  created_at
)
SELECT
  urr.reporter_id,
  'user'::report_target_type,
  urr.reported_user_id,
  urr.reason,
  'Moderation seed — user report on @' || urr.username,
  'open'::report_status,
  NOW() - (urr.rn || ' hours')::interval
FROM user_report_rows urr
WHERE urr.reporter_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM reports r
    WHERE r.reported_user_id = urr.reported_user_id
      AND r.reporter_id = urr.reporter_id
      AND r.status = 'open'
  );

-- ─── Summary ─────────────────────────────────────────────────────────────────
SELECT 'open_reports' AS metric, COUNT(*)::int AS count
FROM reports WHERE status = 'open';
