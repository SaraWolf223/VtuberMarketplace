import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireCronAuth } from '../_shared/cron-auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { notifyStaff } from '../_shared/staff-notify.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';

/**
 * Cron / service: once-daily summary email to the admin channel (support@).
 * Rolls up high-volume signals (new users, new listings) that would be noisy
 * as immediate emails, plus current open-report backlog. Schedule via pg_cron
 * (see supabase/scripts/cron-schedule.sql). Auth: Bearer CRON_SECRET.
 */
Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const cronDenied = requireCronAuth(req);
  if (cronDenied) {
    return cronDenied;
  }

  try {
    const admin = createSupabaseAdmin();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const n = (c: number | null): number => c ?? 0;

    const [usersRes, listingsRes, waitlistRes, reportsRes] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      admin.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      admin.from('waitlist_signups').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);

    const newUsers = n(usersRes.count);
    const newListings = n(listingsRes.count);
    const newWaitlist = n(waitlistRes.count);
    const openReports = n(reportsRes.count);

    const today = new Date().toISOString().slice(0, 10);

    const rendered = await renderEmailTemplate(
      admin,
      'daily_digest_admin',
      {
        date: today,
        new_users: newUsers,
        new_listings: newListings,
        new_waitlist: newWaitlist,
        open_reports: openReports,
        generated_at: new Date().toISOString(),
      },
      {
        subject: '{{app_name}} daily digest — {{date}}',
        body:
          `Activity in the last 24 hours:\n\n` +
          `New users: {{new_users}}\n` +
          `New listings: {{new_listings}}\n` +
          `New waitlist signups: {{new_waitlist}}\n` +
          `\nBacklog:\n` +
          `Open reports awaiting review: {{open_reports}}\n` +
          `\nGenerated: {{generated_at}}`,
      }
    );

    await notifyStaff({
      event: 'daily_digest',
      subject: rendered.subject,
      adminBody: rendered.body,
    });

    return withCors(
      okResponse({ new_users: newUsers, new_listings: newListings, new_waitlist: newWaitlist, open_reports: openReports })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Digest failed';
    return withCors(errorResponse(message, 500, 'DIGEST_FAILED'));
  }
});
