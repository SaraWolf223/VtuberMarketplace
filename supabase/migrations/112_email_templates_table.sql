-- Admin-editable email templates (Phase 4 of the white-label plan). Lets a
-- buyer customize the wording of every transactional/ops email the platform
-- sends without touching code. Edge functions render `{{placeholder}}` tokens
-- (see supabase/functions/_shared/email-templates.ts) with the hardcoded
-- current copy kept as the fallback default if a row is missing/blank.
--
-- Admin-only: these are internal operational templates (some contain
-- moderation/ops detail), not public app config — no anon/public SELECT.

CREATE TABLE email_templates (
  event_key TEXT PRIMARY KEY CHECK (event_key ~ '^[a-z][a-z0-9_]{0,59}$'),
  -- Human-readable description of what triggers this email + which
  -- {{placeholder}} tokens are available, shown in the admin CRUD screen.
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body_text TEXT NOT NULL CHECK (char_length(body_text) BETWEEN 1 AND 4000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_admin_all ON email_templates
  FOR ALL
  TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

INSERT INTO email_templates (event_key, description, subject, body_text) VALUES
  (
    'college_otp_code',
    'Sent to a user verifying a .edu email for the college badge. Placeholders: {{code}}',
    'Your {{app_name}} college verification code',
    'Your verification code is {{code}}. It expires in 15 minutes.'
  ),
  (
    'waitlist_signup_admin',
    'Sent to the support inbox when someone joins the web waitlist. Placeholders: {{email}} {{zip}} {{role}} {{platform}} {{source}} {{ref}} {{founding_code}} {{joined_at}} {{total_line}}',
    'New waitlist signup — {{zip}} ({{platform}})',
    'A new person joined the {{app_name}} waitlist.' || chr(10) || chr(10) ||
    'Email: {{email}}' || chr(10) ||
    'ZIP: {{zip}}' || chr(10) ||
    'Role: {{role}}' || chr(10) ||
    'Platform: {{platform}}' || chr(10) ||
    'Source: {{source}}' || chr(10) ||
    'Referred by: {{ref}}' || chr(10) ||
    'Founding code: {{founding_code}}' || chr(10) ||
    'Joined: {{joined_at}}{{total_line}}'
  ),
  (
    'ios_waitlist_signup_admin',
    'Sent to the support inbox when someone joins the iPhone waitlist. Placeholders: {{email}} {{zip}} {{source}} {{joined_at}}',
    'New iPhone waitlist signup — {{zip}}',
    'A new person joined the {{app_name}} iPhone waitlist.' || chr(10) || chr(10) ||
    'Email: {{email}}' || chr(10) ||
    'ZIP: {{zip}}' || chr(10) ||
    'Source: {{source}}' || chr(10) ||
    'Joined: {{joined_at}}'
  ),
  (
    'new_report_admin',
    'Sent to the support inbox on every new report. Placeholders: {{report_id}} {{reason}} {{target_line}} {{reporter_name}} {{reporter_id}} {{details}} {{auto_paused}} {{submitted_at}}',
    'New {{reason}} report',
    'A new report was submitted.' || chr(10) || chr(10) ||
    'Report ID: {{report_id}}' || chr(10) ||
    'Reason: {{reason}}' || chr(10) ||
    '{{target_line}}' || chr(10) ||
    'Reporter: {{reporter_name}} ({{reporter_id}})' || chr(10) ||
    'Details: {{details}}' || chr(10) ||
    'Auto-paused listing: {{auto_paused}}' || chr(10) ||
    'Submitted: {{submitted_at}}'
  ),
  (
    'new_report_staff',
    'Redacted staff-channel copy of the new-report email (no reporter email/phone). Placeholders: {{reason}} {{target_line}} {{auto_paused}}',
    'New {{reason}} report',
    'A new report needs review.' || chr(10) || chr(10) ||
    'Reason: {{reason}}' || chr(10) ||
    '{{target_line}}' || chr(10) ||
    'Auto-paused listing: {{auto_paused}}' || chr(10) ||
    'Open the moderation panel to review.'
  ),
  (
    'listing_removed_admin',
    'Sent to the support inbox when staff removes a listing. Placeholders: {{listing_id}} {{seller_id}} {{staff_id}} {{notes}} {{at}}',
    'Listing removed by staff',
    'A listing was removed by staff.' || chr(10) || chr(10) ||
    'Listing ID: {{listing_id}}' || chr(10) ||
    'Seller ID: {{seller_id}}' || chr(10) ||
    'By staff ID: {{staff_id}}' || chr(10) ||
    'Notes: {{notes}}' || chr(10) ||
    'At: {{at}}'
  ),
  (
    'listing_removed_staff',
    'Redacted staff-channel copy of the listing-removed email. Placeholders: {{listing_id}} {{seller_id}} {{notes}} {{at}}',
    'Listing removed by staff',
    'A listing was removed by staff.' || chr(10) || chr(10) ||
    'Listing ID: {{listing_id}}' || chr(10) ||
    'Seller ID: {{seller_id}}' || chr(10) ||
    'Notes: {{notes}}' || chr(10) ||
    'At: {{at}}'
  ),
  (
    'user_banned_admin',
    'Sent to the support inbox when staff bans a user. Placeholders: {{user_name}} {{user_id}} {{by_name}} {{by_id}} {{notes}} {{report_id}} {{at}}',
    'User banned — {{user_name}}',
    'A user was banned.' || chr(10) || chr(10) ||
    'User: {{user_name}} ({{user_id}})' || chr(10) ||
    'By: {{by_name}} ({{by_id}})' || chr(10) ||
    'Reason / notes: {{notes}}' || chr(10) ||
    'Report: {{report_id}}' || chr(10) ||
    'At: {{at}}'
  ),
  (
    'user_banned_staff',
    'Redacted staff-channel copy of the user-banned email. Placeholders: {{user_name}} {{user_id}} {{by_name}} {{notes}} {{at}}',
    'User banned — {{user_name}}',
    'A user was banned.' || chr(10) || chr(10) ||
    'User: {{user_name}} ({{user_id}})' || chr(10) ||
    'By: {{by_name}}' || chr(10) ||
    'Reason: {{notes}}' || chr(10) ||
    'At: {{at}}'
  ),
  (
    'account_deleted_admin',
    'Sent to the support inbox when a user permanently deletes their account. Placeholders: {{user_id}} {{name}} {{email}} {{listings_removed}} {{at}}',
    'Account deleted',
    'A user permanently deleted their account.' || chr(10) || chr(10) ||
    'User ID: {{user_id}}' || chr(10) ||
    'Name: {{name}}' || chr(10) ||
    'Email: {{email}}' || chr(10) ||
    'Listings removed: {{listings_removed}}' || chr(10) ||
    'At: {{at}}'
  ),
  (
    'daily_digest_admin',
    'Once-daily ops summary sent to the support inbox by the staff-notify-digest cron. Placeholders: {{date}} {{new_users}} {{new_listings}} {{new_waitlist}} {{open_reports}} {{generated_at}}',
    '{{app_name}} daily digest — {{date}}',
    'Activity in the last 24 hours:' || chr(10) || chr(10) ||
    'New users: {{new_users}}' || chr(10) ||
    'New listings: {{new_listings}}' || chr(10) ||
    'New waitlist signups: {{new_waitlist}}' || chr(10) ||
    chr(10) || 'Backlog:' || chr(10) ||
    'Open reports awaiting review: {{open_reports}}' || chr(10) ||
    chr(10) || 'Generated: {{generated_at}}'
  )
ON CONFLICT (event_key) DO NOTHING;
