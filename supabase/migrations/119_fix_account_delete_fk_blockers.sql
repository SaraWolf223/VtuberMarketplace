-- Full-audit pass (Phase 6 live testing): delete-account (self-service account
-- deletion, required for Apple/Google Store compliance) calls
-- admin.auth.admin.deleteUser(userId), which relies on profiles.id's
-- ON DELETE CASCADE from auth.users to remove the profile row. Postgres must
-- also satisfy every OTHER foreign key pointing at that profiles(id) row
-- before the cascade can complete. Several audit-trail columns were created
-- with no ON DELETE action (Postgres default: NO ACTION, i.e. RESTRICT),
-- so account deletion fails outright — not just for staff, but for any
-- ordinary user who was ever the *target* of a moderation action (warned,
-- banned, etc. — even a false-positive later reversed):
--
--   - moderation_actions.admin_id       (blocks deleting a staff member who
--                                         ever warned/banned/deleted anything)
--   - moderation_actions.target_user_id (blocks deleting ANY user who was
--                                         ever the subject of a mod action)
--   - reports.reviewed_by               (blocks deleting a staff member who
--                                         ever reviewed a report)
--   - seed_payouts.approved_by/paid_by  (blocks deleting a staff member who
--                                         ever approved/paid a seed payout)
--   - email_campaigns.admin_id          (blocks deleting a staff member who
--                                         ever sent a bulk email campaign)
--
-- This mirrors the exact bug already fixed for moderation_actions.listing_id
-- in migration 104 — same class of issue, different columns. Fix: ON DELETE
-- SET NULL everywhere, matching the established pattern (audit rows survive,
-- attribution just goes blank), and drop the NOT NULL on admin_id columns
-- that require it so NULL is actually storable.

ALTER TABLE moderation_actions
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_admin_id_fkey;
ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_target_user_id_fkey;
ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_reviewed_by_fkey;
ALTER TABLE reports
  ADD CONSTRAINT reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE seed_payouts
  DROP CONSTRAINT IF EXISTS seed_payouts_approved_by_fkey;
ALTER TABLE seed_payouts
  ADD CONSTRAINT seed_payouts_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE seed_payouts
  DROP CONSTRAINT IF EXISTS seed_payouts_paid_by_fkey;
ALTER TABLE seed_payouts
  ADD CONSTRAINT seed_payouts_paid_by_fkey
  FOREIGN KEY (paid_by) REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE email_campaigns
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_admin_id_fkey;
ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES profiles (id) ON DELETE SET NULL;
