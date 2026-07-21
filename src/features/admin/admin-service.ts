import type { QueryClient } from '@tanstack/react-query';
import {
  fetchAdminStrikeQueue,
  type AdminStrikeQueueItem,
} from '@/features/strikes/strike-service';
import {
  getSupabaseEnv,
  supabaseRestGet,
  supabaseRestPatch,
  supabaseRestPost,
  supabaseRpc,
} from '@/lib/supabase-rest';
import { queryKeys } from '@/lib/query-keys';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import type {
  AdminActionPayload,
  AdminActionResult,
  ModerationTargetState,
  AdminListPage,
  AdminManagePayload,
  AdminManageResult,
  AdminModerationLogEntry,
  AdminPausedListing,
  AdminPlatformSettings,
  AdminPromoCode,
  AdminPromoCodeInput,
  AdminReport,
  AdminSlaMetrics,
  AdminUserRow,
  StaffUsersPage,
  StaffDirectoryUser,
  AdminWarnedUser,
  AdminBannedUser,
  AdminCollegeStudentRow,
  AdminBannedKeyword,
  AdminListingCategory,
  AdminEmailTemplate,
  RedeemPromoResult,
  AdminWaitlistSignup,
  AdminIosWaitlistSignup,
  BulkEmailAudience,
  BulkEmailPreview,
  BulkEmailResult,
  AdminEmailCampaign,
  SeedListingRow,
  SeedSellerGroup,
} from '@/features/admin/admin-types';
import {
  DEFAULT_ADMIN_PLATFORM_SETTINGS,
  ADMIN_LIST_PAGE_SIZE,
  staffUserHasEmail,
} from '@/features/admin/admin-types';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let json: EdgeEnvelope<T>;
  try {
    json = JSON.parse(raw) as EdgeEnvelope<T>;
  } catch {
    const hint =
      res.status === 404
        ? `Function "${fn}" is not deployed. Run: npx supabase functions deploy ${fn}`
        : raw.slice(0, 120);
    throw new Error(`Request failed (${res.status}). ${hint}`);
  }
  if (json.ok && json.data) {
    return json.data;
  }
  const fallback =
    res.status === 404
      ? `Function "${fn}" is not deployed. Run: npx supabase functions deploy ${fn}`
      : `Request failed (${res.status})`;
  throw new Error(json.error?.message ?? fallback);
}

async function logModerationAction(
  accessToken: string,
  adminUserId: string,
  row: Record<string, unknown>
): Promise<void> {
  await supabaseRestPost(
    'moderation_actions',
    { admin_id: adminUserId, ...row },
    accessToken
  );
}

async function closeAllOpenReportsForUser(
  accessToken: string,
  adminUserId: string,
  userId: string,
  now: string
): Promise<void> {
  const patch = {
    status: 'reviewed',
    reviewed_at: now,
    reviewed_by: adminUserId,
  };

  await supabaseRestPatch(
    `reports?status=eq.open&reported_user_id=eq.${userId}`,
    patch,
    accessToken
  );

  const listings = await supabaseRestGet<{ id: string }>(
    `listings?seller_id=eq.${userId}&select=id`,
    accessToken
  );
  const listingIds = listings.map((row) => row.id);
  if (listingIds.length) {
    await supabaseRestPatch(
      `reports?status=eq.open&listing_id=in.(${listingIds.join(',')})`,
      patch,
      accessToken
    );
  }
}

async function runAdminActionRest(
  accessToken: string,
  adminUserId: string,
  payload: AdminActionPayload
): Promise<AdminActionResult> {
  const now = new Date().toISOString();

  if (payload.action === 'unpause_listing') {
    await supabaseRestPatch(
      `listings?id=eq.${payload.listing_id}&status=eq.paused_pending_review`,
      { status: 'active', updated_at: now },
      accessToken
    );
    const activeRows = await supabaseRestGet<{ id: string }>(
      `listings?id=eq.${payload.listing_id}&status=eq.active&select=id`,
      accessToken
    );
    if (!activeRows[0]) {
      throw new Error('Listing not found or not paused');
    }
    await supabaseRestPatch(
      `reports?listing_id=eq.${payload.listing_id}&status=eq.open`,
      { status: 'reviewed', reviewed_at: now, reviewed_by: adminUserId },
      accessToken
    );
    await logModerationAction(accessToken, adminUserId, {
      action: 'unpause_listing',
      listing_id: payload.listing_id,
      notes: payload.notes ?? null,
    });
    return { listing_id: payload.listing_id, status: 'active' };
  }

  if (payload.action === 'pause_listing') {
    await supabaseRestPatch(
      `listings?id=eq.${payload.listing_id}&status=eq.active`,
      { status: 'paused_pending_review', updated_at: now },
      accessToken
    );
    const pausedRows = await supabaseRestGet<{ id: string }>(
      `listings?id=eq.${payload.listing_id}&status=eq.paused_pending_review&select=id`,
      accessToken
    );
    if (!pausedRows[0]) {
      throw new Error('Listing not found or not active');
    }
    await logModerationAction(accessToken, adminUserId, {
      action: 'pause_listing',
      listing_id: payload.listing_id,
      notes: payload.notes ?? null,
    });
    return { listing_id: payload.listing_id, status: 'paused_pending_review' };
  }

  if (payload.action === 'delete_listing') {
    return supabaseRpc<AdminActionResult>(
      'admin_delete_listing',
      { p_listing_id: payload.listing_id, p_notes: payload.notes ?? null },
      accessToken
    );
  }

  if (payload.action === 'ban_user') {
    await supabaseRestPatch(
      `profiles?id=eq.${payload.user_id}`,
      { banned_at: now, updated_at: now },
      accessToken
    );
    await closeAllOpenReportsForUser(accessToken, adminUserId, payload.user_id, now);
    await logModerationAction(accessToken, adminUserId, {
      action: 'ban_user',
      target_user_id: payload.user_id,
      report_id: payload.report_id ?? null,
      notes: payload.notes ?? null,
    });
    return { user_id: payload.user_id, banned: true };
  }

  if (payload.action === 'warn_user') {
    await closeAllOpenReportsForUser(accessToken, adminUserId, payload.user_id, now);
    await logModerationAction(accessToken, adminUserId, {
      action: 'warn_user',
      target_user_id: payload.user_id,
      report_id: payload.report_id ?? null,
      notes: payload.notes ?? null,
    });
    return { user_id: payload.user_id, warned: true };
  }

  if (payload.action === 'unban_user') {
    await supabaseRestPatch(
      `profiles?id=eq.${payload.user_id}`,
      { banned_at: null, updated_at: now },
      accessToken
    );
    await logModerationAction(accessToken, adminUserId, {
      action: 'unban_user',
      target_user_id: payload.user_id,
      notes: payload.notes ?? null,
    });
    return { user_id: payload.user_id, unbanned: true };
  }

  if (payload.action === 'dismiss_reports') {
    const filter = payload.report_id
      ? `id=eq.${payload.report_id}`
      : `listing_id=eq.${payload.listing_id}`;
    await supabaseRestPatch(
      `reports?${filter}&status=eq.open`,
      { status: 'dismissed', reviewed_at: now, reviewed_by: adminUserId },
      accessToken
    );
    await logModerationAction(accessToken, adminUserId, {
      action: 'dismiss_reports',
      listing_id: payload.listing_id ?? null,
      report_id: payload.report_id ?? null,
      notes: payload.notes ?? null,
    });
    return { dismissed: true };
  }

  if (payload.action === 'purge_orphan_reports') {
    const openReports = await supabaseRestGet<{
      id: string;
      listing_id: string | null;
      target_type: string;
    }>(
      'reports?status=eq.open&target_type=eq.listing&select=id,listing_id,target_type',
      accessToken
    );
    const orphanIds: string[] = [];
    for (const report of openReports) {
      if (!report.listing_id) {
        orphanIds.push(report.id);
        continue;
      }
      const listings = await supabaseRestGet<{ id: string }>(
        `listings?id=eq.${report.listing_id}&select=id`,
        accessToken
      );
      if (!listings.length) {
        orphanIds.push(report.id);
      }
    }
    if (orphanIds.length > 0) {
      for (const id of orphanIds) {
        await supabaseRestPatch(
          `reports?id=eq.${id}`,
          { status: 'dismissed', reviewed_at: now, reviewed_by: adminUserId },
          accessToken
        );
      }
      await logModerationAction(accessToken, adminUserId, {
        action: 'purge_orphan_reports',
        notes: `Auto-closed ${orphanIds.length} report(s) — listing no longer exists`,
      });
    }
    return { purged: orphanIds.length, report_ids: orphanIds };
  }

  if (payload.action === 'shadow_ban_user') {
    await supabaseRestPatch(
      `profiles?id=eq.${payload.user_id}`,
      { shadow_banned: true, updated_at: now },
      accessToken
    );
    await closeAllOpenReportsForUser(accessToken, adminUserId, payload.user_id, now);
    await logModerationAction(accessToken, adminUserId, {
      action: 'shadow_ban_user',
      target_user_id: payload.user_id,
      notes: payload.notes ?? null,
    });
    return { user_id: payload.user_id, shadow_banned: true };
  }

  if (payload.action === 'unshadow_ban_user') {
    await supabaseRestPatch(
      `profiles?id=eq.${payload.user_id}`,
      { shadow_banned: false, updated_at: now },
      accessToken
    );
    await logModerationAction(accessToken, adminUserId, {
      action: 'unshadow_ban_user',
      target_user_id: payload.user_id,
      notes: payload.notes ?? null,
    });
    return { user_id: payload.user_id, shadow_banned: false };
  }

  throw new Error(`Unknown admin action: ${(payload as { action: string }).action}`);
}

/**
 * Actions that must run on the edge (service role) — never REST-first.
 *
 * Premium/seed actions need the service role for Stripe + cross-row writes.
 * Account-state moderation (ban / unban / shadow-ban / warn) must also be
 * edge-only: the `protect_profile_trusted_fields_on_self_update` trigger (migration
 * 095) silently reverts `banned_at` / `shadow_banned` for non-admin (manager) REST
 * PATCHes, so a REST ban appears to succeed but does nothing — and would still fire
 * a real "account suspended" notification. Routing through the edge guarantees the
 * action actually takes effect (and is staff-target-guarded) before we notify.
 */
const EDGE_ONLY_ADMIN_ACTIONS = new Set<AdminActionPayload['action']>([
  'grant_premium',
  'revoke_premium',
  'extend_listing_expiry',
  'approve_seed_listing',
  'revoke_seed_approval',
  'mark_seed_paid',
  'ban_user',
  'unban_user',
  'shadow_ban_user',
  'unshadow_ban_user',
  'warn_user',
]);

export async function callAdminAction(
  accessToken: string,
  adminUserId: string,
  payload: AdminActionPayload
): Promise<AdminActionResult> {
  if (EDGE_ONLY_ADMIN_ACTIONS.has(payload.action)) {
    return callEdge<AdminActionResult>('admin-action', accessToken, payload);
  }

  try {
    return await runAdminActionRest(accessToken, adminUserId, payload);
  } catch (restError) {
    try {
      return await callEdge<AdminActionResult>('admin-action', accessToken, payload);
    } catch (edgeError) {
      const restMsg = restError instanceof Error ? restError.message : 'Database action failed';
      const edgeMsg = edgeError instanceof Error ? edgeError.message : 'Edge unavailable';
      if (edgeMsg.includes('404') || edgeMsg.includes('not deployed')) {
        throw new Error(restMsg);
      }
      throw new Error(`${restMsg}\n\n${edgeMsg}`);
    }
  }
}

export async function callAdminManage(
  accessToken: string,
  payload: AdminManagePayload
): Promise<AdminManageResult> {
  return callEdge<AdminManageResult>('admin-manage', accessToken, payload);
}

/**
 * Staff-only lookup of a user's current enforcement state (role, ban,
 * shadow-ban) so inline moderation controls can show the correct toggles and
 * refuse to act on other staff accounts. `profiles` SELECT RLS is admin-only
 * (migration 116); this SECURITY DEFINER RPC exposes only these non-PII
 * columns to managers too.
 */
export async function fetchModerationTargetState(
  accessToken: string,
  userId: string
): Promise<ModerationTargetState | null> {
  return supabaseRpc<ModerationTargetState | null>(
    'get_moderation_target_state',
    { p_user_id: userId },
    accessToken
  );
}

/**
 * Notify the affected user (in-app) why a moderation action was taken. Staff-only
 * (server-enforced via notify_moderation_action). Best-effort — callers should not
 * block the action on a failure here.
 */
export async function notifyModerationAction(
  accessToken: string,
  params: {
    userId: string;
    action: 'warn_user' | 'ban_user' | 'delete_listing' | 'pause_listing';
    reason?: string;
    listingId?: string | null;
    listingTitle?: string | null;
  }
): Promise<void> {
  await supabaseRpc(
    'notify_moderation_action',
    {
      p_user_id: params.userId,
      p_action: params.action,
      p_reason: params.reason?.trim() || null,
      p_listing_id: params.listingId ?? null,
      p_listing_title: params.listingTitle ?? null,
    },
    accessToken
  );
}

function restListPage<T>(rows: T[], offset: number): AdminListPage<T> {
  const hasMore = rows.length > ADMIN_LIST_PAGE_SIZE;
  return {
    items: hasMore ? rows.slice(0, ADMIN_LIST_PAGE_SIZE) : rows,
    nextOffset: hasMore ? offset + ADMIN_LIST_PAGE_SIZE : null,
  };
}

function mapPausedListing(row: AdminPausedListing): AdminPausedListing {
  return {
    ...row,
    price: Number(row.price),
    listing_images: [...(row.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

function mapAdminReport(row: AdminReport): AdminReport {
  return {
    ...row,
    listing: row.listing
      ? {
          ...row.listing,
          price: Number(row.listing.price),
          listing_images: [...(row.listing.listing_images ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order
          ),
        }
      : null,
  };
}

export async function fetchPausedListingsPage(
  accessToken: string,
  offset: number
): Promise<AdminListPage<AdminPausedListing>> {
  const select =
    'id,title,price,status,created_at,seller_id,listing_images(thumb_path,storage_path,sort_order),profiles!listings_seller_id_fkey(display_name,username)';
  const rows = await supabaseRestGet<AdminPausedListing>(
    `listings?status=eq.paused_pending_review&select=${select}&order=created_at.desc&limit=${ADMIN_LIST_PAGE_SIZE + 1}&offset=${offset}`,
    accessToken
  );
  const page = restListPage(rows.map(mapPausedListing), offset);
  return page;
}

/** @deprecated Use fetchPausedListingsPage for pagination */
export async function fetchPausedListings(accessToken: string): Promise<AdminPausedListing[]> {
  const page = await fetchPausedListingsPage(accessToken, 0);
  return page.items;
}

const ADMIN_REPORTS_SELECT =
  'id,target_type,listing_id,reported_user_id,reason,details,created_at,reporter_id,' +
  'listing:listings(id,title,price,status,seller_id,listing_images(thumb_path,storage_path,sort_order),' +
  'seller:profiles!listings_seller_id_fkey(id,username,display_name)),' +
  'reported_user:profiles!reports_reported_user_id_fkey(id,username,display_name),' +
  'reporter:profiles!reports_reporter_id_fkey(display_name)';

export function resolveReportSubjectUserId(report: AdminReport): string | null {
  if (report.target_type === 'user' && report.reported_user_id) {
    return report.reported_user_id;
  }
  return (
    report.listing?.seller_id ??
    report.listing?.seller?.id ??
    report.reported_user?.id ??
    report.reported_user_id
  );
}

export function isOrphanListingReport(report: AdminReport): boolean {
  return report.target_type === 'listing' && (!report.listing_id || !report.listing);
}

export function adminReportListingThumb(report: AdminReport): string | null {
  const listing = report.listing;
  if (!listing?.listing_images?.length) return null;
  const sorted = [...listing.listing_images].sort((a, b) => a.sort_order - b.sort_order);
  const first = sorted[0];
  const path = first?.thumb_path ?? first?.storage_path;
  return path ? listingImagePublicUrl(path) : null;
}

export async function fetchOpenReportsPage(
  accessToken: string,
  adminUserId: string,
  offset: number
): Promise<AdminListPage<AdminReport>> {
  if (offset === 0) {
    try {
      await callAdminAction(accessToken, adminUserId, { action: 'purge_orphan_reports' });
    } catch {
      // Orphan cleanup is best-effort; queue still loads if moderation fails.
    }
  }

  const rows = await supabaseRestGet<AdminReport>(
    `reports?status=eq.open&select=${ADMIN_REPORTS_SELECT}&order=created_at.desc&limit=${ADMIN_LIST_PAGE_SIZE + 1}&offset=${offset}`,
    accessToken
  );

  return restListPage(rows.map(mapAdminReport), offset);
}

/** @deprecated Use fetchOpenReportsPage for pagination */
export async function fetchOpenReports(
  accessToken: string,
  adminUserId: string
): Promise<AdminReport[]> {
  const page = await fetchOpenReportsPage(accessToken, adminUserId, 0);
  return page.items;
}

export function adminQueryErrorMessage(
  isError: boolean,
  error: unknown,
  fallback: string
): string | null {
  if (!isError) return null;
  return error instanceof Error ? error.message : fallback;
}

export type AdminQueueCounts = {
  pausedListings: number;
  openReports: number;
  overdueReports: number;
  pendingStrikes: number;
};

export async function fetchAdminQueueCounts(accessToken: string): Promise<AdminQueueCounts> {
  const [paused, reports, strikeQueue] = await Promise.all([
    supabaseRestGet<{ id: string }>(
      'listings?status=eq.paused_pending_review&select=id',
      accessToken
    ),
    supabaseRestGet<{ id: string; created_at: string }>(
      'reports?status=eq.open&select=id,created_at',
      accessToken
    ),
    fetchAdminStrikeQueue(accessToken).catch(() => [] as AdminStrikeQueueItem[]),
  ]);

  const overdueCutoff = Date.now() - 24 * 3_600_000;
  const overdueReports = reports.filter(
    (row) => new Date(row.created_at).getTime() < overdueCutoff
  ).length;

  const now = Date.now();
  const pendingStrikes = strikeQueue.filter((row) => {
    if (!row.grace_period_ends_at) return true;
    return new Date(row.grace_period_ends_at).getTime() <= now;
  }).length;

  return {
    pausedListings: paused.length,
    openReports: reports.length,
    overdueReports,
    pendingStrikes,
  };
}

export { fetchAdminStrikeQueue, type AdminStrikeQueueItem };

type StaffUsersRpcResult = {
  items: StaffDirectoryUser[];
  next_offset: number | null;
  limited: boolean;
};

export async function fetchAdminUsersPage(
  accessToken: string,
  offset: number
): Promise<StaffUsersPage> {
  const result = await supabaseRpc<StaffUsersRpcResult>(
    'list_staff_users_page',
    { p_limit: ADMIN_LIST_PAGE_SIZE, p_offset: offset },
    accessToken
  );
  return {
    items: result.items ?? [],
    nextOffset: result.next_offset,
    limited: result.limited === true,
  };
}

export async function fetchModerationSlaMetrics(accessToken: string): Promise<AdminSlaMetrics> {
  const counts = await fetchAdminQueueCounts(accessToken);

  const reviewed = await supabaseRestGet<{ created_at: string; reviewed_at: string }>(
    'reports?status=eq.reviewed&reviewed_at=not.is.null&select=created_at,reviewed_at&order=reviewed_at.desc&limit=200',
    accessToken
  );

  const deltasHours = reviewed
    .map((r) => (new Date(r.reviewed_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0 && Number.isFinite(h))
    .sort((a, b) => a - b);

  let medianResponseHours: number | null = null;
  if (deltasHours.length > 0) {
    const mid = Math.floor(deltasHours.length / 2);
    medianResponseHours =
      deltasHours.length % 2 === 0
        ? (deltasHours[mid - 1]! + deltasHours[mid]!) / 2
        : deltasHours[mid]!;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const recentActions = await supabaseRestGet<{ id: string }>(
    `moderation_actions?created_at=gte.${encodeURIComponent(weekAgo)}&select=id`,
    accessToken
  );

  return {
    openReports: counts.openReports,
    overdueReports: counts.overdueReports,
    reviewedLast30Days: reviewed.length,
    medianResponseHours,
    actionsLast7Days: recentActions.length,
  };
}

export async function fetchModerationActionLogPage(
  accessToken: string,
  offset: number
): Promise<AdminListPage<AdminModerationLogEntry>> {
  // Acting-admin email redacted for managers server-side (list_moderation_log / migration 101).
  const rows = await supabaseRpc<AdminModerationLogEntry[]>(
    'list_moderation_log',
    { p_limit: ADMIN_LIST_PAGE_SIZE + 1, p_offset: offset },
    accessToken
  );
  return restListPage(rows, offset);
}

export async function logAdminAudit(
  accessToken: string,
  adminUserId: string,
  action: string,
  notes: string
): Promise<void> {
  await logModerationAction(accessToken, adminUserId, { action, notes });
}

/**
 * Full-shape (email included) user list — admins only. `list_staff_users_page`
 * returns username-only rows for managers (no `email`), so this filters those
 * out rather than mislabeling them as `AdminUserRow`.
 */
export async function fetchAdminUsers(accessToken: string): Promise<AdminUserRow[]> {
  const all: AdminUserRow[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchAdminUsersPage(accessToken, offset);
    all.push(...page.items.filter(staffUserHasEmail));
    if (page.nextOffset == null) break;
    offset = page.nextOffset;
    if (offset > 2000) break;
  }
  return all;
}

export async function fetchAdminCollegeStudents(
  accessToken: string
): Promise<AdminCollegeStudentRow[]> {
  // Account + .edu emails redacted for managers server-side (list_college_students / migration 101).
  const rows = await supabaseRpc<
    (Omit<AdminCollegeStudentRow, 'badge_active'> & {
      college_edu_email: string | null;
    })[]
  >('list_college_students', {}, accessToken);

  return rows
    .filter((r): r is Omit<AdminCollegeStudentRow, 'badge_active'> & { college_edu_email: string } =>
      !!r.college_edu_email && !!r.college_badge_verified_at
    )
    .map((r) => ({
      ...r,
      college_edu_email: r.college_edu_email,
      badge_active: true,
    }));
}

export async function fetchBannedUsers(accessToken: string): Promise<AdminBannedUser[]> {
  // Email redacted for managers server-side (list_banned_users / migration 101).
  return supabaseRpc<AdminBannedUser[]>('list_banned_users', {}, accessToken);
}

export async function fetchWarnedUsers(accessToken: string): Promise<AdminWarnedUser[]> {
  type WarnRow = {
    id: string;
    target_user_id: string | null;
    created_at: string;
    notes: string | null;
    target:
      | (Pick<AdminUserRow, 'id' | 'username' | 'display_name' | 'banned_at'> & {
          email: string | null;
        })
      | null;
  };

  // Email is redacted for managers server-side (list_warned_users / migration 101).
  const rows = await supabaseRpc<WarnRow[]>('list_warned_users', {}, accessToken);

  const grouped = new Map<string, AdminWarnedUser>();

  for (const row of rows) {
    if (!row.target_user_id) continue;
    const existing = grouped.get(row.target_user_id);
    if (existing) {
      existing.warning_count += 1;
      if (row.created_at > existing.last_warned_at) {
        existing.last_warned_at = row.created_at;
        existing.last_notes = row.notes;
      }
      if (row.target) {
        existing.profile = row.target;
        existing.is_banned = !!row.target.banned_at;
      }
    } else {
      grouped.set(row.target_user_id, {
        user_id: row.target_user_id,
        warning_count: 1,
        last_warned_at: row.created_at,
        last_notes: row.notes,
        profile: row.target,
        is_banned: !!row.target?.banned_at,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => {
    if (b.warning_count !== a.warning_count) {
      return b.warning_count - a.warning_count;
    }
    return b.last_warned_at.localeCompare(a.last_warned_at);
  });
}

export async function unbanUser(
  accessToken: string,
  adminUserId: string,
  userId: string
): Promise<void> {
  await callAdminAction(accessToken, adminUserId, {
    action: 'unban_user',
    user_id: userId,
  });
}

/** Comp a user to Premium. `months` null/blank = open-ended (no expiry). */
export async function grantPremium(
  accessToken: string,
  adminUserId: string,
  userId: string,
  months: number | null,
  notes?: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'grant_premium',
    user_id: userId,
    premium_months: months,
    notes,
  });
}

export async function revokePremium(
  accessToken: string,
  adminUserId: string,
  userId: string,
  notes?: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'revoke_premium',
    user_id: userId,
    notes,
  });
}

/** Push a listing's expiry/purge dates out by N days (seed safety net). */
export async function extendListingExpiry(
  accessToken: string,
  adminUserId: string,
  listingId: string,
  days: number,
  notes?: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'extend_listing_expiry',
    listing_id: listingId,
    extend_days: days,
    notes,
  });
}

export async function approveSeedListing(
  accessToken: string,
  adminUserId: string,
  listingId: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'approve_seed_listing',
    listing_id: listingId,
  });
}

export async function revokeSeedApproval(
  accessToken: string,
  adminUserId: string,
  listingId: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'revoke_seed_approval',
    listing_id: listingId,
  });
}

export async function markSeedPaid(
  accessToken: string,
  adminUserId: string,
  listingId: string
): Promise<AdminActionResult> {
  return callAdminAction(accessToken, adminUserId, {
    action: 'mark_seed_paid',
    listing_id: listingId,
  });
}

/** Founding (seed cohort) sellers + their listings + seed payout status, grouped by seller. */
export async function fetchSeedPayoutOverview(accessToken: string): Promise<SeedSellerGroup[]> {
  const sellers = await supabaseRestGet<{
    id: string;
    username: string;
    display_name: string;
    is_premium: boolean;
    premium_until: string | null;
  }>(
    'profiles?is_founding_seller=eq.true&select=id,username,display_name,is_premium,premium_until&order=founding_seller_at.desc',
    accessToken
  );

  if (sellers.length === 0) return [];

  const sellerIds = sellers.map((s) => s.id).join(',');

  const listings = await supabaseRestGet<{
    id: string;
    seller_id: string;
    title: string;
    price: number;
    status: string;
    expires_at: string | null;
    created_at: string;
  }>(
    `listings?seller_id=in.(${sellerIds})&select=id,seller_id,title,price,status,expires_at,created_at&order=created_at.desc`,
    accessToken
  );

  const listingIds = listings.map((l) => l.id);

  const images =
    listingIds.length > 0
      ? await supabaseRestGet<{ listing_id: string; thumb_path: string }>(
          `listing_images?listing_id=in.(${listingIds.join(',')})&sort_order=eq.0&select=listing_id,thumb_path`,
          accessToken
        )
      : [];
  const thumbByListing = new Map(images.map((i) => [i.listing_id, i.thumb_path]));

  const payouts = await supabaseRestGet<{
    listing_id: string;
    approved: boolean;
    paid: boolean;
  }>(
    `seed_payouts?seller_id=in.(${sellerIds})&select=listing_id,approved,paid`,
    accessToken
  );
  const payoutByListing = new Map(payouts.map((p) => [p.listing_id, p]));

  return sellers.map((seller) => {
    const sellerListings: SeedListingRow[] = listings
      .filter((l) => l.seller_id === seller.id)
      .map((l) => {
        const payout = payoutByListing.get(l.id);
        return {
          listing_id: l.id,
          title: l.title,
          price: Number(l.price),
          status: l.status,
          thumb_path: thumbByListing.get(l.id) ?? null,
          expires_at: l.expires_at,
          created_at: l.created_at,
          approved: payout?.approved ?? false,
          paid: payout?.paid ?? false,
        };
      });

    return {
      seller_id: seller.id,
      username: seller.username,
      display_name: seller.display_name,
      is_premium: seller.is_premium,
      premium_until: seller.premium_until,
      approved_count: sellerListings.filter((l) => l.approved).length,
      paid_count: sellerListings.filter((l) => l.paid).length,
      listings: sellerListings,
    };
  });
}

export async function fetchPromoCodes(accessToken: string): Promise<AdminPromoCode[]> {
  return supabaseRestGet<AdminPromoCode>(
    'promo_codes?select=id,code,type,value,max_redemptions,redemption_count,expires_at,active,created_at&order=created_at.desc',
    accessToken
  );
}

const PLATFORM_SETTING_KEYS = [
  'boost_duration_hours',
  'boost_base_cents',
  'reports_per_hour',
  'pause_reports_24h',
  'pause_reports_lifetime',
] as const;

function parseSettingValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value != null && typeof value === 'object') {
    const parsed = parseInt(String(value), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function mergePlatformSettings(rows: { key: string; value: unknown }[]): AdminPlatformSettings {
  const settings = { ...DEFAULT_ADMIN_PLATFORM_SETTINGS };
  for (const key of PLATFORM_SETTING_KEYS) {
    const row = rows.find((r) => r.key === key);
    const parsed = parseSettingValue(row?.value);
    if (parsed > 0) {
      settings[key] = parsed;
    }
  }
  return settings;
}

function normalizePromoInput(input: AdminPromoCodeInput): AdminPromoCodeInput {
  const code = input.code.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error('Code must be 4–32 characters: A-Z, 0-9, underscore, hyphen');
  }
  const value =
    input.type === 'free_premium_month' ? 1 : Math.max(1, Math.floor(input.value));
  if (input.type === 'free_premium_month' && input.value !== 1) {
    throw new Error('Free Premium month promos must have value 1');
  }
  return {
    ...input,
    code,
    value,
    max_redemptions: input.max_redemptions ?? null,
    expires_at: input.expires_at ?? null,
  };
}

export async function fetchPlatformSettings(accessToken: string): Promise<AdminPlatformSettings> {
  let restError: string | null = null;
  try {
    const rows = await supabaseRestGet<{ key: string; value: unknown }>(
      'platform_settings?select=key,value',
      accessToken
    );
    return mergePlatformSettings(rows);
  } catch (e) {
    restError = e instanceof Error ? e.message : 'Could not read platform_settings';
  }

  try {
    const data = await callAdminManage(accessToken, { action: 'get_settings' });
    if (data.settings) {
      return { ...DEFAULT_ADMIN_PLATFORM_SETTINGS, ...data.settings };
    }
  } catch (e) {
    const edgeMsg = e instanceof Error ? e.message : 'Edge unavailable';
    throw new Error(
      restError
        ? `${restError}\n\n${edgeMsg}`
        : edgeMsg
    );
  }

  throw new Error(restError ?? 'Could not load platform settings');
}

export async function updatePlatformSettings(
  accessToken: string,
  settings: Partial<AdminPlatformSettings>
): Promise<AdminPlatformSettings> {
  let restError: string | null = null;
  try {
    for (const key of PLATFORM_SETTING_KEYS) {
      const value = settings[key];
      if (value == null || !Number.isFinite(value)) continue;
      await supabaseRestPost(
        'platform_settings?on_conflict=key',
        { key, value, updated_at: new Date().toISOString() },
        accessToken,
        15000,
        { upsert: true }
      );
    }
    return fetchPlatformSettings(accessToken);
  } catch (e) {
    restError = e instanceof Error ? e.message : 'Could not save via database';
  }

  try {
    const data = await callAdminManage(accessToken, { action: 'update_settings', settings });
    if (!data.settings) {
      throw new Error('Could not save platform settings');
    }
    return { ...DEFAULT_ADMIN_PLATFORM_SETTINGS, ...data.settings };
  } catch (e) {
    const edgeMsg = e instanceof Error ? e.message : 'Edge unavailable';
    throw new Error(restError ? `${restError}\n\n${edgeMsg}` : edgeMsg);
  }
}

export async function createPromoCode(
  accessToken: string,
  input: AdminPromoCodeInput
): Promise<AdminPromoCode> {
  const normalized = normalizePromoInput(input);

  try {
    const rows = await supabaseRestPost<AdminPromoCode>('promo_codes', {
      code: normalized.code,
      type: normalized.type,
      value: normalized.value,
      max_redemptions: normalized.max_redemptions,
      expires_at: normalized.expires_at,
    }, accessToken);
    if (!rows[0]) {
      throw new Error('Could not create promo code');
    }
    return rows[0];
  } catch (restError) {
    try {
      const data = await callAdminManage(accessToken, { action: 'create_promo', ...normalized });
      if (!data.promo) {
        throw new Error('Could not create promo code');
      }
      return data.promo;
    } catch (edgeError) {
      const restMsg = restError instanceof Error ? restError.message : 'REST failed';
      const edgeMsg = edgeError instanceof Error ? edgeError.message : 'Edge failed';
      if (edgeMsg.includes('not deployed') || edgeMsg.includes('404')) {
        throw new Error(
          `${restMsg}\n\nAlso: ${edgeMsg}\n\nRun: npx supabase db push (migration 056) OR deploy admin-manage.`
        );
      }
      throw edgeError;
    }
  }
}

export async function deactivatePromoCode(accessToken: string, promoId: string): Promise<void> {
  try {
    await supabaseRestPatch(
      `promo_codes?id=eq.${promoId}`,
      { active: false, updated_at: new Date().toISOString() },
      accessToken
    );
  } catch (restError) {
    try {
      await callAdminManage(accessToken, { action: 'deactivate_promo', promo_id: promoId });
    } catch (edgeError) {
      const restMsg = restError instanceof Error ? restError.message : 'REST failed';
      const edgeMsg = edgeError instanceof Error ? edgeError.message : 'Edge failed';
      if (edgeMsg.includes('not deployed') || edgeMsg.includes('404')) {
        throw new Error(
          `${restMsg}\n\nAlso: ${edgeMsg}\n\nRun: npx supabase db push (migration 056) OR deploy admin-manage.`
        );
      }
      throw edgeError;
    }
  }
}

export async function fetchBannedKeywords(accessToken: string): Promise<AdminBannedKeyword[]> {
  return supabaseRestGet<AdminBannedKeyword>(
    'banned_keywords?select=id,keyword,active&order=keyword.asc',
    accessToken
  );
}

export async function setBannedKeywordActive(
  accessToken: string,
  adminUserId: string,
  keywordId: number,
  active: boolean
): Promise<void> {
  await supabaseRestPatch(`banned_keywords?id=eq.${keywordId}`, { active }, accessToken);
  await logAdminAudit(
    accessToken,
    adminUserId,
    active ? 'enable_banned_keyword' : 'disable_banned_keyword',
    String(keywordId)
  );
}

export async function addBannedKeyword(
  accessToken: string,
  adminUserId: string,
  keyword: string
): Promise<AdminBannedKeyword> {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Keyword cannot be empty');
  }
  const rows = await supabaseRestPost<AdminBannedKeyword>(
    'banned_keywords',
    { keyword: normalized, active: true },
    accessToken
  );
  if (!rows[0]) {
    throw new Error('Could not add keyword');
  }
  await logAdminAudit(accessToken, adminUserId, 'add_banned_keyword', normalized);
  return rows[0];
}

const CATEGORY_SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;

export async function fetchAdminCategories(accessToken: string): Promise<AdminListingCategory[]> {
  return supabaseRestGet<AdminListingCategory>(
    'listing_categories?select=slug,label,icon_name,sort_order,is_active&order=sort_order.asc',
    accessToken
  );
}

export async function createCategory(
  accessToken: string,
  adminUserId: string,
  input: { slug: string; label: string; icon_name: string; sort_order?: number }
): Promise<AdminListingCategory> {
  const slug = input.slug.trim().toLowerCase();
  if (!CATEGORY_SLUG_RE.test(slug)) {
    throw new Error('Slug must be lowercase letters/numbers/underscores, starting with a letter');
  }
  const label = input.label.trim();
  if (!label || label.length > 40) {
    throw new Error('Label must be 1–40 characters');
  }
  const rows = await supabaseRestPost<AdminListingCategory>(
    'listing_categories',
    { slug, label, icon_name: input.icon_name, sort_order: input.sort_order ?? 0, is_active: true },
    accessToken
  );
  if (!rows[0]) {
    throw new Error('Could not add category');
  }
  await logAdminAudit(accessToken, adminUserId, 'add_listing_category', slug);
  return rows[0];
}

export async function updateCategory(
  accessToken: string,
  adminUserId: string,
  slug: string,
  updates: Partial<Pick<AdminListingCategory, 'label' | 'icon_name' | 'sort_order' | 'is_active'>>
): Promise<void> {
  await supabaseRestPatch(`listing_categories?slug=eq.${encodeURIComponent(slug)}`, updates, accessToken);
  await logAdminAudit(accessToken, adminUserId, 'update_listing_category', slug);
}

/** Delete a category — fails if any listing still references it (FK). Deactivate instead in that case. */
export async function deleteCategory(
  accessToken: string,
  adminUserId: string,
  slug: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/rest/v1/listing_categories?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('foreign key') || text.includes('violates')) {
      throw new Error('Listings still use this category — deactivate it instead of deleting.');
    }
    throw new Error(text || 'Could not delete category');
  }
  await logAdminAudit(accessToken, adminUserId, 'delete_listing_category', slug);
}

export async function fetchAdminEmailTemplates(accessToken: string): Promise<AdminEmailTemplate[]> {
  return supabaseRestGet<AdminEmailTemplate>(
    'email_templates?select=event_key,description,subject,body_text,updated_at&order=event_key.asc',
    accessToken
  );
}

/** Restore a template's subject/body to blank-out an accidental edit — actual "reset to default" text lives client-side; server fallback kicks in whenever a row is missing. */
export async function updateEmailTemplate(
  accessToken: string,
  adminUserId: string,
  eventKey: string,
  updates: { subject: string; body_text: string }
): Promise<void> {
  const subject = updates.subject.trim();
  const body = updates.body_text.trim();
  if (!subject || subject.length > 200) {
    throw new Error('Subject must be 1–200 characters');
  }
  if (!body || body.length > 4000) {
    throw new Error('Body must be 1–4000 characters');
  }
  await supabaseRestPatch(
    `email_templates?event_key=eq.${encodeURIComponent(eventKey)}`,
    { subject, body_text: body, updated_at: new Date().toISOString() },
    accessToken
  );
  await logAdminAudit(accessToken, adminUserId, 'update_email_template', eventKey);
}

export async function redeemPromoCode(
  accessToken: string,
  code: string
): Promise<RedeemPromoResult> {
  return callEdge<RedeemPromoResult>('redeem-promo-code', accessToken, { code });
}

export function adminListingThumb(listing: AdminPausedListing): string | null {
  const first = listing.listing_images[0];
  const path = first?.thumb_path ?? first?.storage_path;
  return path ? listingImagePublicUrl(path) : null;
}

export function promoTypeLabel(type: AdminPromoCode['type']): string {
  if (type === 'free_premium_month') return 'Free Premium month';
  if (type === 'founding_seller') return 'Founding Seller';
  return 'Free boosts';
}

export function formatPromoValue(type: AdminPromoCode['type'], value: number): string {
  if (type === 'free_premium_month') return '1 month Premium';
  if (type === 'founding_seller') return 'Badge + 10 boosts/mo';
  return `${value} boost${value === 1 ? '' : 's'}`;
}

/** Refresh hub badges and moderation queues after admin actions. */
export function invalidateAdminModerationQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminQueueCounts });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminOpenReports });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminPausedListings });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminWarnedUsers });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminBannedUsers });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminStrikeQueue });
}

export async function fetchAdminWaitlistPage(
  accessToken: string,
  offset: number
): Promise<AdminListPage<AdminWaitlistSignup>> {
  const rows = await supabaseRestGet<AdminWaitlistSignup>(
    `waitlist_signups?select=id,email,zip_code,role,founding_code,redeemed_at,created_at,source&order=created_at.desc&limit=${ADMIN_LIST_PAGE_SIZE}&offset=${offset}`,
    accessToken
  );
  return {
    items: rows,
    nextOffset: rows.length === ADMIN_LIST_PAGE_SIZE ? offset + ADMIN_LIST_PAGE_SIZE : null,
  };
}

export async function fetchAdminIosWaitlistPage(
  accessToken: string,
  offset: number
): Promise<AdminListPage<AdminIosWaitlistSignup>> {
  const rows = await supabaseRestGet<AdminIosWaitlistSignup>(
    `ios_waitlist_signups?select=id,email,zip_code,created_at,source&order=created_at.desc&limit=${ADMIN_LIST_PAGE_SIZE}&offset=${offset}`,
    accessToken
  );
  return {
    items: rows,
    nextOffset: rows.length === ADMIN_LIST_PAGE_SIZE ? offset + ADMIN_LIST_PAGE_SIZE : null,
  };
}

export async function previewBulkEmail(
  accessToken: string,
  audience: BulkEmailAudience,
  subject: string,
  body: string
): Promise<BulkEmailPreview> {
  return callEdge<BulkEmailPreview>('admin-bulk-email', accessToken, {
    audience,
    subject,
    body,
    confirm: false,
  });
}

export async function sendBulkEmail(
  accessToken: string,
  audience: BulkEmailAudience,
  subject: string,
  body: string
): Promise<BulkEmailResult> {
  return callEdge<BulkEmailResult>('admin-bulk-email', accessToken, {
    audience,
    subject,
    body,
    confirm: true,
  });
}

export async function fetchEmailCampaigns(accessToken: string): Promise<AdminEmailCampaign[]> {
  return supabaseRestGet<AdminEmailCampaign>(
    'email_campaigns?select=id,audience,subject,recipient_count,sent_count,failed_count,created_at&order=created_at.desc&limit=20',
    accessToken
  );
}
