import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { assertManagerActionAllowed, requireStaff } from '../_shared/require-admin.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { hardDeleteListing } from '../_shared/hard-delete-listing.ts';
import { notifyStaff } from '../_shared/staff-notify.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';

type AdminAction =
  | 'unpause_listing'
  | 'pause_listing'
  | 'delete_listing'
  | 'ban_user'
  | 'unban_user'
  | 'warn_user'
  | 'dismiss_reports'
  | 'purge_orphan_reports'
  | 'shadow_ban_user'
  | 'unshadow_ban_user'
  | 'grant_premium'
  | 'revoke_premium'
  | 'extend_listing_expiry'
  | 'approve_seed_listing'
  | 'revoke_seed_approval'
  | 'mark_seed_paid'
  | 'confirm_seller_strike'
  | 'ban_ai_content';

// Keep in sync with src/constants/seed.ts
const SEED_PAID_CAP_PER_PERSON = 10;

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireStaff(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  let body: {
    action?: AdminAction;
    listing_id?: string;
    user_id?: string;
    seller_id?: string;
    report_id?: string;
    notes?: string;
    premium_months?: number | null;
    extend_days?: number;
    link_health_check_id?: string;
    reason?: string;
    source?: 'automated_check' | 'buyer_report';
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const action = body.action;
  if (!action) {
    return withCors(errorResponse('action is required', 400, 'BAD_REQUEST'));
  }

  const actionDenied = assertManagerActionAllowed(auth.role, action);
  if (actionDenied) {
    return withCors(actionDenied);
  }

  const admin = createSupabaseAdmin();
  const adminId = auth.user.id;
  const notes = body.notes?.trim().slice(0, 500) || null;

  // Staff accounts cannot be moderated. The edge runs with the service role,
  // which bypasses the protect-profile / block-staff DB triggers, so without
  // this check a manager (or admin) could ban / shadow-ban / warn another staff
  // member by calling the function directly — defeating the UI guard in
  // StaffModerationMenu and the spirit of migration 100. Corrective actions
  // (unban / unshadow) stay allowed.
  const ACCOUNT_MOD_ACTIONS: AdminAction[] = ['ban_user', 'shadow_ban_user', 'warn_user'];
  if (ACCOUNT_MOD_ACTIONS.includes(action) && body.user_id) {
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', body.user_id)
      .maybeSingle();
    if (targetProfile?.role === 'admin' || targetProfile?.role === 'manager') {
      return withCors(errorResponse('Cannot moderate a Local Marketplace staff account', 403, 'FORBIDDEN'));
    }
  }

  async function closeAllOpenReportsForUser(userId: string): Promise<void> {
    const reviewedAt = new Date().toISOString();
    const patch = {
      status: 'reviewed',
      reviewed_at: reviewedAt,
      reviewed_by: adminId,
    };

    await admin
      .from('reports')
      .update(patch)
      .eq('status', 'open')
      .eq('reported_user_id', userId);

    const { data: listings } = await admin
      .from('listings')
      .select('id')
      .eq('seller_id', userId);

    const listingIds = (listings ?? []).map((row) => row.id);
    if (listingIds.length) {
      await admin
        .from('reports')
        .update(patch)
        .eq('status', 'open')
        .in('listing_id', listingIds);
    }
  }

  if (action === 'unpause_listing') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: listing, error } = await admin
      .from('listings')
      .update({ status: 'active' })
      .eq('id', body.listing_id)
      .eq('status', 'paused_pending_review')
      .select('id')
      .maybeSingle();

    if (error || !listing) {
      return withCors(errorResponse('Listing not found or not paused', 404, 'NOT_FOUND'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'unpause_listing',
      listing_id: body.listing_id,
      notes,
    });

    await admin
      .from('reports')
      .update({ status: 'reviewed', reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq('listing_id', body.listing_id)
      .eq('status', 'open');

    return withCors(okResponse({ listing_id: listing.id, status: 'active' }));
  }

  if (action === 'pause_listing') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: listing, error } = await admin
      .from('listings')
      .update({ status: 'paused_pending_review' })
      .eq('id', body.listing_id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (error || !listing) {
      return withCors(errorResponse('Listing not found or not active', 404, 'NOT_FOUND'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'pause_listing',
      listing_id: body.listing_id,
      notes,
    });

    return withCors(okResponse({ listing_id: listing.id, status: 'paused_pending_review' }));
  }

  if (action === 'delete_listing') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: listing } = await admin
      .from('listings')
      .select('id, seller_id')
      .eq('id', body.listing_id)
      .maybeSingle();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    await hardDeleteListing(admin, body.listing_id, { reviewedBy: adminId });

    // listing_id is omitted: the listing no longer exists and its FK is
    // ON DELETE SET NULL — referencing the deleted id would violate the FK.
    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'delete_listing',
      listing_id: null,
      target_user_id: listing.seller_id,
      notes,
    });

    try {
      const at = new Date().toISOString();
      const adminRendered = await renderEmailTemplate(
        admin,
        'listing_removed_admin',
        { listing_id: body.listing_id, seller_id: listing.seller_id, staff_id: adminId, notes: notes ?? '—', at },
        {
          subject: 'Listing removed by staff',
          body:
            `A listing was removed by staff.\n\n` +
            `Listing ID: {{listing_id}}\n` +
            `Seller ID: {{seller_id}}\n` +
            `By staff ID: {{staff_id}}\n` +
            `Notes: {{notes}}\n` +
            `At: {{at}}`,
        }
      );
      const staffRendered = await renderEmailTemplate(
        admin,
        'listing_removed_staff',
        { listing_id: body.listing_id, seller_id: listing.seller_id, notes: notes ?? '—', at },
        {
          subject: 'Listing removed by staff',
          body:
            `A listing was removed by staff.\n\n` +
            `Listing ID: {{listing_id}}\n` +
            `Seller ID: {{seller_id}}\n` +
            `Notes: {{notes}}\n` +
            `At: {{at}}`,
        }
      );
      await notifyStaff({
        event: 'listing_removed',
        subject: adminRendered.subject,
        adminBody: adminRendered.body,
        staffBody: staffRendered.body,
      });
    } catch (e) {
      console.error('[admin-action] listing_removed notify failed', e);
    }

    return withCors(okResponse({ listing_id: body.listing_id, deleted: true }));
  }

  if (action === 'ban_user') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    await admin
      .from('profiles')
      .update({ banned_at: new Date().toISOString() })
      .eq('id', body.user_id);

    await closeAllOpenReportsForUser(body.user_id);

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'ban_user',
      target_user_id: body.user_id,
      report_id: body.report_id ?? null,
      notes,
    });

    try {
      const { data: names } = await admin
        .from('profiles')
        .select('id, display_name')
        .in('id', [body.user_id, adminId]);
      const nameOf = (id: string) =>
        names?.find((n) => n.id === id)?.display_name || id.slice(0, 8);
      const at = new Date().toISOString();
      const userName = nameOf(body.user_id);
      const byName = nameOf(adminId);
      const adminRendered = await renderEmailTemplate(
        admin,
        'user_banned_admin',
        {
          user_name: userName,
          user_id: body.user_id,
          by_name: byName,
          by_id: adminId,
          notes: notes ?? '—',
          report_id: body.report_id ?? '—',
          at,
        },
        {
          subject: `User banned — ${userName}`,
          body:
            `A user was banned.\n\n` +
            `User: {{user_name}} ({{user_id}})\n` +
            `By: {{by_name}} ({{by_id}})\n` +
            `Reason / notes: {{notes}}\n` +
            `Report: {{report_id}}\n` +
            `At: {{at}}`,
        }
      );
      const staffRendered = await renderEmailTemplate(
        admin,
        'user_banned_staff',
        { user_name: userName, user_id: body.user_id, by_name: byName, notes: notes ?? '—', at },
        {
          subject: `User banned — ${userName}`,
          body:
            `A user was banned.\n\n` +
            `User: {{user_name}} ({{user_id}})\n` +
            `By: {{by_name}}\n` +
            `Reason: {{notes}}\n` +
            `At: {{at}}`,
        }
      );
      await notifyStaff({
        event: 'user_banned',
        subject: adminRendered.subject,
        adminBody: adminRendered.body,
        staffBody: staffRendered.body,
      });
    } catch (e) {
      console.error('[admin-action] user_banned notify failed', e);
    }

    return withCors(okResponse({ user_id: body.user_id, banned: true }));
  }

  if (action === 'unban_user') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    await admin
      .from('profiles')
      .update({ banned_at: null })
      .eq('id', body.user_id);

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'unban_user',
      target_user_id: body.user_id,
      notes,
    });

    return withCors(okResponse({ user_id: body.user_id, unbanned: true }));
  }

  if (action === 'warn_user') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    await closeAllOpenReportsForUser(body.user_id);

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'warn_user',
      target_user_id: body.user_id,
      report_id: body.report_id ?? null,
      notes,
    });

    return withCors(okResponse({ user_id: body.user_id, warned: true }));
  }

  if (action === 'purge_orphan_reports') {
    const reviewedAt = new Date().toISOString();
    const orphanIds: string[] = [];

    const { data: nullListing } = await admin
      .from('reports')
      .select('id')
      .eq('status', 'open')
      .eq('target_type', 'listing')
      .is('listing_id', null);

    for (const row of nullListing ?? []) {
      orphanIds.push(row.id);
    }

    const { data: withListing } = await admin
      .from('reports')
      .select('id, listing_id')
      .eq('status', 'open')
      .eq('target_type', 'listing')
      .not('listing_id', 'is', null);

    for (const row of withListing ?? []) {
      if (!row.listing_id) continue;
      const { data: listing } = await admin
        .from('listings')
        .select('id')
        .eq('id', row.listing_id)
        .maybeSingle();
      if (!listing) {
        orphanIds.push(row.id);
      }
    }

    if (orphanIds.length > 0) {
      await admin
        .from('reports')
        .update({
          status: 'dismissed',
          reviewed_at: reviewedAt,
          reviewed_by: adminId,
        })
        .in('id', orphanIds);

      await admin.from('moderation_actions').insert({
        admin_id: adminId,
        action: 'purge_orphan_reports',
        notes: `Auto-closed ${orphanIds.length} report(s) — listing no longer exists`,
      });
    }

    return withCors(okResponse({ purged: orphanIds.length, report_ids: orphanIds }));
  }

  if (action === 'dismiss_reports') {
    if (!body.listing_id && !body.report_id) {
      return withCors(
        errorResponse('listing_id or report_id is required', 400, 'BAD_REQUEST')
      );
    }

    let query = admin
      .from('reports')
      .update({
        status: 'dismissed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq('status', 'open');

    if (body.report_id) {
      query = query.eq('id', body.report_id);
    } else if (body.listing_id) {
      query = query.eq('listing_id', body.listing_id);
    }

    await query;

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'dismiss_reports',
      listing_id: body.listing_id ?? null,
      report_id: body.report_id ?? null,
      notes,
    });

    return withCors(okResponse({ dismissed: true }));
  }

  if (action === 'shadow_ban_user') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    await admin
      .from('profiles')
      .update({ shadow_banned: true })
      .eq('id', body.user_id);

    await closeAllOpenReportsForUser(body.user_id);

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'shadow_ban_user',
      target_user_id: body.user_id,
      notes,
    });

    return withCors(okResponse({ user_id: body.user_id, shadow_banned: true }));
  }

  if (action === 'unshadow_ban_user') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    await admin
      .from('profiles')
      .update({ shadow_banned: false })
      .eq('id', body.user_id);

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'unshadow_ban_user',
      target_user_id: body.user_id,
      notes,
    });

    return withCors(okResponse({ user_id: body.user_id, shadow_banned: false }));
  }

  if (action === 'grant_premium') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    const rawMonths = body.premium_months;
    let premiumUntil: string | null = null;
    if (rawMonths != null && rawMonths !== 0) {
      const months = Number(rawMonths);
      if (!Number.isFinite(months) || months <= 0 || months > 120) {
        return withCors(errorResponse('premium_months must be 1-120 (or blank for open-ended)', 400, 'BAD_REQUEST'));
      }
      const until = new Date();
      until.setUTCMonth(until.getUTCMonth() + Math.round(months));
      premiumUntil = until.toISOString();
    }

    const { data: profile, error } = await admin
      .from('profiles')
      .update({
        is_premium: true,
        premium_until: premiumUntil,
        premium_source: 'comp',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.user_id)
      .select('id')
      .maybeSingle();

    if (error || !profile) {
      return withCors(errorResponse('User not found', 404, 'NOT_FOUND'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'grant_premium',
      target_user_id: body.user_id,
      notes: notes ?? (premiumUntil ? `Comp premium until ${premiumUntil}` : 'Comp premium (open-ended)'),
    });

    return withCors(okResponse({ user_id: profile.id, is_premium: true, premium_until: premiumUntil }));
  }

  if (action === 'revoke_premium') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: profile, error } = await admin
      .from('profiles')
      .update({
        is_premium: false,
        premium_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.user_id)
      .select('id')
      .maybeSingle();

    if (error || !profile) {
      return withCors(errorResponse('User not found', 404, 'NOT_FOUND'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'revoke_premium',
      target_user_id: body.user_id,
      notes,
    });

    return withCors(okResponse({ user_id: profile.id, is_premium: false }));
  }

  if (action === 'extend_listing_expiry') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const days = Number(body.extend_days ?? 60);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return withCors(errorResponse('extend_days must be 1-365', 400, 'BAD_REQUEST'));
    }

    const { data: listing } = await admin
      .from('listings')
      .select('id, status')
      .eq('id', body.listing_id)
      .maybeSingle();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const purgeAt = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const patch: Record<string, unknown> = {
      expires_at: expiresAt.toISOString(),
      purge_at: purgeAt.toISOString(),
      updated_at: now.toISOString(),
    };
    if (listing.status === 'expired') {
      patch.status = 'active';
    }

    const { data: updated, error } = await admin
      .from('listings')
      .update(patch)
      .eq('id', body.listing_id)
      .select('id')
      .maybeSingle();

    if (error || !updated) {
      return withCors(errorResponse('Failed to extend listing', 500, 'UPDATE_FAILED'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'extend_listing_expiry',
      listing_id: body.listing_id,
      notes: notes ?? `Extended ${days} day(s); expires ${expiresAt.toISOString()}`,
    });

    return withCors(okResponse({
      listing_id: updated.id,
      expires_at: expiresAt.toISOString(),
      purge_at: purgeAt.toISOString(),
    }));
  }

  if (action === 'approve_seed_listing') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: listing } = await admin
      .from('listings')
      .select('id, seller_id')
      .eq('id', body.listing_id)
      .maybeSingle();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    const { data: existing } = await admin
      .from('seed_payouts')
      .select('id, approved')
      .eq('listing_id', body.listing_id)
      .maybeSingle();

    if (!existing?.approved) {
      const { count: approvedCount } = await admin
        .from('seed_payouts')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', listing.seller_id)
        .eq('approved', true);

      if ((approvedCount ?? 0) >= SEED_PAID_CAP_PER_PERSON) {
        return withCors(
          errorResponse(
            `Seller already has ${SEED_PAID_CAP_PER_PERSON} approved seed listings (per-person cap).`,
            429,
            'SEED_CAP_REACHED'
          )
        );
      }
    }

    const now = new Date().toISOString();
    const { error } = await admin.from('seed_payouts').upsert(
      {
        listing_id: body.listing_id,
        seller_id: listing.seller_id,
        approved: true,
        approved_at: now,
        approved_by: adminId,
        notes,
      },
      { onConflict: 'listing_id' }
    );

    if (error) {
      return withCors(errorResponse('Failed to approve seed listing', 500, 'UPDATE_FAILED'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'approve_seed_listing',
      listing_id: body.listing_id,
      target_user_id: listing.seller_id,
      notes,
    });

    return withCors(okResponse({ listing_id: body.listing_id, approved: true }));
  }

  if (action === 'revoke_seed_approval') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: updated, error } = await admin
      .from('seed_payouts')
      .update({ approved: false, approved_at: null, approved_by: null })
      .eq('listing_id', body.listing_id)
      .eq('paid', false)
      .select('id')
      .maybeSingle();

    if (error || !updated) {
      return withCors(errorResponse('Not found or already paid', 404, 'NOT_FOUND'));
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'revoke_seed_approval',
      listing_id: body.listing_id,
      notes,
    });

    return withCors(okResponse({ listing_id: body.listing_id, approved: false }));
  }

  if (action === 'mark_seed_paid') {
    if (!body.listing_id) {
      return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from('seed_payouts')
      .update({ paid: true, paid_at: now, paid_by: adminId })
      .eq('listing_id', body.listing_id)
      .eq('approved', true)
      .select('id')
      .maybeSingle();

    if (error || !updated) {
      return withCors(
        errorResponse('Seed listing not found or not approved', 404, 'NOT_FOUND')
      );
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'mark_seed_paid',
      listing_id: body.listing_id,
      notes,
    });

    return withCors(okResponse({ listing_id: body.listing_id, paid: true }));
  }

  if (action === 'confirm_seller_strike') {
    if (!body.seller_id) {
      return withCors(errorResponse('seller_id is required', 400, 'BAD_REQUEST'));
    }
    const sellerId = body.seller_id;
    const strikeReason =
      body.reason?.trim().slice(0, 500) ||
      'Broken seller-hosted download link after grace period';
    const strikeSource = body.source === 'buyer_report' ? 'buyer_report' : 'automated_check';

    const { data: strikeResult, error: strikeError } = await admin.rpc('confirm_seller_strike', {
      p_seller_id: sellerId,
      p_listing_id: body.listing_id ?? null,
      p_reason: strikeReason,
      p_source: strikeSource,
      p_confirmed_by: adminId,
    });

    if (strikeError) {
      return withCors(errorResponse(strikeError.message, 500, 'STRIKE_FAILED'));
    }

    if (body.link_health_check_id) {
      await admin
        .from('link_health_checks')
        .update({ issue_open: false, updated_at: new Date().toISOString() })
        .eq('id', body.link_health_check_id);
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'confirm_seller_strike',
      user_id: sellerId,
      listing_id: body.listing_id ?? null,
      notes,
    });

    return withCors(okResponse(strikeResult ?? { ok: true }));
  }

  if (action === 'ban_ai_content') {
    if (!body.user_id) {
      return withCors(errorResponse('user_id is required', 400, 'BAD_REQUEST'));
    }

    const bannedAt = new Date().toISOString();
    const { data: banned, error: banError } = await admin
      .from('profiles')
      .update({ banned_at: bannedAt })
      .eq('id', body.user_id)
      .is('banned_at', null)
      .select('id')
      .maybeSingle();

    if (banError) {
      return withCors(errorResponse(banError.message, 500, 'BAN_FAILED'));
    }
    if (!banned) {
      return withCors(errorResponse('User not found or already banned', 404, 'NOT_FOUND'));
    }

    if (body.listing_id) {
      await hardDeleteListing(admin, body.listing_id, { reviewedBy: adminId });
    }

    await closeAllOpenReportsForUser(body.user_id);

    if (body.report_id) {
      await admin
        .from('reports')
        .update({
          status: 'reviewed',
          reviewed_at: bannedAt,
          reviewed_by: adminId,
        })
        .eq('id', body.report_id);
    }

    await admin.from('moderation_actions').insert({
      admin_id: adminId,
      action: 'ban_ai_content',
      user_id: body.user_id,
      listing_id: body.listing_id ?? null,
      notes: notes ?? 'AI-generated content — immediate ban per policy',
    });

    return withCors(okResponse({ user_id: body.user_id, banned: true }));
  }

  return withCors(errorResponse('Unknown action', 400, 'BAD_REQUEST'));
});
