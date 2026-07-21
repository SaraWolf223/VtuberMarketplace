// Staff / admin email notifications for platform events.
//
// Channels (per docs/34-Store_Accounts_and_Launch_Readiness.md §E):
//   - admin  → SUPPORT_EMAIL (support@yourdomain.com). May include full detail / user email.
//   - staff  → every profiles.email where role IN ('admin','manager').
//              MUST be redacted: user id + display name only, never user email/phone
//              (matches manager email-redaction hardening, migrations 101/102 + S-FIX-1).
//
// Sending reuses the Resend integration in _shared/bulk-email.ts. This helper never
// throws to its caller — email delivery must not block or fail the originating action.

import { sendBulkEmails, normalizeRecipientList } from './bulk-email.ts';
import { createSupabaseAdmin } from './supabaseAdmin.ts';

export type StaffEvent =
  | 'waitlist_signup'
  | 'new_user'
  | 'new_report'
  | 'listing_removed'
  | 'user_banned'
  | 'account_deleted'
  | 'daily_digest';

type Channel = 'admin' | 'staff';

// Which channel(s) each event reaches. High-signal events go out immediately;
// high-volume signals (new users, new listings) are rolled into the once-daily
// `daily_digest` (see staff-notify-digest edge function) instead of paging on each.
const ROUTES: Record<StaffEvent, Channel[]> = {
  waitlist_signup: ['admin'],
  new_report: ['admin', 'staff'],
  listing_removed: ['admin', 'staff'],
  user_banned: ['admin', 'staff'],
  account_deleted: ['admin'],
  new_user: ['admin'],
  daily_digest: ['admin'],
};

export type NotifyStaffInput = {
  event: StaffEvent;
  subject: string;
  /** Full detail for the admin (support@) channel — may include user email. */
  adminBody: string;
  /**
   * Redacted body for the staff channel (id + display name only, no user email/phone).
   * Required when the event routes to 'staff'; if missing there, the staff send is skipped.
   */
  staffBody?: string;
};

function supportEmail(): string {
  return Deno.env.get('SUPPORT_EMAIL')?.trim() || 'support@yourdomain.com';
}

async function staffRecipients(): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('email')
    .in('role', ['admin', 'manager'])
    .not('email', 'is', null);

  if (error) {
    console.error('[staff-notify] failed to load staff recipients:', error.message);
    return [];
  }

  return normalizeRecipientList((data ?? []).map((r) => (r as { email: string }).email));
}

/**
 * Fan a platform event out to the configured email channels.
 * Swallows all errors (logs them) so callers can fire-and-forget.
 */
export async function notifyStaff(input: NotifyStaffInput): Promise<void> {
  try {
    const routes = ROUTES[input.event] ?? ['admin'];

    if (routes.includes('admin')) {
      try {
        await sendBulkEmails([supportEmail()], input.subject, input.adminBody);
      } catch (e) {
        console.error('[staff-notify] admin channel send failed:', e);
      }
    }

    if (routes.includes('staff')) {
      if (!input.staffBody) {
        console.error(
          `[staff-notify] event "${input.event}" routes to staff but no staffBody provided; skipping staff channel`
        );
      } else {
        try {
          const recipients = await staffRecipients();
          if (recipients.length > 0) {
            await sendBulkEmails(recipients, input.subject, input.staffBody);
          }
        } catch (e) {
          console.error('[staff-notify] staff channel send failed:', e);
        }
      }
    }
  } catch (e) {
    console.error('[staff-notify] unexpected failure:', e);
  }
}
