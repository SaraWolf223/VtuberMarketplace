import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { notifyStaff } from '../_shared/staff-notify.ts';
import { getPlatformSettingInt } from '../_shared/platform-settings.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';

// Defaults match the seed rows in migration 111 — admin-editable via
// app/admin/settings.tsx (platform_settings table).
const DEFAULT_REPORTS_PER_HOUR = 5;
const DEFAULT_PAUSE_REPORTS_24H = 10;
const DEFAULT_PAUSE_REPORTS_LIFETIME = 50;

type ReportReason =
  | 'scam'
  | 'spam'
  | 'prohibited_item'
  | 'harassment'
  | 'counterfeit'
  | 'stolen'
  | 'misleading'
  | 'other';

const VALID_REPORT_REASONS: ReadonlySet<string> = new Set<ReportReason>([
  'scam',
  'spam',
  'prohibited_item',
  'harassment',
  'counterfeit',
  'stolen',
  'misleading',
  'other',
]);

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  let body: {
    target_type?: 'listing' | 'user';
    listing_id?: string;
    reported_user_id?: string;
    reason?: ReportReason;
    details?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const targetType = body.target_type;
  const reason = body.reason;
  if (!targetType || !reason) {
    return withCors(errorResponse('target_type and reason are required', 400, 'BAD_REQUEST'));
  }

  if (!VALID_REPORT_REASONS.has(reason)) {
    return withCors(errorResponse('Invalid report reason', 400, 'INVALID_REASON'));
  }

  const admin = createSupabaseAdmin();
  const reporterId = auth.user.id;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const reportsPerHour = await getPlatformSettingInt(admin, 'reports_per_hour', DEFAULT_REPORTS_PER_HOUR);
  const pauseReports24h = await getPlatformSettingInt(admin, 'pause_reports_24h', DEFAULT_PAUSE_REPORTS_24H);
  const pauseReportsLifetime = await getPlatformSettingInt(
    admin,
    'pause_reports_lifetime',
    DEFAULT_PAUSE_REPORTS_LIFETIME
  );

  const { count: hourlyCount } = await admin
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', reporterId)
    .gte('created_at', hourAgo);

  if ((hourlyCount ?? 0) >= reportsPerHour) {
    return withCors(
      errorResponse('Too many reports. Try again later.', 429, 'RATE_LIMIT')
    );
  }

  let listingId: string | null = null;
  let reportedUserId: string | null = null;

  if (targetType === 'listing') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }
    listingId = body.listing_id;

    const { data: listing } = await admin
      .from('listings')
      .select('id, seller_id, status')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    if (listing.seller_id === reporterId) {
      return withCors(errorResponse('Cannot report your own listing', 400, 'INVALID_TARGET'));
    }

    reportedUserId = listing.seller_id;

    const { data: dup } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('listing_id', listingId)
      .gte('created_at', dayAgo)
      .limit(1)
      .maybeSingle();

    if (dup) {
      return withCors(
        errorResponse('You already reported this listing recently', 409, 'DUPLICATE_REPORT')
      );
    }
  } else if (targetType === 'user') {
    if (!body.reported_user_id) {
      return withCors(errorResponse('reported_user_id is required', 400, 'BAD_REQUEST'));
    }
    reportedUserId = body.reported_user_id;

    if (reportedUserId === reporterId) {
      return withCors(errorResponse('Cannot report yourself', 400, 'INVALID_TARGET'));
    }

    const { data: reportedProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', reportedUserId)
      .maybeSingle();

    if (reportedProfile?.role === 'admin' || reportedProfile?.role === 'manager') {
      return withCors(
        errorResponse('You cannot report a Local Marketplace staff account', 400, 'INVALID_TARGET')
      );
    }

    const { data: dup } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_user_id', reportedUserId)
      .eq('target_type', 'user')
      .gte('created_at', dayAgo)
      .limit(1)
      .maybeSingle();

    if (dup) {
      return withCors(
        errorResponse('You already reported this user recently', 409, 'DUPLICATE_REPORT')
      );
    }
  } else {
    return withCors(errorResponse('Invalid target_type', 400, 'BAD_REQUEST'));
  }

  const details = body.details?.trim().slice(0, 500) || null;

  const { data: report, error: insertError } = await admin
    .from('reports')
    .insert({
      reporter_id: reporterId,
      target_type: targetType,
      listing_id: listingId,
      reported_user_id: reportedUserId,
      reason,
      details,
      status: 'open',
    })
    .select('id')
    .single();

  if (insertError || !report) {
    return withCors(errorResponse('Could not submit report', 500, 'INSERT_FAILED'));
  }

  let listingPaused = false;

  if (listingId) {
    const { count: count24h } = await admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .gte('created_at', dayAgo);

    const { count: countLifetime } = await admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId);

    const reports24h = count24h ?? 0;
    const reportsTotal = countLifetime ?? 0;

    if (reports24h >= pauseReports24h || reportsTotal >= pauseReportsLifetime) {
      const { error: pauseError } = await admin
        .from('listings')
        .update({ status: 'paused_pending_review' })
        .eq('id', listingId)
        .in('status', ['active']);

      listingPaused = !pauseError;
    }
  }

  // Notify the team. Admin channel gets full context (incl. free-text details);
  // staff channel is redacted to ids/names + reason only, no free-text/PII.
  try {
    const nameIds = [reporterId, reportedUserId].filter((v): v is string => !!v);
    const { data: names } = nameIds.length
      ? await admin.from('profiles').select('id, display_name').in('id', nameIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameOf = (id: string | null) =>
      (id && names?.find((n) => n.id === id)?.display_name) || (id ? id.slice(0, 8) : '—');
    const targetLine =
      targetType === 'listing'
        ? `Listing: ${listingId} (seller ${nameOf(reportedUserId)})`
        : `User: ${nameOf(reportedUserId)} (${reportedUserId})`;

    const commonVars = {
      report_id: report.id,
      reason,
      target_line: targetLine,
      auto_paused: listingPaused ? 'yes' : 'no',
    };
    const submittedAt = new Date().toISOString();

    const adminRendered = await renderEmailTemplate(
      admin,
      'new_report_admin',
      {
        ...commonVars,
        reporter_name: nameOf(reporterId),
        reporter_id: reporterId ?? '—',
        details: details ?? '—',
        submitted_at: submittedAt,
      },
      {
        subject: `New {{reason}} report — ${targetType}`,
        body:
          `A new report was submitted.\n\n` +
          `Report ID: {{report_id}}\n` +
          `Reason: {{reason}}\n` +
          `{{target_line}}\n` +
          `Reporter: {{reporter_name}} ({{reporter_id}})\n` +
          `Details: {{details}}\n` +
          `Auto-paused listing: {{auto_paused}}\n` +
          `Submitted: {{submitted_at}}`,
      }
    );
    const staffRendered = await renderEmailTemplate(
      admin,
      'new_report_staff',
      commonVars,
      {
        subject: `New {{reason}} report — ${targetType}`,
        body:
          `A new report needs review.\n\n` +
          `Reason: {{reason}}\n` +
          `{{target_line}}\n` +
          `Auto-paused listing: {{auto_paused}}\n` +
          `Open the moderation panel to review.`,
      }
    );

    await notifyStaff({
      event: 'new_report',
      subject: adminRendered.subject,
      adminBody: adminRendered.body,
      staffBody: staffRendered.body,
    });
  } catch (e) {
    console.error('[submit-report] staff notify failed', e);
  }

  return withCors(
    okResponse({
      report_id: report.id,
      listing_paused: listingPaused,
    })
  );
});
