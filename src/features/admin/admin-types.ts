export type AdminActionPayload =
  | { action: 'unpause_listing'; listing_id: string; notes?: string }
  | { action: 'pause_listing'; listing_id: string; notes?: string }
  | { action: 'delete_listing'; listing_id: string; notes?: string }
  | { action: 'ban_user'; user_id: string; report_id?: string; notes?: string }
  | { action: 'unban_user'; user_id: string; notes?: string }
  | { action: 'warn_user'; user_id: string; report_id?: string; notes?: string }
  | { action: 'dismiss_reports'; listing_id?: string; report_id?: string; notes?: string }
  | { action: 'purge_orphan_reports' }
  | { action: 'shadow_ban_user'; user_id: string; notes?: string }
  | { action: 'unshadow_ban_user'; user_id: string; notes?: string }
  | { action: 'grant_premium'; user_id: string; premium_months?: number | null; notes?: string }
  | { action: 'revoke_premium'; user_id: string; notes?: string }
  | { action: 'extend_listing_expiry'; listing_id: string; extend_days?: number; notes?: string }
  | { action: 'approve_seed_listing'; listing_id: string; notes?: string }
  | { action: 'revoke_seed_approval'; listing_id: string; notes?: string }
  | { action: 'mark_seed_paid'; listing_id: string; notes?: string };

export type AdminActionResult = Record<string, unknown>;

/** Staff-only read of a moderation target's current enforcement state. */
export type ModerationTargetState = {
  id: string;
  role: 'user' | 'manager' | 'admin' | string;
  banned_at: string | null;
  shadow_banned: boolean;
};

export type SeedListingRow = {
  listing_id: string;
  title: string;
  price: number;
  status: string;
  thumb_path: string | null;
  expires_at: string | null;
  created_at: string;
  approved: boolean;
  paid: boolean;
};

export type SeedSellerGroup = {
  seller_id: string;
  username: string;
  display_name: string;
  is_premium: boolean;
  premium_until: string | null;
  approved_count: number;
  paid_count: number;
  listings: SeedListingRow[];
};

export type AdminPlatformSettings = {
  boost_duration_hours: number;
  boost_base_cents: number;
  reports_per_hour: number;
  pause_reports_24h: number;
  pause_reports_lifetime: number;
};

export const DEFAULT_ADMIN_PLATFORM_SETTINGS: AdminPlatformSettings = {
  boost_duration_hours: 24,
  boost_base_cents: 100,
  reports_per_hour: 5,
  pause_reports_24h: 10,
  pause_reports_lifetime: 50,
};

export type AdminPromoCodeType = 'free_boosts' | 'free_premium_month' | 'founding_seller';

export type AdminPromoCodeInput = {
  code: string;
  type: AdminPromoCodeType;
  value: number;
  max_redemptions?: number | null;
  expires_at?: string | null;
};

export type AdminPromoCode = AdminPromoCodeInput & {
  id: string;
  redemption_count: number;
  active: boolean;
  created_at: string;
};

export type AdminManagePayload =
  | { action: 'get_settings' }
  | { action: 'update_settings'; settings: Partial<AdminPlatformSettings> }
  | ({ action: 'create_promo' } & AdminPromoCodeInput)
  | { action: 'deactivate_promo'; promo_id: string };

export type AdminManageResult = {
  settings?: AdminPlatformSettings;
  promo?: AdminPromoCode;
};

export type AdminPausedListing = {
  id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
  seller_id: string;
  listing_images: { thumb_path: string | null; storage_path: string; sort_order: number }[];
  profiles: { display_name: string; username: string } | null;
};

export type AdminReportProfile = {
  id: string;
  username: string;
  display_name: string;
};

export type AdminReportListing = {
  id: string;
  title: string;
  price: number;
  status: string;
  seller_id: string;
  listing_images: { thumb_path: string | null; storage_path: string; sort_order: number }[];
  seller: AdminReportProfile | null;
};

export type AdminReport = {
  id: string;
  target_type: 'listing' | 'user';
  listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  reporter_id: string;
  listing: AdminReportListing | null;
  reported_user: AdminReportProfile | null;
  reporter: { display_name: string } | null;
};

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  banned_at: string | null;
  shadow_banned?: boolean;
};

/** Manager staff directory — username only (no PII). */
export type StaffUsernameRow = Pick<
  AdminUserRow,
  'id' | 'username' | 'banned_at' | 'shadow_banned'
>;

export type StaffDirectoryUser = AdminUserRow | StaffUsernameRow;

export function staffUserHasEmail(user: StaffDirectoryUser): user is AdminUserRow {
  return 'email' in user && typeof user.email === 'string';
}

export type StaffUsersPage = AdminListPage<StaffDirectoryUser> & {
  limited: boolean;
};

export type AdminWarnedUser = {
  user_id: string;
  warning_count: number;
  last_warned_at: string;
  last_notes: string | null;
  // email is null for managers (redacted server-side; admins only) — migration 101
  profile:
    | (Pick<AdminUserRow, 'id' | 'username' | 'display_name' | 'banned_at'> & {
        email: string | null;
      })
    | null;
  is_banned: boolean;
};

// email is null for managers (redacted server-side; admins only) — migration 101
export type AdminBannedUser = Omit<AdminUserRow, 'email'> & { email: string | null };

export type AdminCollegeStudentRow = {
  id: string;
  // email is null for managers (redacted server-side; admins only) — migration 101
  email: string | null;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  banned_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  is_premium: boolean;
  premium_until: string | null;
  college_edu_email: string;
  college_badge_verified_at: string | null;
  college_badge_expires_at: string | null;
  badge_active: boolean;
};

export type RedeemPromoResult = {
  type: AdminPromoCodeType;
  boosts_remaining?: number;
  premium_until?: string;
  message: string;
};

export type AdminQueueTab = 'paused' | 'reports';

export type AdminBannedKeyword = {
  id: number;
  keyword: string;
  active: boolean;
};

export type AdminListingCategory = {
  slug: string;
  label: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
};

export type AdminEmailTemplate = {
  event_key: string;
  description: string;
  subject: string;
  body_text: string;
  updated_at: string;
};

export const ADMIN_LIST_PAGE_SIZE = 50;

export type AdminListPage<T> = {
  items: T[];
  nextOffset: number | null;
};

export type AdminSlaMetrics = {
  openReports: number;
  overdueReports: number;
  reviewedLast30Days: number;
  medianResponseHours: number | null;
  actionsLast7Days: number;
};

export type AdminModerationLogEntry = {
  id: string;
  action: string;
  created_at: string;
  notes: string | null;
  target_user_id: string | null;
  listing_id: string | null;
  report_id: string | null;
  // email is null for managers (redacted server-side; admins only) — migration 101
  admin: { display_name: string; email: string | null } | null;
};

export type AdminWaitlistSignup = {
  id: string;
  email: string;
  zip_code: string;
  role: string;
  founding_code: string;
  redeemed_at: string | null;
  created_at: string;
  source: string | null;
};

export type AdminIosWaitlistSignup = {
  id: string;
  email: string;
  zip_code: string | null;
  created_at: string;
  source: string | null;
};

export type BulkEmailAudience = 'waitlist' | 'users' | 'ios_waitlist';

export type BulkEmailPreview = {
  preview: true;
  audience: BulkEmailAudience;
  subject: string;
  recipient_count: number;
};

export type BulkEmailResult = {
  audience: BulkEmailAudience;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
};

export type AdminEmailCampaign = {
  id: string;
  audience: BulkEmailAudience;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};
