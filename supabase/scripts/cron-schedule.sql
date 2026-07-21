-- Optional pg_cron jobs for Local Marketplace (Supabase Dashboard → Database → Extensions → pg_cron).
-- Run after migrations are applied. Adjust times to your timezone preference.

-- Mark listings expired when past expires_at (see expire_due_listings in 031_expire_listings_daily.sql)
SELECT cron.schedule(
  'localmarketplace-expire-listings-daily',
  '0 4 * * *',
  $$SELECT expire_due_listings()$$
);

-- Alternative: invoke edge functions on a schedule (requires pg_net + vault secrets):
-- POST https://<project>.supabase.co/functions/v1/purge-expired-listings
-- Header: Authorization: Bearer <CRON_SECRET>

-- Daily staff digest email (new users / listings / waitlist + open-report backlog).
-- Edge function staff-notify-digest; invoke via pg_net with the CRON_SECRET bearer.
-- Runs 08:00 UTC daily. Replace <project> + set the CRON_SECRET in the request.
-- SELECT cron.schedule(
--   'localmarketplace-staff-digest-daily',
--   '0 8 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/staff-notify-digest',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );
